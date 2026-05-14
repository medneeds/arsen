import { supabase } from "@/integrations/supabase/client";

/**
 * Repointa o histórico clínico (evoluções, prescrições, exames, culturas,
 * histórico admissional, condutas, prontuário, etc.) de um leito-paciente
 * de origem para um leito-paciente de destino.
 *
 * Use SEMPRE em transferência interna SEM ALTA quando o fluxo move o paciente
 * para uma linha de leito diferente (UTI/UCC fixos, troca de unidade, etc.),
 * antes de "esvaziar" o leito de origem.
 */
export async function repointPatientHistory(
  sourcePatientId: string,
  targetPatientId: string,
  reason?: string,
): Promise<{ ok: boolean; counts?: Record<string, number>; error?: string }> {
  if (!sourcePatientId || !targetPatientId) {
    return { ok: false, error: "source/target ausente" };
  }
  if (sourcePatientId === targetPatientId) {
    return { ok: true, counts: {} };
  }
  try {
    const { data, error } = await (supabase as any).rpc("repoint_patient_history", {
      p_source_patient_id: sourcePatientId,
      p_target_patient_id: targetPatientId,
      p_reason: reason ?? null,
    });
    if (error) throw error;
    return { ok: true, counts: (data?.counts as Record<string, number>) ?? {} };
  } catch (err: any) {
    console.error("[repointPatientHistory] erro", err);
    return { ok: false, error: err?.message ?? "Erro desconhecido" };
  }
}
