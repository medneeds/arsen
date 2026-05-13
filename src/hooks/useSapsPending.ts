import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SapsPendingInfo {
  id: string;
  patient_name: string;
  pending_since: string | null;
}

/**
 * Watches saps3_assessments for the given patient name and returns the pending record (if any).
 * Realtime via Supabase channel on the saps3_assessments table.
 */
export function useSapsPending(patientName?: string | null): SapsPendingInfo | null {
  const [pending, setPending] = useState<SapsPendingInfo | null>(null);

  useEffect(() => {
    if (!patientName) {
      setPending(null);
      return;
    }

    let active = true;

    const fetchPending = async () => {
      const { data } = await supabase
        .from("saps3_assessments" as any)
        .select("id, patient_name, pending_since, status")
        .eq("patient_name", patientName)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1);
      if (!active) return;
      const row = (data as any[])?.[0];
      setPending(row ? { id: row.id, patient_name: row.patient_name, pending_since: row.pending_since } : null);
    };

    fetchPending();

    const channel = supabase
      .channel(`saps-pending-${patientName}`)
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "saps3_assessments" },
        () => fetchPending(),
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [patientName]);

  return pending;
}

/**
 * Returns a map of patient_name -> SapsPendingInfo for a list of patient names.
 */
export function useSapsPendingMany(patientNames: string[]): Record<string, SapsPendingInfo> {
  const [map, setMap] = useState<Record<string, SapsPendingInfo>>({});
  const key = patientNames.slice().sort().join("|");

  useEffect(() => {
    let active = true;
    const fetchAll = async () => {
      if (patientNames.length === 0) {
        setMap({});
        return;
      }
      const { data } = await supabase
        .from("saps3_assessments" as any)
        .select("id, patient_name, pending_since, status, created_at")
        .eq("status", "pending")
        .in("patient_name", patientNames as any)
        .order("created_at", { ascending: false });
      if (!active) return;
      const result: Record<string, SapsPendingInfo> = {};
      (data as any[])?.forEach((r) => {
        if (!result[r.patient_name]) {
          result[r.patient_name] = { id: r.id, patient_name: r.patient_name, pending_since: r.pending_since };
        }
      });
      setMap(result);
    };

    fetchAll();

    const channel = supabase
      .channel(`saps-pending-many-${key.slice(0, 60)}`)
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "saps3_assessments" },
        () => fetchAll(),
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return map;
}
