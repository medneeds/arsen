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

// REMOVIDO (auditoria pre-producao): signalClinicalDecision/revokeClinicalDecision
// e seus tipos/mapas auxiliares (ClinicalDecisionKind, KIND_TO_*, FINAL_KINDS,
// recordAudit, Signal/RevokeDecisionPayload) eram CODIGO MORTO — nenhum
// componente os chamava (o fluxo vivo e MovimentacaoForm, que usa
// toInternacaoStatusDb). Alem de mortos, gravavam internacoes.status com valores
// crus (alta_dada, transferencia_*_pendente, evasao) que VIOLAM o CHECK
// internacoes_status_check (ativa|alta|obito|transferida|cancelada) — armadilha
// latente se religados. Se o Painel Clinico vier a marcar decisao, deve usar o
// caminho vivo (toInternacaoStatusDb), nao ressuscitar esta API.

export interface LifecycleResult {
  ok: boolean;
  movementId?: string;
  error?: string;
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
