/**
 * src/lib/bedLifecycle.ts
 *
 * Fonte única de movimentações de leito / desfechos clínicos.
 *
 * MIGRAÇÃO (schema novo):
 *   - A tabela `patients` (mega-tabela de leito+clínica) NÃO existe mais. O estado
 *     clínico da internação vive em `internacoes` (status, data_alta). O estado
 *     físico do leito vive em `leitos` (status). O paciente é `pacientes`.
 *   - `patient_movements` (trilha de auditoria) → degradada para `logs_auditoria`
 *     (a nova `transferencias` só modela transferência leito→leito e não cabe em
 *     desfechos como alta/óbito). `patient_encounters` não existe: o fechamento do
 *     atendimento passa a ser representado por `internacoes.data_alta`.
 *   - Fluxo administrativo sequencial (executeOperationalRelocation) dependia
 *     inteiramente da mega-tabela `patients` + RPC `archive_patient_bed_data` +
 *     `repointPatientHistory`; o caminho feliz é a RPC atômica, e o fallback foi
 *     degradado (ver MIGRACAO_DEGRADACOES.md).
 *   - `patientId` == `internacoes.id`. `*_por`/ator referenciam profissionais/auth.
 */
import { supabase } from "@/integrations/supabase/client";

export type ClinicalDecisionKind =
  | "alta_medica"
  | "transf_interna"
  | "transf_externa"
  | "obito"
  | "evasao";

const KIND_TO_STATUS: Record<ClinicalDecisionKind, string> = {
  alta_medica: "alta_dada",
  transf_interna: "transferencia_interna_pendente",
  transf_externa: "transferencia_externa_pendente",
  obito: "obito",
  evasao: "evasao",
};

const KIND_TO_MOVEMENT_TYPE: Record<ClinicalDecisionKind, string> = {
  alta_medica: "ALTA_HOSPITALAR",
  transf_interna: "TRANSFERENCIA_INTERNA",
  transf_externa: "TRANSFERENCIA_EXTERNA",
  obito: "OBITO",
  evasao: "EVASAO",
};

/** Desfechos que encerram a internação (gravam data_alta). */
const FINAL_KINDS: ReadonlySet<ClinicalDecisionKind> = new Set([
  "alta_medica",
  "obito",
  "transf_externa",
]);

export interface SignalDecisionPayload {
  patientId: string;
  patientName: string;
  patientBed?: string | null;
  patientSector?: string | null;
  hospitalUnitId: string;
  stateId: string;
  department?: string | null;
  /** Destino administrativo (interno: setor/leito; externo: instituição) */
  destination?: string | null;
  targetSector?: string | null;
  targetBed?: string | null;
  responsibleDoctor?: string | null;
  notes?: string | null;
  nirRequested?: boolean;
  patientSnapshot?: any;
}

export interface LifecycleResult {
  ok: boolean;
  movementId?: string;
  error?: string;
}

/** MIGRAÇÃO: registra a trilha de auditoria em logs_auditoria (substitui patient_movements). */
async function recordAudit(entry: {
  internacaoId: string;
  tipoEvento: string;
  atorUserId: string | null;
  hospitalId?: string | null;
  motivo?: string | null;
  dados?: any;
}): Promise<string | undefined> {
  try {
    const { data, error } = await supabase
      .from("logs_auditoria")
      .insert({
        tipo_evento: entry.tipoEvento,
        nome_tabela: "internacoes",
        registro_id: entry.internacaoId,
        internacao_id: entry.internacaoId,
        ator_user_id: entry.atorUserId,
        hospital_id: entry.hospitalId ?? null,
        motivo: entry.motivo ?? null,
        dados_novos: entry.dados ?? null,
      } as any)
      .select("id")
      .single();
    if (error) {
      console.warn("[bedLifecycle] falha ao gravar logs_auditoria (não-bloqueante):", error);
      return undefined;
    }
    return (data as any)?.id;
  } catch (e) {
    console.warn("[bedLifecycle] exceção ao gravar logs_auditoria (não-bloqueante):", e);
    return undefined;
  }
}

/** Painel Clínico → marca decisão. NÃO libera leito. */
export async function signalClinicalDecision(
  kind: ClinicalDecisionKind,
  payload: SignalDecisionPayload,
): Promise<LifecycleResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    // Atualiza o estado da internação (substitui patients.admission_status).
    // Desfechos finais também carimbam data_alta (substitui o fechamento do encounter).
    const interUpdate: Record<string, unknown> = {
      status: KIND_TO_STATUS[kind],
    };
    if (FINAL_KINDS.has(kind)) {
      interUpdate.data_alta = new Date().toISOString();
    }

    const { error: statusErr } = await supabase
      .from("internacoes")
      .update(interUpdate as any)
      .eq("id", payload.patientId);
    if (statusErr) throw statusErr;

    // MIGRAÇÃO: patient_movements → logs_auditoria. Campos ricos (bed/sector/
    // destination/snapshot/metadata) preservados dentro de dados_novos.
    const movementId = await recordAudit({
      internacaoId: payload.patientId,
      tipoEvento: `decisao_clinica:${KIND_TO_MOVEMENT_TYPE[kind]}`,
      atorUserId: user?.id ?? null,
      hospitalId: payload.hospitalUnitId,
      motivo: payload.notes ?? null,
      dados: {
        flow_version: "v2_unified",
        stage: "signal",
        kind,
        patient_name: payload.patientName,
        patient_bed: payload.patientBed ?? null,
        patient_sector: payload.patientSector ?? null,
        destination: payload.destination ?? null,
        target_sector: payload.targetSector ?? null,
        target_bed: payload.targetBed ?? null,
        responsible_doctor: payload.responsibleDoctor ?? null,
        nir_requested: !!payload.nirRequested,
        department: payload.department ?? null,
        state_id: payload.stateId,
        patient_snapshot: payload.patientSnapshot ?? null,
      },
    });

    return { ok: true, movementId };
  } catch (err: any) {
    console.error("[signalClinicalDecision] erro", err);
    return { ok: false, error: err?.message ?? "Erro desconhecido" };
  }
}

