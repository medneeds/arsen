import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PatientPendingItem {
  id: string;
  kind: "exam" | "culture";
  category: string; // laboratorio, imagem, hemocultura, urocultura...
  status: string; // pending, completed, etc.
  label: string;
  createdAt: string;
  critical?: boolean;
}

/**
 * Subscribes (realtime) to exam_requests and culture_results for a single patient.
 * Used in the clinical Cockpit's "Exames" tab to surface pending/completed counts
 * without forcing the user to leave the current page.
 *
 * Matching strategy:
 *  - exam_requests: prefer patient_id; fall back to patient_name + hospital_unit_id.
 *  - culture_results: same — patient_id, then patient_name + hospital_unit_id.
 */
export function usePatientPendingItems(
  patientId: string | null,
  patientName: string | null,
  hospitalUnitId: string | null,
) {
  const [items, setItems] = useState<PatientPendingItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!hospitalUnitId || (!patientId && !patientName)) {
      setItems([]);
      return;
    }
    setLoading(true);

    // Exams
    let examQuery = supabase
      .from("exam_requests")
      .select("id, category, status, items, created_at, patient_id, patient_name")
      .eq("hospital_unit_id", hospitalUnitId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (patientId) examQuery = examQuery.eq("patient_id", patientId);
    else if (patientName) examQuery = examQuery.eq("patient_name", patientName.trim());

    // Cultures
    let culQuery = supabase
      .from("culture_results")
      .select("id, culture_type, status, microorganism, created_at, patient_id, patient_name")
      .eq("hospital_unit_id", hospitalUnitId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (patientId) culQuery = culQuery.eq("patient_id", patientId);
    else if (patientName) culQuery = culQuery.eq("patient_name", patientName.trim());

    const [examRes, culRes] = await Promise.all([examQuery, culQuery]);

    const merged: PatientPendingItem[] = [];
    if (!examRes.error && examRes.data) {
      examRes.data.forEach((row: any) => {
        const itemsArr = Array.isArray(row.items) ? row.items : [];
        const firstName = itemsArr[0]?.name || itemsArr[0]?.exam || "Exame";
        merged.push({
          id: row.id,
          kind: "exam",
          category: row.category || "laboratorio",
          status: row.status || "pending",
          label: itemsArr.length > 1 ? `${firstName} +${itemsArr.length - 1}` : firstName,
          createdAt: row.created_at,
        });
      });
    }
    if (!culRes.error && culRes.data) {
      culRes.data.forEach((row: any) => {
        merged.push({
          id: row.id,
          kind: "culture",
          category: row.culture_type || "cultura",
          status: row.status || "pending",
          label: row.microorganism || row.culture_type || "Cultura",
          createdAt: row.created_at,
          critical: Boolean(row.microorganism),
        });
      });
    }
    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setItems(merged);
    setLoading(false);
  }, [patientId, patientName, hospitalUnitId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    if (!hospitalUnitId || (!patientId && !patientName)) return;
    const channel = supabase
      .channel(`patient-pending-${hospitalUnitId}-${patientId || patientName}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "exam_requests", filter: `hospital_unit_id=eq.${hospitalUnitId}` },
        (payload) => {
          const row: any = payload.new || payload.old;
          if (
            (patientId && row?.patient_id === patientId) ||
            (patientName && row?.patient_name?.trim() === patientName.trim())
          ) {
            fetch();
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "culture_results", filter: `hospital_unit_id=eq.${hospitalUnitId}` },
        (payload) => {
          const row: any = payload.new || payload.old;
          if (
            (patientId && row?.patient_id === patientId) ||
            (patientName && row?.patient_name?.trim() === patientName.trim())
          ) {
            fetch();
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId, patientName, hospitalUnitId, fetch]);

  const summary = {
    pendingExams: items.filter((i) => i.kind === "exam" && i.status === "pending").length,
    completedExams: items.filter((i) => i.kind === "exam" && i.status === "completed").length,
    pendingCultures: items.filter((i) => i.kind === "culture" && i.status === "pending").length,
    positiveCultures: items.filter((i) => i.kind === "culture" && i.critical).length,
  };

  return { items, summary, loading, refresh: fetch };
}
