import { supabase } from "@/integrations/supabase/client";
import { classifyTransfer, requiresSaps, requiresNewAdmission, type TransferClassification } from "@/lib/sectorComplexity";
import { sectorLabelFromCode } from "@/lib/hospitalSectors";
import type { Patient } from "@/types/patient";

// MIGRAÇÃO (schema novo):
//   - internal_transfer_requests / patient_movements → `transferencias`
//     (id, internacao_id, leito_origem_id, leito_destino_id, data_hora, motivo,
//      status, solicitado_por). A mega-tabela `patients` e patient_encounters /
//      patient_registry / admission_histories NÃO existem mais.
//   - O caminho feliz de cada fluxo é a RPC atômica (execute/signal/complete/
//     cancel *_internal_transfer_atomic), chamada via (supabase.rpc as any).
//   - Os fallbacks SEQUENCIAIS antigos dependiam inteiramente dessas tabelas
//     mortas (cópia de colunas clínicas entre slots `patients`, snapshots em
//     internal_transfer_requests, patient_movements). Além disso, `transferencias`
//     exige leito_destino_id NOT NULL, incompatível com a fila virtual de 2 etapas
//     (sinalização sem leito destino definido). Portanto os fallbacks foram
//     DEGRADADOS: sem a RPC, o fluxo retorna erro explicativo.
//   - `patientId`/`source.id`/`targetBedRow.id` == `internacoes.id`.
//   Ver MIGRACAO_DEGRADACOES.md.

// Detecta erros de RPC não encontrada (função ainda não deployada no banco).
// Código 42883 = undefined_function no PostgreSQL.
const isRpcMissing = (err: any): boolean =>
  (err as any)?.code === "42883" || (err?.message ?? "").includes("does not exist");

const DEGRADED_MSG =
  "Fluxo sequencial indisponível após a migração de schema (dependia de tabelas removidas). " +
  "Requer a RPC atômica correspondente no schema novo.";

/**
 * Executa uma TRANSFERÊNCIA INTERNA (one-shot) entre dois leitos do mesmo
 * hospital, preservando histórico clínico via a RPC atômica
 * `execute_internal_transfer_atomic`.
 *
 * MIGRAÇÃO: a pré-etapa que resolvia patient_registry_id por nome (tabela
 * patient_registry, morta) foi removida.
 */
export interface InternalTransferResult {
  ok: boolean;
  classification?: TransferClassification;
  needsSaps?: boolean;
  error?: string;
}

export async function executeInternalTransfer(params: {
  source: Patient;
  /** Patient (internação) do leito DESTINO */
  targetBedRow: Patient;
  currentUserId?: string | null;
  hospitalUnitId: string;
  stateId: string;
  department?: string | null;
  reason?: string;
}): Promise<InternalTransferResult> {
  const { source, targetBedRow, currentUserId, hospitalUnitId, stateId, department, reason } = params;

  if (!source?.id || !targetBedRow?.id) {
    return { ok: false, error: "source/target ausente" };
  }
  if (source.id === targetBedRow.id) {
    return { ok: false, error: "source = target" };
  }

  const classification = classifyTransfer(source.sector, targetBedRow.sector);
  const needsSaps = requiresSaps(classification);
  const needsNewAdmission = requiresNewAdmission(classification);

  try {
    // RPC atômica: toda a transferência (destino + repoint + origem + auditoria)
    // em uma única transação PostgreSQL. RPC desconhecida → (supabase.rpc as any).
    const { data, error } = await (supabase as any).rpc("execute_internal_transfer_atomic", {
      p_source_patient_id:   source.id,
      p_target_patient_id:   targetBedRow.id,
      p_needs_saps:          needsSaps,
      p_needs_new_admission: needsNewAdmission,
      p_reason:              reason ?? `Transferência interna: ${source.bedNumber} → ${targetBedRow.bedNumber}`,
      p_created_by:          currentUserId ?? null,
      p_hospital_unit_id:    hospitalUnitId,
      p_state_id:            stateId,
      p_department:          department ?? null,
      p_classification:      classification,
    });

    if (error) throw error;
    if (!data?.success) throw new Error("Transferência não confirmada pelo banco de dados");

    return { ok: true, classification, needsSaps };
  } catch (err: any) {
    console.error("[executeInternalTransfer] erro:", err);
    return { ok: false, classification, needsSaps, error: err?.message ?? "Erro desconhecido" };
  }
}

// =====================================================================
// FLUXO DE 2 ETAPAS — Transferência Interna sinalizada (fila virtual)
// =====================================================================
// MIGRAÇÃO: a fila virtual usava internal_transfer_requests (morta). `transferencias`
// exige leito_destino_id NOT NULL, então NÃO modela uma sinalização sem destino.
// O caminho feliz é a RPC atômica; sem ela, degradamos com erro explicativo.

