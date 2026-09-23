import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";
import { useDepartment } from "@/contexts/DepartmentContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

// MIGRAÇÃO: bed_allocation_requests → solicitacoes_leito.
// Colunas novas: id, internacao_id, setor_solicitado_id, status, motivo_rejeicao,
// data_hora, solicitado_por, avaliado_por, criado_em, atualizado_em.
// Vários campos do modelo antigo (requested_bed, requesting_doctor_name,
// requesting_office_number, reviewed_at, state_id, hospital_unit_id, department)
// NÃO têm coluna equivalente e foram degradados — ver MIGRACAO_DEGRADACOES.md.
// `patient_id` do modelo antigo passa a ser `internacao_id` (patientId == internacao.id).
// `requested_sector` passa a carregar o `setor_solicitado_id`.
// `*_por` referenciam profissionais.id (≠ auth.uid) — resolvidos via lookup.

/** Resolve profissionais.id a partir do auth user id (profissional_id ≠ auth.uid). */
async function resolveProfissionalId(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data } = await supabase
      .from("profissionais")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    return (data as any)?.id ?? null;
  } catch {
    return null;
  }
}

export interface BedAllocationRequest {
  id: string;
  patient_id: string;
  requested_by: string;
  requested_sector: string;
  requested_bed: string | null;
  status: "pending" | "approved" | "discussing" | "rejected";
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  state_id: string;
  hospital_unit_id: string;
  department: string;
  created_at: string;
  updated_at: string;
  requesting_doctor_name: string | null;
  requesting_office_number: string | null;
  // Joined patient data
  patient?: {
    id: string;
    name: string;
    age: string | null;
    diagnoses: string | null;
    medical_history: string | null;
    relevant_exams: string | null;
    pendencies: string | null;
    admission_history: string | null;
    bed_number: string;
    sector: string;
  };
}

/** Converte uma linha de solicitacoes_leito (+ internacao embutida) no view-model estável. */
function mapRequest(row: any): BedAllocationRequest {
  const inter = row.internacao ?? null;
  const paciente = inter?.paciente ?? null;
  const patient = inter
    ? {
        id: inter.id,
        name: paciente?.nome_social || paciente?.nome_completo || "",
        age: null, // MIGRAÇÃO: idade não é coluna; derivar de data_nascimento no consumidor se necessário
        diagnoses: inter.hipotese_diagnostica ?? null,
        medical_history: inter.historia_clinica ?? null,
        relevant_exams: inter.exames_relevantes ?? null,
        pendencies: inter.pendencias ?? null,
        admission_history: null, // MIGRAÇÃO: sem coluna equivalente
        bed_number: inter.leito?.numero ?? "",
        sector: inter.setor?.nome ?? "",
      }
    : undefined;

  return {
    id: row.id,
    patient_id: row.internacao_id,
    requested_by: row.solicitado_por ?? "",
    requested_sector: row.setor_solicitado_id ?? "",
    requested_bed: null, // MIGRAÇÃO: sem coluna
    status: row.status,
    rejection_reason: row.motivo_rejeicao ?? null,
    reviewed_by: row.avaliado_por ?? null,
    reviewed_at: row.atualizado_em ?? null, // MIGRAÇÃO: sem reviewed_at dedicado; usa atualizado_em
    state_id: "", // MIGRAÇÃO: sem coluna
    hospital_unit_id: "", // MIGRAÇÃO: sem coluna
    department: "", // MIGRAÇÃO: sem coluna
    created_at: row.criado_em,
    updated_at: row.atualizado_em,
    requesting_doctor_name: null, // MIGRAÇÃO: sem coluna
    requesting_office_number: null, // MIGRAÇÃO: sem coluna
    patient,
  };
}

