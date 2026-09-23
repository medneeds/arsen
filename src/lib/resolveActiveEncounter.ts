import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve o encounter_id ATIVO de um paciente no momento de um INSERT clínico.
 *
 * MIGRAÇÃO: as tabelas patients / patient_registry / patient_encounters NÃO
 * existem mais. No schema novo o "encontro" É a própria internação — `patientId`
 * já é `internacoes.id`. Portanto o encounter ativo é o próprio `patientId`,
 * desde que a internação exista (mesma regra do hook useActiveEncounterId).
 * A resolução por registry ⊕ patient_id foi removida (tabelas mortas). Mantida a
 * assinatura para uso imperativo dentro de handlers de submit.
 */
export async function resolveActiveEncounterId(patientId: string | null | undefined): Promise<string | null> {
  if (!patientId) return null;
  try {
    const { data } = await supabase
      .from("internacoes")
      .select("id")
      .eq("id", patientId)
      .maybeSingle();
    return (data as any)?.id ?? null;
  } catch {
    // Resolução é best-effort: falha aqui não deve bloquear o insert clínico.
    return null;
  }
}

/**
 * Fecha o encounter ATIVO de um paciente (alta/óbito/transferência externa).
 *
 * MIGRAÇÃO: fechar o encounter agora é encerrar a INTERNAÇÃO. `bedRowId` já é
 * `internacoes.id`. Não existem mais `status='closed'` nem coluna
 * `discharge_date`/`updated_at`: o critério de "internação ativa" em todo o app é
 * `data_alta IS NULL`, então gravamos `data_alta` (atualizado_em é via trigger).
 *
 * Retorna true se um encounter foi fechado (ou já estava), false em erro real.
 */
export async function closeActiveEncounter(
  bedRowId: string | null | undefined,
  dischargeDate?: string,
): Promise<{ ok: boolean; closedId: string | null; error?: string }> {
  if (!bedRowId) return { ok: true, closedId: null };
  try {
    const encounterId = await resolveActiveEncounterId(bedRowId);
    if (!encounterId) {
      // Sem internação — nada a fechar (não é erro).
      return { ok: true, closedId: null };
    }
    const { error } = await supabase
      .from("internacoes")
      .update({ data_alta: dischargeDate ?? new Date().toISOString() } as any)
      .eq("id", encounterId)
      .is("data_alta", null);
    if (error) return { ok: false, closedId: null, error: error.message };
    return { ok: true, closedId: encounterId };
  } catch (e: any) {
    return { ok: false, closedId: null, error: e?.message ?? "erro desconhecido" };
  }
}
