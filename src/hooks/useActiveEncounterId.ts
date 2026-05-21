import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fase B.1 — Resolve o encounter_id ATIVO do paciente atual.
 *
 * Hardening (bug JOSE WILLAME — leito reaproveitado): a linha-leito (patients.id)
 * pode ter sido reassociada entre ocupantes, deixando `patient_encounters.patient_id`
 * desalinhado (NULL ou apontando para outro paciente). O vínculo confiável é o
 * `patient_registry_id` (prontuário do paciente). Por isso resolvemos o encontro
 * pela tupla (registry_id ⊕ patient_id), priorizando o registry quando existir.
 *
 * Estratégia:
 *   1) Buscar patient_registry_id do paciente.
 *   2) Encontro ativo (status != closed) com registry_id correspondente.
 *   3) Fallback: encontro ativo com patient_id correspondente.
 *   4) Fallback final: encontro mais recente por registry_id ou patient_id.
 *
 * Realtime ouve mudanças em patient_encounters do paciente/registry para
 * refletir alta/transferência imediatamente.
 */
export function useActiveEncounterId(patientId: string | null): {
  encounterId: string | null;
  loading: boolean;
} {
  const [encounterId, setEncounterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!patientId) {
      setEncounterId(null);
      return;
    }
    setLoading(true);

    const resolve = async () => {
      // 0) Descobrir o registry do paciente (vínculo estável)
      const { data: patientRow } = await supabase
        .from("patients")
        .select("patient_registry_id")
        .eq("id", patientId)
        .maybeSingle();
      const registryId = patientRow?.patient_registry_id ?? null;

      const pickActive = async (column: "registry_id" | "patient_id", value: string) => {
        const { data } = await supabase
          .from("patient_encounters")
          .select("id, status, created_at")
          .eq(column, value)
          .neq("status", "closed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return data?.id ?? null;
      };

      const pickLatest = async (column: "registry_id" | "patient_id", value: string) => {
        const { data } = await supabase
          .from("patient_encounters")
          .select("id")
          .eq(column, value)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return data?.id ?? null;
      };

      // 1) Ativo por registry (prioritário — sobrevive a reuso de leito)
      let id = registryId ? await pickActive("registry_id", registryId) : null;
      // 2) Ativo por patient_id (compat com encontros legados sem registry)
      if (!id) id = await pickActive("patient_id", patientId);
      // 3) Fallback: mais recente (ainda preferindo registry)
      if (!id && registryId) id = await pickLatest("registry_id", registryId);
      if (!id) id = await pickLatest("patient_id", patientId);

      if (cancelled) return;
      setEncounterId(id);
      setLoading(false);
    };

    resolve().catch(() => {
      if (!cancelled) setLoading(false);
    });

    const channel = supabase
      .channel(`active-encounter-${patientId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "patient_encounters", filter: `patient_id=eq.${patientId}` },
        () => { resolve().catch(() => {}); },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "patients", filter: `id=eq.${patientId}` },
        () => { resolve().catch(() => {}); },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [patientId]);

  return { encounterId, loading };
}