export function useBedAllocationRequests() {
  const [requests, setRequests] = useState<BedAllocationRequest[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { currentHospital, currentState } = useHospital();
  const { currentDepartment } = useDepartment();
  const { user } = useAuth();

  const fetchRequests = useCallback(async () => {
    // MIGRAÇÃO: solicitacoes_leito não tem hospital_unit_id/state_id/department;
    // o escopo por hospital/estado/setor foi degradado (traz todas as solicitações).
    if (!currentHospital?.id || !currentState?.id) return;

    try {
      const { data, error } = await supabase
        .from("solicitacoes_leito")
        .select(`
          *,
          internacao:internacoes(
            id, hipotese_diagnostica, historia_clinica, exames_relevantes, pendencias,
            leito:leitos(numero),
            setor:setores(nome),
            paciente:pacientes(nome_completo, nome_social, data_nascimento)
          )
        `)
        .order("criado_em", { ascending: false });

      if (error) throw error;

      const mapped = ((data as any) || []).map(mapRequest);
      setRequests(mapped);
      setPendingCount(mapped.filter((r) => r.status === "pending").length);
    } catch (error) {
      console.error("Error fetching bed allocation requests:", error);
    } finally {
      setLoading(false);
    }
  }, [currentHospital?.id, currentState?.id, currentDepartment]);

  const fetchRequestsRef = useRef(fetchRequests);
  useEffect(() => { fetchRequestsRef.current = fetchRequests; }, [fetchRequests]);

  // Realtime subscription
  useEffect(() => {
    if (!currentHospital?.id) return;

    // MIGRAÇÃO: sem hospital_unit_id em solicitacoes_leito → sem filtro no realtime.
    const channel = supabase
      .channel("bed-allocation-requests-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "solicitacoes_leito",
        },
        (payload) => {
          console.log("Realtime update"); // auditoria 18/09: payload continha dados do paciente
          fetchRequestsRef.current();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentHospital?.id]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const createRequest = async (
    patientId: string,
    requestedSector: string,
    requestedBed?: string,
    doctorName?: string,
    officeNumber?: string
  ) => {
    if (!currentHospital?.id || !currentState?.id || !user?.id) {
      toast({
        title: "Erro",
        description: "Dados de contexto não disponíveis",
        variant: "destructive",
      });
      return null;
    }

    try {
      const solicitadoPor = await resolveProfissionalId(user.id);
      // MIGRAÇÃO: requested_bed / requesting_doctor_name / requesting_office_number /
      // state_id / hospital_unit_id / department não têm coluna e foram removidos do payload.
      // `requestedSector` é gravado como setor_solicitado_id (id do setor destino).
      const { data, error } = await supabase
        .from("solicitacoes_leito")
        .insert({
          internacao_id: patientId,
          setor_solicitado_id: requestedSector,
          solicitado_por: solicitadoPor,
          status: "pending",
        } as any)
        .select()
        .single();

      if (error) throw error;

      // MIGRAÇÃO: patients.allocation_status não existe no schema novo (campo
      // degradado — ver MIGRACAO_DEGRADACOES.md). Atualização de status do
      // paciente removida.

      toast({
        title: "Solicitação enviada",
        description: "O líder será notificado sobre sua solicitação de alocação.",
      });

      return data;
    } catch (error) {
      console.error("Error creating bed allocation request:", error);
      toast({
        title: "Erro",
        description: "Falha ao enviar solicitação de alocação",
        variant: "destructive",
      });
      return null;
    }
  };

  const approveRequest = async (requestId: string) => {
    if (!user?.id || !currentHospital?.id) return false;

    try {
      let request = requests.find((r) => r.id === requestId);

      if (!request) {
        const { data, error } = await supabase
          .from("solicitacoes_leito")
          .select("*")
          .eq("id", requestId)
          .single();

        if (error || !data) {
          throw new Error("Solicitação não encontrada");
        }
        request = mapRequest(data);
      }

      const avaliadoPor = await resolveProfissionalId(user.id);

      // Update request status
      const { error: updateError } = await supabase
        .from("solicitacoes_leito")
        .update({
          status: "approved",
          avaliado_por: avaliadoPor,
        } as any)
        .eq("id", requestId);

      if (updateError) throw updateError;

      // MIGRAÇÃO: no schema antigo a aprovação calculava o próximo número de leito
      // (getNextBedNumber, lendo `patients`) e movia o paciente para setor+leito.
      // `patients` não existe mais; a alocação física (leito_id) é responsabilidade
      // de outro fluxo. Aqui apenas registramos o setor de classificação aprovado.
      if (request?.patient_id && request?.requested_sector) {
        try {
          await supabase
            .from("internacoes")
            .update({ setor_classificacao_id: request.requested_sector } as any)
            .eq("id", request.patient_id);
        } catch (e) {
          console.warn("[useBedAllocationRequests] falha ao atualizar setor da internação:", e);
        }
      }

      toast({
        title: "✓ Alocação aprovada",
        description: `Solicitação aprovada para ${request?.requested_sector ?? "o setor destino"}.`,
      });

      await fetchRequests();

      return true;
    } catch (error) {
      console.error("Error approving request:", error);
      toast({
        title: "Erro",
        description: "Falha ao aprovar alocação",
        variant: "destructive",
      });
      return false;
    }
  };

  const setDiscussing = async (requestId: string) => {
    if (!user?.id) return false;

    try {
      const avaliadoPor = await resolveProfissionalId(user.id);
      const { error } = await supabase
        .from("solicitacoes_leito")
        .update({
          status: "discussing",
          avaliado_por: avaliadoPor,
        } as any)
        .eq("id", requestId);

      if (error) throw error;

      // MIGRAÇÃO: patients.allocation_status removido (campo degradado).

      toast({
        title: "Em discussão",
        description: "Médico da porta será notificado sobre a discussão do caso.",
      });

      await fetchRequests();

      return true;
    } catch (error) {
      console.error("Error setting discussing status:", error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar status",
        variant: "destructive",
      });
      return false;
    }
  };

  const rejectRequest = async (requestId: string, reason?: string) => {
    if (!user?.id) return false;

    try {
      const avaliadoPor = await resolveProfissionalId(user.id);
      const { error } = await supabase
        .from("solicitacoes_leito")
        .update({
          status: "rejected",
          motivo_rejeicao: reason || null,
          avaliado_por: avaliadoPor,
        } as any)
        .eq("id", requestId);

      if (error) throw error;

      // MIGRAÇÃO: patients.allocation_status removido (campo degradado).

      toast({
        title: "Solicitação negada",
        description: "Médico da porta será notificado sobre a negação.",
      });

      await fetchRequests();

      return true;
    } catch (error) {
      console.error("Error rejecting request:", error);
      toast({
        title: "Erro",
        description: "Falha ao negar solicitação",
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    requests,
    pendingCount,
    loading,
    createRequest,
    approveRequest,
    setDiscussing,
    rejectRequest,
    refetch: fetchRequests,
  };
}
