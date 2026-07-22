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
