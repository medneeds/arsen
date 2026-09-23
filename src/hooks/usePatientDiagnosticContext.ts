import { useState, useCallback, useEffect, useRef } from "react";

/**
 * Discharge prediction (UTI + Hospitalar), palliative flag, and
 * isolation/precautions for a patient — surfaced inside the Diagnósticos block
 * of the Evolution screen.
 *
 * MIGRAÇÃO: no schema antigo esses campos ficavam em `patients`
 * (uti_discharge_prediction, hospital_discharge_prediction, is_palliative,
 * isolation_precautions). No schema novo NENHUM deles tem coluna equivalente —
 * `patients` virou `internacoes`, que não possui esses campos, e a regra é não
 * inventar colunas. Portanto a PERSISTÊNCIA foi degradada: o estado vive apenas
 * em memória durante a sessão e nada é gravado no banco. A assinatura do hook é
 * preservada para não quebrar consumidores. Ver supabase/MIGRACAO_DEGRADACOES.md.
 */
export interface PatientDiagnosticContext {
  /** Previsão de alta da UTI/UCI (ISO yyyy-MM-dd ou string livre legada) */
  utiDischargePrediction: string;
  /** Previsão de alta hospitalar (ISO yyyy-MM-dd) */
  hospitalDischargePrediction: string;
  isPalliative: boolean;
  isolationPrecautions: string;
}

export function usePatientDiagnosticContext(patientId: string | null) {
  const [data, setData] = useState<PatientDiagnosticContext>({
    utiDischargePrediction: "",
    hospitalDischargePrediction: "",
    isPalliative: false,
    isolationPrecautions: "",
  });
  // MIGRAÇÃO: sem I/O remoto — loading/saving nunca ficam ativos.
  const [loading] = useState(false);
  const [saving] = useState(false);
  const lastPatientRef = useRef<string | null>(null);

  // Ao trocar de paciente, limpa o estado local (não há de onde recarregar).
  useEffect(() => {
    if (lastPatientRef.current !== patientId) {
      lastPatientRef.current = patientId;
      setData({
        utiDischargePrediction: "",
        hospitalDischargePrediction: "",
        isPalliative: false,
        isolationPrecautions: "",
      });
    }
  }, [patientId]);

  // MIGRAÇÃO: refresh vira no-op (sem colunas de destino para ler).
  const refresh = useCallback(async () => {}, []);

  // MIGRAÇÃO: todos os updates apenas atualizam o estado local — sem gravação.
  const updateUtiDischargePrediction = useCallback((value: string) => {
    setData(prev => ({ ...prev, utiDischargePrediction: value }));
  }, []);

  const updateHospitalDischargePrediction = useCallback((value: string) => {
    setData(prev => ({ ...prev, hospitalDischargePrediction: value }));
  }, []);

  const updateIsPalliative = useCallback(async (value: boolean) => {
    setData(prev => ({ ...prev, isPalliative: value }));
  }, []);

  const updateIsolationPrecautions = useCallback((value: string) => {
    setData(prev => ({ ...prev, isolationPrecautions: value }));
  }, []);

  return {
    ...data,
    loading, saving,
    updateUtiDischargePrediction,
    updateHospitalDischargePrediction,
    updateIsPalliative,
    updateIsolationPrecautions,
    refresh,
  };
}
