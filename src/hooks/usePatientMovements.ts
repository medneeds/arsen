import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PatientMovement {
  id: string;
  movementType: string;
  destination: string | null;
  patientSector: string | null;
  patientBed: string | null;
  releaseStatus: string;
  releasedAt: string | null;
  createdAt: string;
  notes: string | null;
}

/**
 * Realtime list of patient_movements for a given patient.
 * Tries patient_id first; falls back to patient_name + hospital_unit_id.
 */
export function usePatientMovements(
  patientId: string | null,
  patientName: string | null,
  hospitalUnitId: string | null,
) {
  const [movements, setMovements] = useState<PatientMovement[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMovements = useCallback(async () => {
    if (!patientId && !patientName) { setMovements([]); return; }
    setLoading(true);
    let query = supabase
      .from("patient_movements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(15);

    if (patientId) {
      query = query.eq("patient_id", patientId);
    } else if (patientName && hospitalUnitId) {
      query = query.eq("patient_name", patientName).eq("hospital_unit_id", hospitalUnitId);
    }

    const { data, error } = await query;
    if (!error && data) {
      setMovements(data.map((r: any) => ({
        id: r.id,
        movementType: r.movement_type,
        destination: r.destination,
        patientSector: r.patient_sector,
        patientBed: r.patient_bed,
        releaseStatus: r.release_status,
        releasedAt: r.released_at,
        createdAt: r.created_at,
        notes: r.notes,
      })));
    }
    setLoading(false);
  }, [patientId, patientName, hospitalUnitId]);

  useEffect(() => { fetchMovements(); }, [fetchMovements]);

  useEffect(() => {
    if (!patientId && !(patientName && hospitalUnitId)) return;
    const key = patientId || `${hospitalUnitId}-${patientName}`;
    const channel = supabase
      .channel(`patient-movements-${key}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "patient_movements" },
        (payload) => {
          const row: any = payload.new || payload.old;
          if (!row) return;
          const matches = patientId
            ? row.patient_id === patientId
            : row.patient_name === patientName && row.hospital_unit_id === hospitalUnitId;
          if (matches) fetchMovements();
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [patientId, patientName, hospitalUnitId, fetchMovements]);

  return { movements, loading, refresh: fetchMovements };
}
