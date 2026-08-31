import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEncounterId } from "@/hooks/useActiveEncounterId";
import { useResolvedRegistryId } from "@/hooks/useResolvedRegistryId";

/**
 * Busca o diagnóstico registrado NO MOMENTO DA ADMISSÃO ("Hipóteses
 * diagnósticas" preenchidas no AdmissionDialog) — a primeira evolução
 * clínica do paciente (evolution_type = 'admission') guarda esse texto em
 * diagnostic_hypotheses.
 *
 * Usado para pré-preencher "Diagnóstico de Admissão" no Sumário de Alta —
 * hoje era digitado do zero mesmo já existindo esse registro desde a
 * entrada do paciente.
 *
 * Mesmo isolamento por internação atual que useLatestEvolution: prioriza
 * patient_registry_id (segue o paciente entre leitos) e restringe ao
 * encounter_id ativo — nunca traz o diagnóstico de uma internação anterior.
 */
export function useAdmissionDiagnosis(
  patientId: string | null,
  hospitalUnitId: string | null,
) {
  const [diagnosis, setDiagnosis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { encounterId: activeEncounterId } = useActiveEncounterId(patientId);
  const { registryId: resolvedRegistryId } = useResolvedRegistryId(patientId);

  const fetch = useCallback(async () => {
    if (!patientId || !hospitalUnitId) { setDiagnosis(null); return; }
    setLoading(true);
    let q = supabase
      .from("clinical_evolutions")
      .select("diagnostic_hypotheses, created_at")
      .eq("hospital_unit_id", hospitalUnitId)
      .eq("evolution_type", "admission")
      .is("archived_at", null)
      .order("created_at", { ascending: true })
      .limit(1);
    if (resolvedRegistryId) {
      q = q.or(`patient_registry_id.eq.${resolvedRegistryId},and(patient_registry_id.is.null,patient_id.eq.${patientId})`);
    } else {
      q = q.eq("patient_id", patientId);
    }
    if (activeEncounterId) {
      q = q.or(`encounter_id.eq.${activeEncounterId},encounter_id.is.null`);
    }
    const { data } = await q;
    setDiagnosis(data?.[0]?.diagnostic_hypotheses || null);
    setLoading(false);
  }, [patientId, hospitalUnitId, activeEncounterId, resolvedRegistryId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { diagnosis, loading, refresh: fetch };
}
