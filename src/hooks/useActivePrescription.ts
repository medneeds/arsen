import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ActivePrescriptionSummary {
  id: string;
  status: string;
  version: number;
  itemsCount: number;
  updatedAt: string;
  signed: boolean;
}

/**
 * Subscribes to the latest prescription of a given patient (matched by name + hospital).
 * Used by the clinical Cockpit to surface a real-time chip with the active
 * prescription status (rascunho, validada, assinada, etc.).
 */
export function useActivePrescription(
  patientName: string | null,
  hospitalUnitId: string | null,
) {
  const [data, setData] = useState<ActivePrescriptionSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!patientName || !hospitalUnitId) {
      setData(null);
      return;
    }
    setLoading(true);
    const { data: rows, error } = await supabase
      .from("prescriptions")
      .select("id, status, version, items, digital_signature, updated_at, created_at")
      .eq("hospital_unit_id", hospitalUnitId)
      .eq("patient_name", patientName.trim())
      .neq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(1);
    if (!error && rows && rows.length > 0) {
      const row: any = rows[0];
      const items = Array.isArray(row.items) ? row.items : [];
      setData({
        id: row.id,
        status: row.status || "draft",
        version: row.version || 1,
        itemsCount: items.length,
        updatedAt: row.updated_at || row.created_at,
        signed: Boolean(row.digital_signature),
      });
    } else {
      setData(null);
    }
    setLoading(false);
  }, [patientName, hospitalUnitId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    if (!patientName || !hospitalUnitId) return;
    const channel = supabase
      .channel(`prescription-live-${hospitalUnitId}-${patientName}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "prescriptions",
          filter: `hospital_unit_id=eq.${hospitalUnitId}`,
        },
        (payload) => {
          const row: any = payload.new || payload.old;
          if (row?.patient_name?.trim() === patientName.trim()) {
            fetch();
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientName, hospitalUnitId, fetch]);

  return { prescription: data, loading, refresh: fetch };
}
