import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
 * Dispara toasts quando outro usuário registra valores críticos.
 */
export function useLatestVitalSigns(patientId: string | null) {
  const [vitals, setVitals] = useState<LatestVitalSigns | null>(null);
  const [loading, setLoading] = useState(false);
  const lastSeenIdRef = useRef<string | null>(null);

  const fetchLatest = useCallback(async () => {
    if (!patientId) {
      setVitals(null);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("vital_signs")
      .select(
        "id, recorded_at, recorded_by_name, systolic_bp, diastolic_bp, heart_rate, respiratory_rate, spo2, temperature, news2_score, news2_risk, lactate, potassium",
      )
      .eq("patient_id", patientId)
      .order("recorded_at", { ascending: false })
      .limit(1);
    if (!error && data && data.length > 0) {
      const r: any = data[0];
      setVitals({
        id: r.id,
        recordedAt: r.recorded_at,
        recordedByName: r.recorded_by_name,
        systolicBp: r.systolic_bp,
        diastolicBp: r.diastolic_bp,
        heartRate: r.heart_rate,
        respiratoryRate: r.respiratory_rate,
        spo2: r.spo2,
        temperature: r.temperature,
        news2Score: r.news2_score,
        news2Risk: r.news2_risk,
        lactate: r.lactate,
        potassium: r.potassium,
      });
      lastSeenIdRef.current = r.id;
    } else {
      setVitals(null);
    }
    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    fetchLatest();
  }, [fetchLatest]);

  useEffect(() => {
    if (!patientId) return;
    const channel = supabase
      .channel(`patient-vitals-${patientId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "vital_signs", filter: `patient_id=eq.${patientId}` },
        (payload: any) => {
          const row = payload.new;
          if (!row || row.id === lastSeenIdRef.current) return;
          // Toast crítico se valores extremos
          if (row.news2_risk === "high") {
            toast.warning("Sinais vitais críticos registrados", {
              description: `NEWS2 ${row.news2_score} (alto)${row.recorded_by_name ? ` • por ${row.recorded_by_name}` : ""}`,
              duration: 7000,
            });
          } else if (row.lactate && Number(row.lactate) > 4) {
            toast.error("Lactato elevado registrado", {
              description: `Lactato ${row.lactate} mmol/L`,
              duration: 7000,
            });
          } else if (row.potassium && (Number(row.potassium) > 6 || Number(row.potassium) < 2.5)) {
            toast.error("Potássio crítico registrado", {
              description: `K+ ${row.potassium} mEq/L`,
              duration: 7000,
            });
          }
          fetchLatest();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId, fetchLatest]);

  return { vitals, loading, refresh: fetchLatest };
}
