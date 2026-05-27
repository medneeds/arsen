import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TodaysPrescriptionStatus = "signed" | "pending";

/**
 * Subscribes to prescriptions of a hospital unit and returns a map of
 * patientName (trimmed, uppercased) → status for the CURRENT day.
 *
 * - "signed": there is at least one prescription with status='signed' whose
 *   created_at is within today (local time).
 * - "pending": otherwise (no signed prescription today; may have draft).
 *
 * Used by the Painel Clínico list dot indicator. Realtime keeps it in sync
 * when prescriptions are signed/validated in another tab.
 */
export function useTodaysPrescriptions(hospitalUnitId: string | null) {
  const [signedToday, setSignedToday] = useState<Set<string>>(new Set());

  const fetchAll = useCallback(async () => {
    if (!hospitalUnitId) {
      setSignedToday(new Set());
      return;
    }
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from("prescriptions")
      .select("patient_name, status, created_at")
      .eq("hospital_unit_id", hospitalUnitId)
      .in("status", ["signed", "validated"])
      .gte("created_at", start.toISOString());
    if (error || !data) {
      setSignedToday(new Set());
      return;
    }
    const next = new Set<string>();
    for (const row of data as any[]) {
      if (row?.patient_name) next.add(String(row.patient_name).trim().toUpperCase());
    }
    setSignedToday(next);
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
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [hospitalUnitId, fetchAll]);

  const getStatus = useCallback(
    (patientName: string | null | undefined): TodaysPrescriptionStatus => {
      if (!patientName) return "pending";
      return signedToday.has(patientName.trim().toUpperCase()) ? "signed" : "pending";
    },
    [signedToday],
  );

  return { getStatus, signedToday, refresh: fetchAll };
}
