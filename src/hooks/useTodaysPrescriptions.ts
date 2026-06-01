import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TodaysPrescriptionStatus = "signed" | "validated" | "pending";

/**
 * Subscribes to prescriptions of a hospital unit and returns a map of
 * patientName (trimmed, uppercased) → status for the CURRENT day.
 *
 * - "validated": há uma prescription_validations.status='validated' criada hoje
 *   para uma prescrição assinada do paciente naquela unidade.
 * - "signed" (fallback): prescrição assinada hoje, ainda não validada pela farmácia.
 * - "pending": caso contrário.
 *
 * Realtime cobre tanto `prescriptions` quanto `prescription_validations` para
 * que o ponto verde do Painel Clínico atualize imediatamente após a validação.
 */
export function useTodaysPrescriptions(hospitalUnitId: string | null) {
  const [validatedToday, setValidatedToday] = useState<Set<string>>(new Set());

  const fetchAll = useCallback(async () => {
    if (!hospitalUnitId) {
      setValidatedToday(new Set());
      return;
    }
    const start = new Set<string>();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startIso = startOfDay.toISOString();

    // 1) Prescrições assinadas hoje (mantém compat caso ainda exista status='validated')
    const { data: presc } = await supabase
      .from("prescriptions")
      .select("id, patient_name, status, created_at")
      .eq("hospital_unit_id", hospitalUnitId)
      .in("status", ["signed", "validated"])
      .gte("created_at", startIso);

    const prescIdToName = new Map<string, string>();
    if (presc) {
      for (const row of presc as any[]) {
        if (row?.patient_name) {
          if (row.status === "validated") {
            start.add(String(row.patient_name).trim().toUpperCase());
          }
          if (row?.id) prescIdToName.set(row.id, String(row.patient_name).trim().toUpperCase());
        }
      }
    }

    // 2) Validações farmacêuticas (validated) criadas hoje nessa unidade
    const { data: vals } = await supabase
      .from("prescription_validations")
      .select("prescription_id, status, created_at")
      .eq("hospital_unit_id", hospitalUnitId)
      .eq("status", "validated")
      .gte("created_at", startIso);

    if (vals) {
      const missingIds: string[] = [];
      for (const v of vals as any[]) {
        const name = v?.prescription_id ? prescIdToName.get(v.prescription_id) : null;
        if (name) start.add(name);
        else if (v?.prescription_id) missingIds.push(v.prescription_id);
      }
      // Resolve nomes de validações cuja prescrição não veio no select de hoje
      if (missingIds.length) {
        const { data: extra } = await supabase
          .from("prescriptions")
          .select("id, patient_name")
          .in("id", missingIds);
        if (extra) {
          for (const row of extra as any[]) {
            if (row?.patient_name) start.add(String(row.patient_name).trim().toUpperCase());
          }
        }
      }
    }

    setValidatedToday(start);
  }, [hospitalUnitId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!hospitalUnitId) return;
    const channel = supabase
      .channel(`prescriptions-today-${hospitalUnitId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "prescriptions",
          filter: `hospital_unit_id=eq.${hospitalUnitId}`,
        },
        () => fetchAll(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "prescription_validations",
          filter: `hospital_unit_id=eq.${hospitalUnitId}`,
        },
        () => fetchAll(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [hospitalUnitId, fetchAll]);

  const getStatus = useCallback(
    (patientName: string | null | undefined): TodaysPrescriptionStatus => {
      if (!patientName) return "pending";
      return validatedToday.has(patientName.trim().toUpperCase()) ? "validated" : "pending";
    },
    [validatedToday],
  );

  return { getStatus, signedToday: validatedToday, refresh: fetchAll };
}
