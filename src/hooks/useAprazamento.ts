import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { ValidityWindow } from "@/lib/prescriptionValidity";

/**
 * Aprazamento e checagem da internacao numa vigencia (12h -> 12h).
 * Prescricao: MESMA regra do card de prescricao ativa (ultima nao-rascunho).
 * Tabelas com RLS (etapa 4b): enfermeiro apraza/cancela; tecnico e enfermeiro
 * checam; dupla checagem MAV por outro profissional; o ganho no BH e gerado
 * pelo banco ao checar dose realizada com volume. Nasce com tempo real.
 */
export interface PrescricaoAtiva { id: string; status: string; itens: unknown; criado_em: string; atualizado_em: string | null }

export interface AprazamentoRow {
  id: string; internacao_id: string; prescricao_id: string; item_id: string; item_nome: string; item_resumo: string | null;
  janela_inicio: string; horario: string; modo: string; motivo: string | null; mav: boolean;
  volume_ml: number | null; bh_categoria: string | null; aprazado_por_nome: string | null; aprazado_em: string;
  cancelado_em: string | null; cancelado_por_nome: string | null; motivo_cancelamento: string | null;
}

export interface AdministracaoRow {
  id: string; internacao_id: string; aprazamento_id: string | null; prescricao_id: string; item_id: string; item_nome: string;
  status: "realizado" | "nao_realizado"; realizado_em: string; motivo: string | null; volume_ml: number | null;
  bh_categoria: string | null; mav: boolean; registrado_por: string; registrado_por_nome: string | null;
  dupla_checagem_por_nome: string | null; dupla_checagem_em: string | null;
  anulado_em: string | null; motivo_anulacao: string | null; criado_em: string;
}

export interface NovoHorario {
  prescricaoId: string; itemId: string; itemNome: string; itemResumo: string; horario: Date;
  modo: "padrao" | "alternativo" | "livre" | "agora" | "prescricao"; motivo: string; mav: boolean;
  volumeMl: number | null; bhCategoria: string | null;
}

export interface NovaChecagem {
  aprazamentoId: string | null; prescricaoId: string; itemId: string; itemNome: string;
  status: "realizado" | "nao_realizado"; realizadoEm: Date; motivo?: string; volumeMl: number | null;
  bhCategoria: string | null; mav: boolean;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));
const HOUR_MS = 3_600_000;

