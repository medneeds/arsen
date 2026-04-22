import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PatientNirRequest {
  id: string;
  status: "pending" | "approved" | "discussing" | "rejected" | string;
  requestedSector: string;
  requestedBed: string | null;
  rejectionReason: string | null;
  requestingDoctorName: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

/**
 * Realtime: solicitação de leito (NIR) mais recente para o paciente.
 * Dispara toast quando o status muda (aprovada/rejeitada/em discussão).
 */
export function usePatientNirRequest(patientId: string | null) {
  const [request, setRequest] = useState<PatientNirRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const lastStatusRef = useRef<string | null>(null);

  const fetchLatest = useCallback(async () => {
    if (!patientId) {
      setRequest(null);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("bed_allocation_requests")
      .select(
        "id, status, requested_sector, requested_bed, rejection_reason, requesting_doctor_name, created_at, reviewed_at",
      )
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      const r: any = data[0];
      const next: PatientNirRequest = {
        id: r.id,
        status: r.status,
        requestedSector: r.requested_sector,
        requestedBed: r.requested_bed,
        rejectionReason: r.rejection_reason,
        requestingDoctorName: r.requesting_doctor_name,
        createdAt: r.created_at,
        reviewedAt: r.reviewed_at,
      };
      // Toast em mudança de status (excluindo a primeira carga)
      if (lastStatusRef.current && lastStatusRef.current !== next.status) {
        if (next.status === "approved") {
          toast.success("Solicitação de leito aprovada", {
            description: `Setor ${next.requestedSector}${next.requestedBed ? ` • Leito ${next.requestedBed}` : ""}`,
          });
        } else if (next.status === "rejected") {
          toast.error("Solicitação de leito rejeitada", {
            description: next.rejectionReason || "Sem justificativa registrada",
          });
        } else if (next.status === "discussing") {
          toast.info("Solicitação de leito em discussão", {
            description: `Setor ${next.requestedSector}`,
          });
        }
      }
      lastStatusRef.current = next.status;
      setRequest(next);
    } else {
      setRequest(null);
      lastStatusRef.current = null;
    }
    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    fetchLatest();
  }, [fetchLatest]);

  useEffect(() => {
    if (!patientId) return;
    const channel = supabase
      .channel(`patient-nir-${patientId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bed_allocation_requests", filter: `patient_id=eq.${patientId}` },
        () => fetchLatest(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId, fetchLatest]);

  return { request, loading, refresh: fetchLatest };
}
