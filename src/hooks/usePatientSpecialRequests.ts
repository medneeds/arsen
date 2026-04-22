import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SpecialKind = "hemocomponente" | "sat" | "apac" | "cultura";

export interface SpecialRequestItem {
  id: string;
  kind: SpecialKind;
  label: string;
  status: string;
  createdAt: string;
  createdByName?: string | null;
  /** Optional secondary info (microorganismo, justificativa, etc.) */
  detail?: string | null;
}

export interface SpecialSummary {
  hemocomponente: number;
  sat: number;
  apac: number;
  cultura: number;
  pending: number;
  total: number;
}

/**
 * Subscribes (realtime) to special requests for a single patient:
 *  - exam_requests filtered by category in ('hemocomponente','sat','apac')
 *  - culture_results (kind='cultura')
 *
 * Used by PatientCockpit and dedicated pages to keep counts in sync across
 * the Cockpit, /requisicoes (Especiais) and /documentos.
 */
export function usePatientSpecialRequests(
  patientId: string | null,
  patientName: string | null,
  hospitalUnitId: string | null,
) {
  const [items, setItems] = useState<SpecialRequestItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!hospitalUnitId || (!patientId && !patientName)) {
      setItems([]);
      return;
    }
    setLoading(true);

    let examQ = supabase
      .from("exam_requests")
      .select("id, category, status, items, created_at, requested_by_name, patient_id, patient_name, clinical_indication")
      .eq("hospital_unit_id", hospitalUnitId)
      .in("category", ["hemocomponente", "sat", "apac", "cultura"])
      .order("created_at", { ascending: false })
      .limit(20);
    if (patientId) examQ = examQ.eq("patient_id", patientId);
    else if (patientName) examQ = examQ.eq("patient_name", patientName.trim());

    let culQ = supabase
      .from("culture_results")
      .select("id, culture_type, status, microorganism, created_at, uploaded_by_name, patient_id, patient_name")
      .eq("hospital_unit_id", hospitalUnitId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (patientId) culQ = culQ.eq("patient_id", patientId);
    else if (patientName) culQ = culQ.eq("patient_name", patientName.trim());

    const [examRes, culRes] = await Promise.all([examQ, culQ]);

    const merged: SpecialRequestItem[] = [];
    if (!examRes.error && examRes.data) {
      examRes.data.forEach((row: any) => {
        const itemsArr = Array.isArray(row.items) ? row.items : [];
        const first = itemsArr[0]?.name || itemsArr[0]?.exam || itemsArr[0]?.label || "";
        let label = first || row.category;
        if (row.category === "hemocomponente") label = first || "Hemocomponentes";
        if (row.category === "sat") label = "Profilaxia antitetânica";
        if (row.category === "apac") label = first || "APAC";
        if (row.category === "cultura") label = first || "Solicitação de cultura";
        merged.push({
          id: row.id,
          kind: row.category as SpecialKind,
          label,
          status: row.status || "pending",
          createdAt: row.created_at,
          createdByName: row.requested_by_name,
          detail: row.clinical_indication || null,
        });
      });
    }
    if (!culRes.error && culRes.data) {
      culRes.data.forEach((row: any) => {
        merged.push({
          id: row.id,
          kind: "cultura",
          label: row.culture_type || "Cultura",
          status: row.status || "pending",
          createdAt: row.created_at,
          createdByName: row.uploaded_by_name,
          detail: row.microorganism || null,
        });
      });
    }
    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setItems(merged);
    setLoading(false);
  }, [patientId, patientName, hospitalUnitId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!hospitalUnitId || (!patientId && !patientName)) return;
    const channel = supabase
      .channel(`patient-special-${hospitalUnitId}-${patientId || patientName}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "exam_requests", filter: `hospital_unit_id=eq.${hospitalUnitId}` },
        (payload) => {
          const row: any = payload.new || payload.old;
          if (!row) return;
          if (!["hemocomponente", "sat", "apac", "cultura"].includes(row.category)) return;
          if (
            (patientId && row.patient_id === patientId) ||
            (patientName && row.patient_name?.trim() === patientName.trim())
          ) {
            fetchAll();
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "culture_results", filter: `hospital_unit_id=eq.${hospitalUnitId}` },
        (payload) => {
          const row: any = payload.new || payload.old;
          if (!row) return;
          if (
            (patientId && row.patient_id === patientId) ||
            (patientName && row.patient_name?.trim() === patientName.trim())
          ) {
            fetchAll();
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId, patientName, hospitalUnitId, fetchAll]);

  const summary: SpecialSummary = {
    hemocomponente: items.filter((i) => i.kind === "hemocomponente").length,
    sat: items.filter((i) => i.kind === "sat").length,
    apac: items.filter((i) => i.kind === "apac").length,
    cultura: items.filter((i) => i.kind === "cultura").length,
    pending: items.filter((i) => i.status === "pending").length,
    total: items.length,
  };

  return { items, summary, loading, refresh: fetchAll };
}