export function useAprazamento(internacaoId: string | null, janela: ValidityWindow) {
  const qc = useQueryClient();
  const startIso = janela.start.toISOString();
  const keyP = useMemo(() => ["apz-prescricao", internacaoId], [internacaoId]);
  const keyA = useMemo(() => ["apz-horarios", internacaoId, startIso], [internacaoId, startIso]);
  const keyD = useMemo(() => ["apz-checagens", internacaoId, startIso], [internacaoId, startIso]);

  const prescQ = useQuery({
    queryKey: keyP,
    enabled: !!internacaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prescricoes")
        .select("id, status, itens, criado_em, atualizado_em")
        .eq("internacao_id", internacaoId as string)
        .neq("status", "draft")
        .order("criado_em", { ascending: false })
        .limit(1);
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as PrescricaoAtiva | null;
    },
  });

  const apzQ = useQuery({
    queryKey: keyA,
    enabled: !!internacaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aprazamentos")
        .select("*")
        .eq("internacao_id", internacaoId as string)
        .eq("janela_inicio", startIso)
        .order("horario", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AprazamentoRow[];
    },
  });

  const admQ = useQuery({
    queryKey: keyD,
    enabled: !!internacaoId,
    queryFn: async () => {
      // dose das 11h checada as 12h30 cai fora da vigencia: margem de 3h
      const { data, error } = await supabase
        .from("administracoes")
        .select("*")
        .eq("internacao_id", internacaoId as string)
        .gte("realizado_em", startIso)
        .lt("realizado_em", new Date(janela.end.getTime() + 3 * HOUR_MS).toISOString())
        .order("realizado_em", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AdministracaoRow[];
    },
  });

  useEffect(() => {
    if (!internacaoId) return;
    const ch = supabase
      .channel(`apz-${internacaoId}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "aprazamentos", filter: `internacao_id=eq.${internacaoId}` },
        () => { qc.invalidateQueries({ queryKey: ["apz-horarios", internacaoId] }); })
      .on("postgres_changes", { event: "*", schema: "public", table: "administracoes", filter: `internacao_id=eq.${internacaoId}` },
        () => { qc.invalidateQueries({ queryKey: ["apz-checagens", internacaoId] }); qc.invalidateQueries({ queryKey: ["bh-lancamentos", internacaoId] }); })
      .on("postgres_changes", { event: "*", schema: "public", table: "prescricoes", filter: `internacao_id=eq.${internacaoId}` },
        () => { qc.invalidateQueries({ queryKey: ["apz-prescricao", internacaoId] }); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [internacaoId, qc]);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["apz-horarios", internacaoId] });
    qc.invalidateQueries({ queryKey: ["apz-checagens", internacaoId] });
    qc.invalidateQueries({ queryKey: ["bh-lancamentos", internacaoId] });
  };

  const aprazar = useMutation({
    mutationFn: async (hs: NovoHorario[]) => {
      if (!hs.length) return 0;
      const { data, error } = await supabase.from("aprazamentos").insert(hs.map((h) => ({
        internacao_id: internacaoId as string,
        prescricao_id: h.prescricaoId,
        item_id: h.itemId,
        item_nome: h.itemNome,
        item_resumo: h.itemResumo || null,
        janela_inicio: startIso,
        horario: h.horario.toISOString(),
        modo: h.modo,
        motivo: h.motivo || null,
        mav: h.mav,
        volume_ml: h.volumeMl,
        bh_categoria: h.bhCategoria,
      }))).select("id");
      if (error) throw error;
      if (!data || data.length !== hs.length) throw new Error("Sem permissão para aprazar (somente enfermeiro)");
      return data.length;
    },
    onSuccess: (n) => { invalidar(); if (n) toast.success(`${n} horário(s) aprazado(s)`); },
    onError: (e) => toast.error("Aprazamento não registrado", { description: errMsg(e) }),
  });

  const cancelar = useMutation({
    mutationFn: async ({ ids, motivo }: { ids: string[]; motivo: string }) => {
      const { data, error } = await supabase
        .from("aprazamentos")
        .update({ cancelado_em: new Date().toISOString(), motivo_cancelamento: motivo.trim() })
        .in("id", ids)
        .select("id");
      if (error) throw error;
      if (!data || data.length !== ids.length) throw new Error("Sem permissão para cancelar (somente enfermeiro)");
      return data.length;
    },
    onSuccess: (n) => { invalidar(); toast.success(`${n} horário(s) cancelado(s)`); },
    onError: (e) => toast.error("Cancelamento não registrado", { description: errMsg(e) }),
  });

  const checar = useMutation({
    mutationFn: async (c: NovaChecagem) => {
      const { data, error } = await supabase.from("administracoes").insert({
        internacao_id: internacaoId as string,
        aprazamento_id: c.aprazamentoId,
        prescricao_id: c.prescricaoId,
        item_id: c.itemId,
        item_nome: c.itemNome,
        status: c.status,
        realizado_em: c.realizadoEm.toISOString(),
        motivo: c.motivo?.trim() || null,
        volume_ml: c.status === "realizado" ? c.volumeMl : null,
        bh_categoria: c.status === "realizado" && c.volumeMl ? c.bhCategoria : null,
        mav: c.mav,
      }).select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Sem permissão para checar (técnico ou enfermeiro)");
    },
    onSuccess: (_d, c) => {
      invalidar();
      toast.success(c.status === "realizado" ? "Dose checada" : "Registrado como não realizado",
        { description: c.status === "realizado" && c.volumeMl && c.bhCategoria ? `${c.volumeMl} mL lançados no balanço hídrico` : undefined });
    },
    onError: (e) => toast.error("Checagem não registrada", { description: errMsg(e) }),
  });

  const anularChecagem = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { data, error } = await supabase
        .from("administracoes")
        .update({ anulado_em: new Date().toISOString(), motivo_anulacao: motivo.trim() })
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Sem permissão para anular esta checagem");
    },
    onSuccess: () => { invalidar(); toast.success("Checagem anulada", { description: "O ganho no balanço hídrico também foi anulado" }); },
    onError: (e) => toast.error("Não foi possível anular", { description: errMsg(e) }),
  });

  const duplaChecagem = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("administracoes")
        .update({ dupla_checagem_em: new Date().toISOString() })
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Sem permissão para a dupla checagem");
    },
    onSuccess: () => { invalidar(); toast.success("Dupla checagem registrada"); },
    onError: (e) => toast.error("Dupla checagem não registrada", { description: errMsg(e) }),
  });

  return {
    prescricao: prescQ.data ?? null,
    horarios: apzQ.data ?? [],
    checagens: admQ.data ?? [],
    carregando: prescQ.isLoading || apzQ.isLoading || admQ.isLoading,
    erro: prescQ.error || apzQ.error || admQ.error,
    aprazar, cancelar, checar, anularChecagem, duplaChecagem,
  };
}
