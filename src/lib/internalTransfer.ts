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
  requestId: string;
  targetBedRow: Patient;
  currentUserId?: string | null;
  hospitalUnitId: string;
  stateId: string;
  department?: string | null;
}

export async function completeInternalTransfer(
  params: CompleteInternalTransferParams,
): Promise<{ ok: boolean; classification?: TransferClassification; needsSaps?: boolean; error?: string }> {
  const { requestId, targetBedRow, currentUserId, hospitalUnitId, stateId, department } = params;
  if (!requestId) return { ok: false, error: "request ausente" };
  if (!targetBedRow?.id) return { ok: false, error: "leito destino ausente" };

  try {
    // RPC atômica: lê a solicitação, popula destino, repointa histórico e conclui.
    // RPC desconhecida → (supabase.rpc as any).
    const { data: atomicData, error: atomicErr } = await (supabase as any).rpc(
      "complete_internal_transfer_atomic",
      {
        p_request_id:        requestId,
        p_target_patient_id: targetBedRow.id,
        p_repoint_reason:    `Transferência interna (etapa 2) → ${targetBedRow.bedNumber} (${sectorLabelFromCode(targetBedRow.sector)})`,
        p_current_user_id:   currentUserId ?? null,
        p_hospital_unit_id:  hospitalUnitId,
        p_state_id:          stateId,
        p_department:        department ?? null,
      },
    );

    if (!atomicErr) {
      if (atomicData != null && (atomicData as any).success === false) {
        return { ok: false, error: "Transferência não confirmada pelo banco de dados" };
      }
      const classification = (atomicData as any)?.classification as TransferClassification | undefined;
      const needsSaps = (atomicData as any)?.needs_saps as boolean | undefined;
      return { ok: true, classification, needsSaps };
    }

    if (!isRpcMissing(atomicErr)) throw atomicErr;

    // MIGRAÇÃO: fallback sequencial degradado (dependia de internal_transfer_requests
    // + patients + admission_histories, tabelas mortas).
    console.warn("[completeInternalTransfer] RPC atômica indisponível — fluxo degradado");
    return { ok: false, error: DEGRADED_MSG };
  } catch (err: any) {
    console.error("[completeInternalTransfer] erro", err);
    return { ok: false, error: err?.message ?? "Erro desconhecido" };
  }
}

export async function cancelInternalTransferRequest(
  requestId: string,
  reason: string,
  currentUserId?: string | null,
): Promise<{ ok: boolean; restoredSourceBed?: boolean; error?: string }> {
  if (!requestId) return { ok: false, error: "request ausente" };
  try {
    // RPC atômica: cancela a solicitação e restaura o leito de origem se ainda vago.
    // RPC desconhecida → (supabase.rpc as any).
    const { data: atomicData, error: atomicErr } = await (supabase as any).rpc(
      "cancel_internal_transfer_atomic",
      {
        p_request_id:      requestId,
        p_reason:          reason,
        p_current_user_id: currentUserId ?? null,
      },
    );

    if (!atomicErr) {
      return { ok: true, restoredSourceBed: !!(atomicData as any)?.restored_source_bed };
    }

    if (!isRpcMissing(atomicErr)) throw atomicErr;

    // MIGRAÇÃO: fallback sequencial degradado (dependia de internal_transfer_requests
    // + patients, tabelas mortas).
    console.warn("[cancelInternalTransferRequest] RPC atômica indisponível — fluxo degradado");
    return { ok: false, error: DEGRADED_MSG };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Erro" };
  }
}
