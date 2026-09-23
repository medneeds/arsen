import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LatestVitalSigns {
  id: string;
  recordedAt: string;
  recordedByName: string | null;
  systolicBp: number | null;
  diastolicBp: number | null;
  heartRate: number | null;
  respiratoryRate: number | null;
  spo2: number | null;
  temperature: number | null;
  news2Score: number | null;
  news2Risk: string | null;
  lactate: number | null;
  potassium: number | null;
}

/**
 * Realtime: último registro de sinais vitais do paciente.
 *
 * MIGRAÇÃO: vital_signs→sinais_vitais. `patientId` já é `internacoes.id` →
 * filtro direto por `internacao_id`. Colunas: recorded_at→data_hora,
 * systolic_bp→pressao_sistolica, diastolic_bp→pressao_diastolica,
 * heart_rate→freq_cardiaca, respiratory_rate→freq_respiratoria,
 * temperature→temperatura; recorded_by_name→join profissionais.nome (via
 * registrado_por, ≠ auth.uid). DEGRADADO (sem coluna em sinais_vitais):
 * news2_score, news2_risk, lactate, potassium → null; e as colunas
 * archived_at/encounter_id (filtros removidos). Por consequência, os toasts de
 * valores críticos no realtime (que dependiam de news2_risk/lactate/potassium)
 * foram removidos.
 */
export function useLatestVitalSigns(patientId: string | null, patientName?: string | null) {
  const [vitals, setVitals] = useState<LatestVitalSigns | null>(null);
  const [loading, setLoading] = useState(false);
  const lastSeenIdRef = useRef<string | null>(null);

  const fetchLatest = useCallback(async () => {
    if (!patientId) {
      setVitals(null);
      return;
    }
    setLoading(true);
    const SELECT =
      "id, data_hora, pressao_sistolica, pressao_diastolica, freq_cardiaca, freq_respiratoria, spo2, temperatura, registrado_por, profissional:profissionais(nome)";
    const { data, error } = await supabase
      .from("sinais_vitais")
      .select(SELECT)
      .eq("internacao_id", patientId)
      .order("data_hora", { ascending: false })
      .limit(1);

    if (!error && data && data.length > 0) {
      const r: any = data[0];
      setVitals({
        id: r.id,
        recordedAt: r.data_hora,
        recordedByName: r.profissional?.nome ?? null,
        systolicBp: r.pressao_sistolica,
        diastolicBp: r.pressao_diastolica,
        heartRate: r.freq_cardiaca,
        respiratoryRate: r.freq_respiratoria,
        spo2: r.spo2,
        temperature: r.temperatura,
        news2Score: null, // MIGRAÇÃO: sem coluna em sinais_vitais
        news2Risk: null, // MIGRAÇÃO: sem coluna em sinais_vitais
        lactate: null, // MIGRAÇÃO: sem coluna em sinais_vitais
        potassium: null, // MIGRAÇÃO: sem coluna em sinais_vitais
      });
      lastSeenIdRef.current = r.id;
    } else {
      setVitals(null);
    }
    setLoading(false);
  }, [patientId, patientName]);

  const fetchLatestRef = useRef(fetchLatest);
  useEffect(() => { fetchLatestRef.current = fetchLatest; }, [fetchLatest]);

  useEffect(() => {
    fetchLatest();
  }, [fetchLatest]);

  useEffect(() => {
    if (!patientId) return;
    const channel = supabase
      .channel(`patient-vitals-${patientId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sinais_vitais", filter: `internacao_id=eq.${patientId}` },
        (payload: any) => {
          const row = payload.new;
          if (!row || row.id === lastSeenIdRef.current) return;
          // MIGRAÇÃO: toasts de valores críticos removidos — news2_risk/lactate/
          // potassium não existem em sinais_vitais (o payload não os traz).
          fetchLatestRef.current();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId]);

  return { vitals, loading, refresh: fetchLatest };
}