export interface SignalInternalTransferParams {
  source: Patient;
  targetSectorCode: string;
  reason?: string;
  currentUserId?: string | null;
  hospitalUnitId: string;
  stateId: string;
  department?: string | null;
}

export interface SignalInternalTransferResult {
  ok: boolean;
  requestId?: string;
  classification?: TransferClassification;
  needsSaps?: boolean;
  error?: string;
}

export async function signalInternalTransfer(
  params: SignalInternalTransferParams,
): Promise<SignalInternalTransferResult> {
  const { source, targetSectorCode, reason, currentUserId, hospitalUnitId, stateId, department } = params;
  if (!source?.id) return { ok: false, error: "source ausente" };
  if (!targetSectorCode) return { ok: false, error: "setor destino ausente" };

  const classification = classifyTransfer(source.sector, targetSectorCode);
  const needsSaps = requiresSaps(classification);

  try {
    // MIGRAÇÃO: snapshot montado apenas a partir do objeto Patient (sem leituras
    // em patient_encounters/patients/patient_registry — tabelas mortas).
    const snapshot = { ...source };

    const { data: atomicData, error: atomicErr } = await (supabase as any).rpc(
      "signal_internal_transfer_atomic",
      {
        p_source_patient_id:   source.id,
        p_snapshot:            snapshot,
        p_target_sector_code:  targetSectorCode,
        p_target_sector_label: sectorLabelFromCode(targetSectorCode),
        p_classification:      classification,
        p_requires_saps:       needsSaps,
        p_reason:              reason ?? null,
        p_signaled_by:         currentUserId ?? null,
        p_hospital_unit_id:    hospitalUnitId,
        p_state_id:            stateId,
        p_department:          department ?? null,
      },
    );

    if (!atomicErr) {
      return { ok: true, requestId: atomicData?.request_id, classification, needsSaps };
    }

    if (!isRpcMissing(atomicErr)) throw atomicErr;

    // MIGRAÇÃO: sem fila virtual equivalente no schema novo (ver cabeçalho).
    console.warn("[signalInternalTransfer] RPC atômica indisponível — fluxo degradado");
    return { ok: false, classification, needsSaps, error: DEGRADED_MSG };
  } catch (err: any) {
    console.error("[signalInternalTransfer] erro", err);
    return { ok: false, classification, needsSaps, error: err?.message ?? "Erro desconhecido" };
  }
}

export interface CompleteInternalTransferParams {
  /** id do log de sinalização (logs_auditoria) — rastreio/auditoria. */
  requestId: string;
  /** internacoes.id de ORIGEM (row.source_patient_id da fila). */
  sourceInternacaoId: string;
  /** Leito DESTINO vago (view-model). targetBedRow.id === leitos.id (leito vago). */
  targetBedRow: Patient;
  currentUserId?: string | null;
  hospitalUnitId: string;
  stateId: string;
  department?: string | null;
}

/**
 * Conclui a transferência interna sinalizada (etapa 2): move a internação ativa
 * de origem para o leito de destino, ocupa o destino e libera a origem.
 *
 * MIGRAÇÃO: a RPC atômica `complete_internal_transfer_atomic` nunca foi deployada
 * para o schema novo (a definição no git referencia tabelas mortas:
 * internal_transfer_requests / patients / admission_histories) e sua assinatura
 * divergiu do call site — por isso o clique em "Confirmar alocação" retornava
 * "Could not find the function". Passamos a escrever direto no schema novo,
 * espelhando `alocarPreAdmissaoNoLeito` e `useBedCensusActions.transferBed` (já em
 * produção): a atomicidade real (transação) não existe sem RPC, então ORDENAMOS as
 * escritas para que o pior estado parcial seja o menos perigoso — o destino é
 * ocupado ANTES de a origem ser liberada, e qualquer falha na liberação da origem
 * SOBE como aviso (nunca leito fantasma silencioso).
 *
 * DEGRADAÇÕES conhecidas (mantidas, não inventadas):
 *  - `requires_saps` (escalada crítica): o paciente entra no leito crítico, mas o
 *    marcador "SAPS pendente"/timer não persiste (sem coluna no schema novo).
 *  - `escalada_intermediaria`: a mesma internação CONTINUA no destino (histórico
 *    íntegro, ancorado em internacao_id) em vez de abrir nova admissão — mais
 *    correto para transferência interna (é o mesmo atendimento até o desfecho).
 */
