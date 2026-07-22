import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve o encounter_id ATIVO de um paciente no momento de um INSERT clínico.
 *
 * Contexto (auditoria de sincronização 22/07/2026): vários inserts clínicos
 * gravavam sem encounter_id, e os hooks de leitura toleram "encounter_id IS
 * NULL" para compatibilidade com dado legado — então um leito reusado exibia
 * dados do ocupante anterior. Carimbar o encounter na origem fecha isso.
 *
 * Esta é a MESMA lógica canônica do hook useActiveEncounterId (registry ⊕
 * patient_id), extraída para uso imperativo (dentro de handlers de submit) sem
 * duplicar a query em cada tela. Retorna null quando não há encounter ativo
 * (paciente sem internação aberta) — nesse caso o registro fica NULL, que é o
 * comportamento correto (não há atendimento ao qual vincular).
 */
export async function resolveActiveEncounterId(patientId: string | null | undefined): Promise<string | null> {
  if (!patientId) return null;
  try {
    const { data: pRow } = await supabase
      .from("patients")
      .select("patient_registry_id")
      .eq("id", patientId)
      .maybeSingle();
    const registryId = pRow?.patient_registry_id ?? null;

    let q = supabase
      .from("patient_encounters")
      .select("id")
      .neq("status", "closed")
      .order("admission_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1);
    q = registryId ? q.eq("registry_id", registryId) : q.eq("patient_id", patientId);

    const { data: encRow } = await q.maybeSingle();
    return encRow?.id ?? null;
  } catch {
    // Resolução é best-effort: falha aqui não deve bloquear o insert clínico.
    return null;
  }
}

/**
 * Fecha o encounter ATIVO de um paciente (alta/óbito/transferência externa) de
 * forma correta: resolve o encounter pela regra canônica (registry-first) e
 * fecha por id — NÃO por patient_id (linha-leito).
 *
 * Por quê (auditoria 22/07/2026): os fluxos de alta/óbito e transferência
 * externa fechavam o encounter com `.eq("patient_id", linhaLeito)`. Se o
 * paciente havia sido transferido internamente antes da alta, o repoint pode
 * ter alterado o vínculo patient_id do encounter — e o UPDATE não o encontrava,
 * deixando o encounter ABERTO. Um encounter zumbi aberto faz a próxima
 * readmissão trata-lo como "ativo" e MISTURAR o histórico de dois atendimentos,
 * violando a regra de negócio. Resolver por registry fecha o encounter certo.
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
      // Sem encounter ativo — nada a fechar (não é erro).
      return { ok: true, closedId: null };
    }
    const { error } = await supabase
      .from("patient_encounters")
      .update({
        status: "closed",
        discharge_date: dischargeDate ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", encounterId)
      .neq("status", "closed");
    if (error) return { ok: false, closedId: null, error: error.message };
    return { ok: true, closedId: encounterId };
  } catch (e: any) {
    return { ok: false, closedId: null, error: e?.message ?? "erro desconhecido" };
  }
}
