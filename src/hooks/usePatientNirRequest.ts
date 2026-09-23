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
 *
 * MIGRAÇÃO: `bed_allocation_requests` → `solicitacoes_leito`. `patientId` é
 * `internacoes.id` → filtra por `internacao_id`. Colunas:
 * requested_sector→setor_solicitado_id, rejection_reason→motivo_rejeicao,
 * created_at→criado_em, reviewed_at→atualizado_em.
 * DEGRADADO (sem coluna no schema novo): `requested_bed` e
 * `requesting_doctor_name` → sempre null. `requestedSector` passa a carregar o
 * ID do setor solicitado (setor_solicitado_id), não mais o nome.
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
      .from("solicitacoes_leito")
      .select(
        "id, status, setor_solicitado_id, motivo_rejeicao, criado_em, atualizado_em",
      )
      .eq("internacao_id", patientId)
      .order("criado_em", { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      const r: any = data[0];
      const next: PatientNirRequest = {
        id: r.id,
        status: r.status,
        requestedSector: r.setor_solicitado_id,
        requestedBed: null, // MIGRAÇÃO: sem coluna em solicitacoes_leito
        rejectionReason: r.motivo_rejeicao,
        requestingDoctorName: null, // MIGRAÇÃO: sem coluna em solicitacoes_leito
        createdAt: r.criado_em,
        reviewedAt: r.atualizado_em,
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

  const fetchLatestRef = useRef(fetchLatest);
  useEffect(() => { fetchLatestRef.current = fetchLatest; }, [fetchLatest]);

  useEffect(() => {
    fetchLatest();
  }, [fetchLatest]);

  useEffect(() => {
    if (!patientId) return;
    const channel = supabase
      .channel(`patient-nir-${patientId}`)
      // MIGRAÇÃO: realtime em "solicitacoes_leito" filtrando por internacao_id.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "solicitacoes_leito", filter: `internacao_id=eq.${patientId}` },
        () => fetchLatestRef.current(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId]);

  return { request, loading, refresh: fetchLatest };
}