export async function completeInternalTransfer(
  params: CompleteInternalTransferParams,
): Promise<{ ok: boolean; aviso?: string | null; error?: string }> {
  const { requestId, sourceInternacaoId, targetBedRow, currentUserId, hospitalUnitId } = params;
  if (!sourceInternacaoId) return { ok: false, error: "internacao de origem ausente" };
  if (!targetBedRow?.id) return { ok: false, error: "leito destino ausente" };

  try {
    // 1) Leito destino ainda livre? (bed.id === leitos.id de leito vago)
    const { data: destLeito, error: destErr } = await supabase
      .from("leitos")
      .select("id, status, setor_id")
      .eq("id", targetBedRow.id)
      .maybeSingle();
    if (destErr) throw destErr;
    const dest = destLeito as { id: string; status: string; setor_id: string } | null;
    if (!dest) return { ok: false, error: "Leito de destino não encontrado. Atualize o mapa e tente de novo." };
    if (dest.status === "ocupado") {
      return { ok: false, error: `Leito ${targetBedRow.bedNumber} já foi ocupado. Selecione outro leito.` };
    }

    // 2) Internação de origem ainda ativa? Guarda o leito de origem para liberar depois.
    const { data: srcInt, error: srcErr } = await supabase
      .from("internacoes")
      .select("id, leito_id, data_alta")
      .eq("id", sourceInternacaoId)
      .maybeSingle();
    if (srcErr) throw srcErr;
    const src = srcInt as { id: string; leito_id: string | null; data_alta: string | null } | null;
    if (!src) return { ok: false, error: "Internação de origem não encontrada. A fila pode estar desatualizada." };
    if (src.data_alta != null) {
      return { ok: false, error: "A internação de origem já foi encerrada — não é mais transferência interna." };
    }
    const originLeitoId = src.leito_id;

    // 3) Move a internação para o leito/setor de destino e reativa o status
    //    (sai de INTERNAL_TRANSFER_PENDING — relocação efetivada). O histórico
    //    inteiro acompanha por ancorar em internacao_id.
    const { error: moveErr } = await supabase
      .from("internacoes")
      .update({
        leito_id: targetBedRow.id,
        setor_classificacao_id: dest.setor_id,
        status: "ativa",
      })
      .eq("id", sourceInternacaoId);
    if (moveErr) throw moveErr;

    // 4) Ocupa o destino ANTES de qualquer coisa destrutiva na origem.
    let aviso: string | null = null;
    const { error: occErr } = await supabase
      .from("leitos")
      .update({ status: "ocupado" })
      .eq("id", targetBedRow.id);
    if (occErr) {
      aviso = `Paciente movido para o leito ${targetBedRow.bedNumber}, mas ele nao foi marcado como ocupado (${occErr.message}). Avise a gestao de leitos para evitar dupla alocacao.`;
    }

    // 5) Libera a origem por ULTIMO (recuperavel se falhar; nunca leito fantasma silencioso).
    if (originLeitoId && originLeitoId !== targetBedRow.id) {
      const { error: freeErr } = await supabase
        .from("leitos")
        .update({ status: "higienizacao" })
        .eq("id", originLeitoId);
      if (freeErr) {
        aviso = `${aviso ? aviso + " " : ""}O leito de origem nao foi liberado (${freeErr.message}). Avise a gestao de leitos.`;
      }
    }

    // 6) Auditoria: marca a CONCLUSAO — a fila (useInternalTransferQueue) usa este
    //    evento para remover o item (evento mais recente por internacao vence).
    const { error: logErr } = await supabase.from("logs_auditoria").insert({
      tipo_evento: "conclusao_transferencia_interna",
      acao: "UPDATE",
      nome_tabela: "internacoes",
      internacao_id: sourceInternacaoId,
      registro_id: sourceInternacaoId,
      ator_user_id: currentUserId ?? null,
      motivo: `Transferencia interna concluida -> leito ${targetBedRow.bedNumber} (${sectorLabelFromCode(targetBedRow.sector)})`,
      dados_novos: {
        signal_log_id: requestId,
        target_leito_id: targetBedRow.id,
        target_bed: targetBedRow.bedNumber,
        target_sector_code: targetBedRow.sector,
      } as any,
      hospital_id: hospitalUnitId,
    } as any);
    if (logErr) {
      // Nao fatal: a alocacao ja aconteceu. Mas sem o evento a fila nao some — avisa.
      console.error("[completeInternalTransfer] falha ao registrar conclusao:", logErr);
      aviso = `${aviso ? aviso + " " : ""}A alocacao foi feita, mas o item pode continuar na fila (falha ao registrar conclusao: ${logErr.message}). Atualize a pagina.`;
    }

    return { ok: true, aviso };
  } catch (err: any) {
    console.error("[completeInternalTransfer] erro", err);
    return { ok: false, error: err?.message ?? "Erro desconhecido" };
  }
}

