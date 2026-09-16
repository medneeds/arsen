import { useState, useEffect, useCallback, useRef } from "react";

/**
 * CID-10 codes for a patient. Used by CompactPatientHeader so doctors can
 * adjust diagnoses inline on the Evolution / Prescription screens.
 *
 * MIGRAÇÃO: no schema antigo os CIDs ficavam em `admission_histories`
 * (cid_primary / cid_secondary). Essa tabela virou `internacoes`, que NÃO tem
 * colunas de CID (só `hipotese_diagnostica` em texto livre). Como não há coluna
 * de destino e a regra é não inventar colunas, a PERSISTÊNCIA de CID foi
 * degradada: o estado é mantido apenas em memória durante a sessão e nada é
 * gravado no banco. A assinatura do hook é preservada para não quebrar
 * consumidores. Ver supabase/MIGRACAO_DEGRADACOES.md.
 */
export function usePatientCid(patientId: string | null) {
  const [cidPrimary, setCidPrimary] = useState<string>("");
  const [cidSecondary, setCidSecondary] = useState<string[]>([]);
  // MIGRAÇÃO: sem I/O remoto — loading/saving nunca ficam ativos.
  const [loading] = useState(false);
  const [saving] = useState(false);
  const lastPatientRef = useRef<string | null>(null);

  // Ao trocar de paciente, limpa o estado local (não há de onde recarregar).
  useEffect(() => {
    if (lastPatientRef.current !== patientId) {
      lastPatientRef.current = patientId;
      setCidPrimary("");
      setCidSecondary([]);
    }
  }, [patientId]);

  // MIGRAÇÃO: refresh vira no-op (sem coluna de CID para ler).
  const refresh = useCallback(async () => {}, []);

  const updatePrimary = useCallback(async (value: string) => {
    // MIGRAÇÃO: apenas estado local — sem gravação (sem coluna de destino).
    setCidPrimary(value);
  }, []);

  const updateSecondary = useCallback(async (values: string[]) => {
    // MIGRAÇÃO: apenas estado local — sem gravação (sem coluna de destino).
    setCidSecondary(values);
  }, []);

  return {
    cidPrimary, cidSecondary,
    loading, saving,
    updatePrimary, updateSecondary,
    refresh,
  };
}
