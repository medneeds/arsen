import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export type BedStatus =
  | "vago"
  | "ocupado"
  | "higienizacao"
  | "alta_medica_dada"
  | "bloqueado"
  | "manutencao"
  | "interditado"
  | "reservado";

export interface BedActionPayload {
  status?: BedStatus;
  patient_name?: string | null;
  patient_id?: string | null;
  block_reason?: string | null;
  reserved_for?: string | null;
  reserved_until?: string | null;
}

/**
 * Hook unificado de ações operacionais do NIR sobre bed_census.
 * O trigger bed_census_track_status() já mantém os timestamps do ciclo
 * (admission_at, medical_discharge_at, cleaning_started_at, etc.) — aqui
 * apenas atualizamos o status e os campos de contexto.
 */
export function useBedCensusActions() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["nir-bed-census"] });
  }, [qc]);

  const updateBed = useCallback(
    async (bedId: string, payload: BedActionPayload, successMsg: string) => {
      const updates: Record<string, any> = {
        ...payload,
        updated_by: user?.id ?? null,
        updated_by_name: user?.email?.split("@")[0]?.toUpperCase() ?? "NIR",
      };

      const { error } = await supabase.from("bed_census").update(updates).eq("id", bedId);

      if (error) {
        toast({ title: "Erro ao atualizar leito", description: error.message, variant: "destructive" });
        return false;
      }
      toast({ title: successMsg });
      invalidate();
      return true;
    },
    [user, invalidate],
  );

  // ---- Ações de alto nível ----
  const occupyBed = (bedId: string, patientName: string) =>
    updateBed(bedId, { status: "ocupado", patient_name: patientName }, "Leito marcado como ocupado");

  const giveMedicalDischarge = (bedId: string) =>
    updateBed(bedId, { status: "alta_medica_dada" }, "Alta médica registrada");

  const giveAdministrativeDischarge = (bedId: string) =>
    updateBed(
      bedId,
      { status: "higienizacao", patient_name: null, patient_id: null },
      "Alta administrativa registrada · leito em higienização",
    );

  const startCleaning = (bedId: string) =>
    updateBed(bedId, { status: "higienizacao" }, "Higienização iniciada");

  const finishCleaning = (bedId: string) =>
    updateBed(bedId, { status: "vago" }, "Leito liberado para nova admissão");

  const blockBed = (bedId: string, reason: string, mode: "bloqueado" | "manutencao" | "interditado") =>
    updateBed(bedId, { status: mode, block_reason: reason }, `Leito ${mode}`);

  const unblockBed = (bedId: string) =>
    updateBed(bedId, { status: "vago", block_reason: null }, "Leito desbloqueado");

  const reserveBed = (bedId: string, reservedFor: string, hours: number = 4) => {
    const until = new Date(Date.now() + hours * 3600_000).toISOString();
    return updateBed(
      bedId,
      { status: "reservado", reserved_for: reservedFor, reserved_until: until },
      `Leito reservado por ${hours}h`,
    );
  };

  const releaseReservation = (bedId: string) =>
    updateBed(bedId, { status: "vago", reserved_for: null, reserved_until: null }, "Reserva liberada");

  /**
   * Permuta os pacientes entre dois leitos OCUPADOS.
   * Usa um leito-pivô (em memória) para evitar conflito de unique de paciente.
   */
  const swapBeds = async (bedAId: string, bedBId: string) => {
    if (bedAId === bedBId) return false;
    const { data: rows, error: eFetch } = await supabase
      .from("bed_census")
      .select("id, patient_id, patient_name, status")
      .in("id", [bedAId, bedBId]);
    if (eFetch || !rows || rows.length !== 2) {
      toast({ title: "Erro", description: "Não foi possível ler os leitos.", variant: "destructive" });
      return false;
    }
    const a = rows.find((r) => r.id === bedAId)!;
    const b = rows.find((r) => r.id === bedBId)!;
    if (!a.patient_name || !b.patient_name) {
      toast({ title: "Permuta exige dois leitos ocupados", variant: "destructive" });
      return false;
    }
    // Etapa 1: limpa A para liberar o paciente (evita colisão se houver unique)
    const { error: e1 } = await supabase
      .from("bed_census")
      .update({ patient_id: null, patient_name: null, updated_by: user?.id ?? null })
      .eq("id", bedAId);
    if (e1) {
      toast({ title: "Erro na permuta", description: e1.message, variant: "destructive" });
      return false;
    }
    // Etapa 2: B recebe paciente de A
    const { error: e2 } = await supabase
      .from("bed_census")
      .update({ status: "ocupado", patient_id: a.patient_id, patient_name: a.patient_name, updated_by: user?.id ?? null })
      .eq("id", bedBId);
    if (e2) {
      // rollback A
      await supabase.from("bed_census").update({ status: "ocupado", patient_id: a.patient_id, patient_name: a.patient_name }).eq("id", bedAId);
      toast({ title: "Erro na permuta", description: e2.message, variant: "destructive" });
      return false;
    }
    // Etapa 3: A recebe paciente de B
    const { error: e3 } = await supabase
      .from("bed_census")
      .update({ status: "ocupado", patient_id: b.patient_id, patient_name: b.patient_name, updated_by: user?.id ?? null })
      .eq("id", bedAId);
    if (e3) {
      toast({ title: "Erro na permuta (etapa final)", description: e3.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Permuta realizada", description: `${a.patient_name} ↔ ${b.patient_name}` });
    invalidate();
    return true;
  };

  const transferBed = async (originBedId: string, destinationBedId: string) => {
    // Buscar paciente do origem
    const { data: origin, error: e1 } = await supabase
      .from("bed_census")
      .select("patient_id, patient_name")
      .eq("id", originBedId)
      .single();
    if (e1 || !origin) {
      toast({ title: "Erro", description: "Leito de origem não encontrado", variant: "destructive" });
      return false;
    }
    if (!origin.patient_name) {
      toast({ title: "Origem sem paciente", variant: "destructive" });
      return false;
    }
    const ok1 = await updateBed(
      destinationBedId,
      { status: "ocupado", patient_id: origin.patient_id, patient_name: origin.patient_name },
      "Paciente movido para o novo leito",
    );
    if (!ok1) return false;
    return updateBed(
      originBedId,
      { status: "higienizacao", patient_id: null, patient_name: null },
      "Leito de origem em higienização",
    );
  };

  return {
    occupyBed,
    giveMedicalDischarge,
    giveAdministrativeDischarge,
    startCleaning,
    finishCleaning,
    blockBed,
    unblockBed,
    reserveBed,
    releaseReservation,
    transferBed,
    updateBed,
  };
}