/**
 * Cancela uma sinalização de transferência interna que ainda não foi alocada.
 *
 * MIGRAÇÃO: a RPC atômica nunca foi deployada no schema novo. Como a sinalização
 * NÃO esvazia o leito de origem (o paciente permanece nele até a alocação — ver
 * MovimentacaoForm), cancelar não restaura nada: apenas reativa o status da
 * internação (sai de INTERNAL_TRANSFER_PENDING, limpando a tarja no mapa) e grava
 * um evento de cancelamento em `logs_auditoria` — a fila usa esse evento (mais
 * recente por internação vence) para remover o item.
 */
export async function cancelInternalTransferRequest(
  requestId: string,
  internacaoId: string,
  reason: string,
  currentUserId?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  if (!requestId) return { ok: false, error: "request ausente" };
  if (!internacaoId) return { ok: false, error: "internacao ausente" };
  try {
    // Reativa o status apenas se a internação ainda estiver aberta (não pisar em alta).
    const { data: srcInt, error: srcErr } = await supabase
      .from("internacoes")
      .select("id, data_alta")
      .eq("id", internacaoId)
      .maybeSingle();
    if (srcErr) throw srcErr;
    const src = srcInt as { data_alta: string | null } | null;
    if (src && src.data_alta == null) {
      const { error: statusErr } = await supabase
        .from("internacoes")
        .update({ status: "ativa" })
        .eq("id", internacaoId);
      if (statusErr) throw statusErr;
    }

    const { error: logErr } = await supabase.from("logs_auditoria").insert({
      tipo_evento: "cancelamento_transferencia_interna",
      acao: "UPDATE",
      nome_tabela: "internacoes",
      internacao_id: internacaoId,
      registro_id: internacaoId,
      ator_user_id: currentUserId ?? null,
      motivo: reason || "Cancelamento de sinalizacao de transferencia interna",
      dados_novos: { signal_log_id: requestId } as any,
    } as any);
    if (logErr) throw logErr;

    return { ok: true };
  } catch (err: any) {
    console.error("[cancelInternalTransferRequest] erro", err);
    return { ok: false, error: err?.message ?? "Erro" };
  }
}

/**
 * Ids de internacao com transferencia interna SINALIZADA e ainda nao concluida
 * nem cancelada. Fonte da TARJA no mapa de leitos — a MESMA fonte da fila.
 *
 * MIGRAÇÃO: `internacoes.status` tem CHECK (ativa|alta|obito|transferida|cancelada)
 * e nao guarda "transferencia_interna_pendente" (toInternacaoStatusDb colapsa em
 * "ativa"). Logo o estado sinalizado NAO existe em coluna — vive so em
 * logs_auditoria. Aplica "evento mais recente por internacao vence": se o ultimo
 * evento da internacao for a sinalizacao, ela esta pendente; se for conclusao ou
 * cancelamento, saiu do estado pendente.
 */
export async function fetchPendingInternalTransferInternacaoIds(): Promise<Set<string>> {
  const pending = new Set<string>();
  const { data, error } = await supabase
    .from("logs_auditoria")
    .select("internacao_id, tipo_evento, criado_em")
    .in("tipo_evento", [
      "sinalizacao_transferencia_interna",
      "conclusao_transferencia_interna",
      "cancelamento_transferencia_interna",
    ])
    .order("criado_em", { ascending: false })
    .limit(1000);
  if (error || !data) return pending;

  const rows = data as { internacao_id: string | null; tipo_evento: string }[];
  const seen = new Set<string>();
  for (const log of rows) {
    const key = log.internacao_id;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (log.tipo_evento === "sinalizacao_transferencia_interna") pending.add(key);
  }
  return pending;
}

/**
 * Momento de ENTRADA no setor ATUAL por internacao (para o TPS — Tempo de
 * Permanencia no Setor). E o criado_em do ultimo evento
 * conclusao_transferencia_interna de cada internacao em logs_auditoria: a
 * transferencia interna reusa a mesma linha de internacao (data_entrada nao
 * muda), entao a entrada no setor atual so existe aqui. Quem nunca transferiu
 * nao tem evento — o chamador usa data_entrada como fallback (TPS = DIH).
 */
export async function fetchLatestSectorEntryByInternacao(): Promise<Map<string, string>> {
  const byInternacao = new Map<string, string>();
  const { data, error } = await supabase
    .from("logs_auditoria")
    .select("internacao_id, criado_em")
    .eq("tipo_evento", "conclusao_transferencia_interna")
    .order("criado_em", { ascending: false })
    .limit(1000);
  if (error || !data) return byInternacao;

  const rows = data as { internacao_id: string | null; criado_em: string | null }[];
  for (const log of rows) {
    const key = log.internacao_id;
    if (!key || !log.criado_em || byInternacao.has(key)) continue;
    byInternacao.set(key, log.criado_em); // ordenado desc -> primeiro visto = mais recente
  }
  return byInternacao;
}
