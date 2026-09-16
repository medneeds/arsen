import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Busca o diagnóstico registrado NO MOMENTO DA ADMISSÃO ("Hipóteses
 * diagnósticas" preenchidas no AdmissionDialog).
 *
 * Usado para pré-preencher "Diagnóstico de Admissão" no Sumário de Alta.
 *
 * MIGRAÇÃO: clinical_evolutions (evolution_type='admission' / diagnostic_hypotheses),
 * patient_registry e patient_encounters não existem mais. No schema novo o
 * diagnóstico de admissão vive em `internacoes.hipotese_diagnostica`
 * (escrito por AdmissionDialog/AdmissionHistoryDialog). `patientId` já é
 * `internacoes.id`, então lemos direto a internação. `hospitalUnitId` é mantido
 * na assinatura por compatibilidade, mas não tem coluna equivalente → sem uso.
 */
export function useAdmissionDiagnosis(
  patientId: string | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  hospitalUnitId: string | null,
) {
  const [diagnosis, setDiagnosis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!patientId) { setDiagnosis(null); return; }
    setLoading(true);
    const { data } = await supabase
      .from("internacoes")
      .select("hipotese_diagnostica")
      .eq("id", patientId)
      .maybeSingle();
    setDiagnosis((data as any)?.hipotese_diagnostica || null);
    setLoading(false);
  }, [patientId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { diagnosis, loading, refresh: fetch };
}
