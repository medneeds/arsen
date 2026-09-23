import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export type BedStatus =
  | "livre"
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
 * Hook unificado de ações operacionais do NIR sobre leitos.
 *
 * MIGRAÇÃO: `bed_census` (mega-tabela de censo com dados do paciente embutidos)
 * → `leitos`. `leitos` só modela status e bloqueio do leito físico
 * (status, motivo_bloqueio); a ocupação/paciente vive em `internacoes.leito_id`.
 * Campos do payload sem coluna em `leitos` são DEGRADADOS (ignorados na escrita):
 * patient_name, patient_id, reserved_for, reserved_until, updated_by,
 * updated_by_name. O ciclo de timestamps antes mantido pelo trigger
 * `bed_census_track_status()` também não existe → só atualizamos status/bloqueio.
 */
export function useBedCensusActions() {
  const qc = useQueryClient();

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["nir-bed-census"] });
  }, [qc]);

  const updateBed = useCallback(
    async (bedId: string, payload: BedActionPayload, successMsg: string) => {
      // MIGRAÇÃO: mapeia só o que existe em `leitos`; o resto do payload é ignorado.
      const updates: Record<string, any> = {};
      if (payload.status !== undefined) updates.status = payload.status;
      if (payload.block_reason !== undefined) updates.motivo_bloqueio = payload.block_reason;
      // MIGRAÇÃO: patient_name/patient_id/reserved_for/reserved_until/updated_by/
      // updated_by_name não têm coluna em `leitos` → não gravados.

      const { error } = await supabase.from("leitos").update(updates).eq("id", bedId);

      if (error) {
        toast({ title: "Erro ao atualizar leito", description: error.message, variant: "destructive" });
        return false;
      }
      toast({ title: successMsg });
      invalidate();
      return true;
    },
    [invalidate],
  );

  // ---- Ações de alto nível ----
  const occupyBed = (bedId: string, patientName: string) =>
    // MIGRAÇÃO: patient_name não é persistido em `leitos` (ocupação vem de internacoes).
    updateBed(bedId, { status: "ocupado", patient_name: patientName }, "Leito marcado como ocupado");

  const giveMedicalDischarge = (bedId: string) =>
    updateBed(bedId, { status: "ocupado" }, "Alta médica registrada");

  const giveAdministrativeDischarge = (bedId: string) =>
    updateBed(
      bedId,
      { status: "higienizacao", patient_name: null, patient_id: null },
      "Alta administrativa registrada · leito em higienização",
    );

  const startCleaning = (bedId: string) =>
    updateBed(bedId, { status: "higienizacao" }, "Higienização iniciada");

  const finishCleaning = (bedId: string) =>
    updateBed(bedId, { status: "livre" }, "Leito liberado para nova admissão");

  const blockBed = (bedId: string, reason: string, mode: "bloqueado" | "manutencao" | "interditado") =>
    updateBed(bedId, { status: mode, block_reason: reason }, `Leito ${mode}`);

  const unblockBed = (bedId: string) =>
    updateBed(bedId, { status: "livre", block_reason: null }, "Leito desbloqueado");

  const reserveBed = (bedId: string, reservedFor: string, hours: number = 4) => {
    // MIGRAÇÃO: reserved_for/reserved_until sem coluna em `leitos` → só o status muda.
    const until = new Date(Date.now() + hours * 3600_000).toISOString();
    return updateBed(
      bedId,
      { status: "reservado", reserved_for: reservedFor, reserved_until: until },
      `Leito reservado por ${hours}h`,
    );
  };

  const releaseReservation = (bedId: string) =>
    updateBed(bedId, { status: "livre", reserved_for: null, reserved_until: null }, "Reserva liberada");

  /**
   * MIGRAÇÃO: a permuta antiga trocava patient_id/patient_name entre dois
   * `bed_census`. No schema novo a ocupação é `internacoes.leito_id`, e uma troca
   * atômica sem violar unicidade (leito_id NOT NULL, possível índice único de
   * internação ativa por leito) exige uma RPC dedicada — inexistente. Degradado:
   * retorna erro explicativo. Assinatura preservada.
   */
  const swapBeds = async (bedAId: string, bedBId: string) => {
    if (bedAId === bedBId) return false;
    toast({
      title: "Permuta indisponível",
      description:
        "A permuta de leitos ainda não foi migrada para o schema novo (requer RPC atômica de troca de internação).",
      variant: "destructive",
    });
    return false;
  };

  /**
   * MIGRAÇÃO: transfere o paciente movendo a internação ativa do leito de origem
   * para o de destino (`internacoes.leito_id`), e ajusta o status dos dois leitos.
   */
  const transferBed = async (originBedId: string, destinationBedId: string) => {
    // Internação ativa (data_alta nula) no leito de origem.
    const { data: originInt, error: e1 } = await supabase
      .from("internacoes")
      .select("id")
      .eq("leito_id", originBedId)
      .is("data_alta", null)
      .maybeSingle();
    if (e1) {
      toast({ title: "Erro", description: "Não foi possível ler o leito de origem.", variant: "destructive" });
      return false;
    }
    if (!originInt) {
      toast({ title: "Origem sem paciente", variant: "destructive" });
      return false;
    }

    const { error: eMove } = await supabase
      .from("internacoes")
      .update({ leito_id: destinationBedId })
      .eq("id", (originInt as any).id);
    if (eMove) {
      toast({ title: "Erro na transferência", description: eMove.message, variant: "destructive" });
      return false;
    }

    await supabase.from("leitos").update({ status: "ocupado" }).eq("id", destinationBedId);
    const ok = await updateBed(originBedId, { status: "higienizacao" }, "Leito de origem em higienização");
    if (ok) {
      toast({ title: "Paciente movido para o novo leito" });
      invalidate();
    }
    return ok;
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
    swapBeds,
    updateBed,
  };
}
