import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";

export interface InternalTransferRequestRow {
  id: string;
  source_patient_id: string;
  source_bed: string | null;
  source_sector: string | null;
  patient_name: string;
  patient_snapshot: any;
  encounter_code: string | null;
  target_sector_code: string;
  target_sector_label: string | null;
  classification: "escalada_critica" | "escalada_intermediaria" | "escalada_simples" | "desescalada" | "lateral_critica" | "lateral_comum";
  requires_saps: boolean;
  reason: string | null;
  status: "pending" | "completed" | "cancelled";
  signaled_by: string | null;
  signaled_at: string;
  hospital_unit_id: string;
}

export function useInternalTransferQueue(sectorCode?: string | null) {
  const { currentHospital } = useHospital();
  const [rows, setRows] = useState<InternalTransferRequestRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!currentHospital?.id) return;
    setLoading(true);
    let q = (supabase as any)
      .from("internal_transfer_requests")
      .select("*")
      .eq("hospital_unit_id", currentHospital.id)
      .eq("status", "pending")
      .order("signaled_at", { ascending: true });
    if (sectorCode) q = q.eq("target_sector_code", sectorCode);
    const { data, error } = await q;
    if (!error) setRows((data ?? []) as InternalTransferRequestRow[]);
    setLoading(false);
  }, [currentHospital?.id, sectorCode]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!currentHospital?.id) return;
    const ch = supabase
      .channel(`itr-${currentHospital.id}-${sectorCode ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "internal_transfer_requests" }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [currentHospital?.id, sectorCode, refresh]);

  return { rows, loading, refresh };
}