export interface RevokeDecisionPayload {
  patientId: string;
  patientName: string;
  patientBed?: string | null;
  patientSector?: string | null;
  hospitalUnitId: string;
  stateId: string;
  department?: string | null;
  reason: string;
}

/** Painel Clínico → desfaz sinalização (paciente piorou, decisão revogada). */
export async function revokeClinicalDecision(
  payload: RevokeDecisionPayload,
): Promise<LifecycleResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    // Volta para admitido — leito ainda não foi liberado, paciente segue ativo.
    // Limpa data_alta caso a decisão revogada fosse um desfecho final.
    const { error: statusErr } = await supabase
      .from("internacoes")
      .update({ status: "ativa", data_alta: null } as any)
      .eq("id", payload.patientId);
    if (statusErr) throw statusErr;

    const movementId = await recordAudit({
      internacaoId: payload.patientId,
      tipoEvento: "decisao_clinica:REVOGACAO_DECISAO",
      atorUserId: user?.id ?? null,
      hospitalId: payload.hospitalUnitId,
      motivo: payload.reason,
      dados: {
        flow_version: "v2_unified",
        stage: "revoke",
        patient_name: payload.patientName,
        patient_bed: payload.patientBed ?? null,
        patient_sector: payload.patientSector ?? null,
        department: payload.department ?? null,
        state_id: payload.stateId,
      },
    });

    return { ok: true, movementId };
  } catch (err: any) {
    console.error("[revokeClinicalDecision] erro", err);
    return { ok: false, error: err?.message ?? "Erro desconhecido" };
  }
}

export interface OperationalRelocationPayload {
  sourcePatientId: string;
  targetPatientId: string;
  reason: string;
  hospitalUnitId: string;
  stateId: string;
  department?: string | null;
}

/**
 * Mapa de Leitos → remanejamento operacional (reforma, manutenção, isolamento,
 * conforto). SEM decisão clínica.
 *
 * Caminho feliz: RPC atômica `execute_operational_relocation_atomic` (executa no
 * banco a movimentação + auditoria).
 *
 * MIGRAÇÃO: o fallback sequencial original dependia inteiramente da mega-tabela
 * `patients` (cópia de ~40 colunas clínicas entre slots), da RPC
 * `archive_patient_bed_data` e de `repointPatientHistory` — todos ligados a
 * tabelas mortas. No schema novo, a movimentação de leito é um UPDATE em
 * `internacoes.leito_id` (+ `leitos.status`) que exige o leito destino resolvido,
 * o que não é derivável dos ids de slot `patients` deste payload. Portanto o
 * fallback foi degradado: se a RPC não existir, retornamos erro explicativo.
 * Ver MIGRACAO_DEGRADACOES.md.
 */
export async function executeOperationalRelocation(
  payload: OperationalRelocationPayload,
): Promise<LifecycleResult> {
  if (payload.sourcePatientId === payload.targetPatientId) {
    return { ok: false, error: "Leito de origem e destino são iguais." };
  }

  const { data: { user } } = await supabase.auth.getUser();

  // RPC desconhecida (não tipada) → chamada via (supabase.rpc as any).
  const { data: atomicData, error: atomicErr } = await (supabase as any).rpc(
    "execute_operational_relocation_atomic",
    {
      p_source_patient_id: payload.sourcePatientId,
      p_target_patient_id: payload.targetPatientId,
      p_reason:            payload.reason,
      p_hospital_unit_id:  payload.hospitalUnitId,
      p_state_id:          payload.stateId,
      p_department:        payload.department ?? null,
      p_created_by:        user?.id ?? null,
    },
  );

  if (!atomicErr) {
    return { ok: true, movementId: atomicData?.movement_id ?? undefined };
  }

  // MIGRAÇÃO: fallback sequencial degradado (dependia de `patients`, tabela morta).
  console.error("[executeOperationalRelocation] RPC indisponível/erro:", atomicErr);
  return {
    ok: false,
    error:
      atomicErr?.message ??
      "Remanejamento operacional indisponível: requer a RPC execute_operational_relocation_atomic no schema novo.",
  };
}
