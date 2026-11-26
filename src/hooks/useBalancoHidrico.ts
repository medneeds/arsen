import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { resolveProfissionalNome } from "@/lib/resolvePatientHeader";
import type { Lancamento, Periodo, FluidBalanceResult, Sentido } from "@/lib/fluidBalance";

/**
 * Balanco hidrico da internacao num periodo 07 -> 07 — fonte unica da tela, do
 * painel do enfermeiro e do PDF ENF-BH. Tabelas com RLS (etapa 4a):
 * escrita so tecnico/enfermeiro; nada se apaga (anulacao com motivo); autoria
 * preenchida pelo banco. Nasce com o gatilho de tempo real.
 */
export interface LancamentoRow {
  id: string;
  internacao_id: string;
  data_hora: string;
  sentido: Sentido;
  categoria: string;
  origem: string;
  volume_ml: number;
  descricao: string | null;
  registrado_por: string;
  anulado_em: string | null;
  motivo_anulacao: string | null;
  criado_em: string;
}

export interface FechamentoRow {
  id: string;
  internacao_id: string;
  periodo_inicio: string;
  periodo_fim: string;
  total_ganhos_ml: number;
  total_perdas_ml: number;
  perdas_insensiveis_ml: number | null;
  incluir_insensiveis: boolean;
  balanco_ml: number;
  diurese_ml_kg_h: number | null;
  peso_usado_kg: number | null;
  snapshot: Record<string, unknown>;
  fechado_em: string;
  validado_em: string | null;
  doc_code: string | null;
}

export function toLancamento(r: LancamentoRow): Lancamento {
  return {
    dataHora: new Date(r.data_hora),
    sentido: r.sentido,
    categoria: r.categoria,
    volumeMl: Number(r.volume_ml),
    origem: r.origem,
    anulado: !!r.anulado_em,
  };
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));

export function useBalancoHidrico(internacaoId: string | null, periodo: Periodo) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const startIso = periodo.start.toISOString();
  const endIso = periodo.end.toISOString();
  const keyL = useMemo(() => ["bh-lancamentos", internacaoId, startIso], [internacaoId, startIso]);
  const keyF = useMemo(() => ["bh-fechamento", internacaoId, startIso], [internacaoId, startIso]);

  const lancQ = useQuery({
    queryKey: keyL,
    enabled: !!internacaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("balanco_hidrico_lancamentos")
        .select("id, internacao_id, data_hora, sentido, categoria, origem, volume_ml, descricao, registrado_por, anulado_em, motivo_anulacao, criado_em")
        .eq("internacao_id", internacaoId as string)
        .gte("data_hora", startIso)
        .lt("data_hora", endIso)
        .order("data_hora", { ascending: true });
      if (error) throw error;
      return (data ?? []) as LancamentoRow[];
    },
  });

  const fechQ = useQuery({
    queryKey: keyF,
    enabled: !!internacaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("balanco_hidrico_fechamentos")
        .select("*")
        .eq("internacao_id", internacaoId as string)
        .eq("periodo_inicio", startIso)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as FechamentoRow | null;
    },
  });

  // Tempo real: lancamento de outro tecnico/enfermeiro aparece sem recarregar.
  useEffect(() => {
    if (!internacaoId) return;
    const ch = supabase
      .channel(`bh-${internacaoId}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "balanco_hidrico_lancamentos", filter: `internacao_id=eq.${internacaoId}` },
        () => { qc.invalidateQueries({ queryKey: ["bh-lancamentos", internacaoId] }); })
      .on("postgres_changes", { event: "*", schema: "public", table: "balanco_hidrico_fechamentos", filter: `internacao_id=eq.${internacaoId}` },
        () => { qc.invalidateQueries({ queryKey: ["bh-fechamento", internacaoId] }); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [internacaoId, qc]);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["bh-lancamentos", internacaoId] });
    qc.invalidateQueries({ queryKey: ["bh-fechamento", internacaoId] });
  };

  const lancar = useMutation({
    mutationFn: async (l: { dataHora: Date; sentido: Sentido; categoria: string; volumeMl: number; descricao?: string }) => {
      const { error } = await supabase.from("balanco_hidrico_lancamentos").insert({
        internacao_id: internacaoId as string,
        data_hora: l.dataHora.toISOString(),
        sentido: l.sentido,
        categoria: l.categoria,
        volume_ml: l.volumeMl,
        descricao: l.descricao?.trim() || null,
        origem: "manual",
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidar(); toast.success("Lançamento registrado"); },
    onError: (e) => toast.error("Lançamento não registrado", { description: errMsg(e) }),
  });

  const anular = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { data, error } = await supabase
        .from("balanco_hidrico_lancamentos")
        .update({ anulado_em: new Date().toISOString(), motivo_anulacao: motivo.trim() })
        .eq("id", id)
        .select("id");
      if (error) throw error;
      // RLS bloqueando em silencio devolve 0 linhas sem erro.
      if (!data || data.length === 0) throw new Error("Sem permissão para anular este lançamento");
    },
    onSuccess: () => { invalidar(); toast.success("Lançamento anulado"); },
    onError: (e) => toast.error("Não foi possível anular", { description: errMsg(e) }),
  });

  const fechar = useMutation({
    mutationFn: async (args: { result: FluidBalanceResult; incluirInsensiveis: boolean; pesoKg: number | null; docCode: string }) => {
      const nome = await resolveProfissionalNome(user?.id);
      const r = args.result;
      const payload = {
        internacao_id: internacaoId as string,
        periodo_inicio: startIso,
        periodo_fim: endIso,
        total_ganhos_ml: r.ganhos,
        total_perdas_ml: r.perdas,
        perdas_insensiveis_ml: r.insensiveis,
        incluir_insensiveis: args.incluirInsensiveis,
        balanco_ml: r.balanco,
        diurese_ml_kg_h: r.diureseMlKgH,
        peso_usado_kg: args.pesoKg,
        doc_code: args.docCode,
        snapshot: {
          porHora: r.porHora.map((h) => ({ hora: h.hora, ganhos: h.ganhos, perdas: h.perdas, saldo: h.saldo })),
          parciais: r.parciais,
          porCategoria: r.porCategoria,
          diureseMl: r.diureseMl,
          alertas: r.alertas,
          fechado_por_nome: nome,
        } as unknown as Json,
      };
      const atual = fechQ.data;
      if (atual) {
        const { data, error } = await supabase.from("balanco_hidrico_fechamentos").update(payload).eq("id", atual.id).select("id");
        if (error) throw error;
        if (!data || data.length === 0) throw new Error("Sem permissão para refechar este balanço");
      } else {
        const { error } = await supabase.from("balanco_hidrico_fechamentos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidar(); toast.success("Balanço fechado — aguarda validação do enfermeiro"); },
    onError: (e) => toast.error("Balanço não fechado", { description: errMsg(e) }),
  });

  const validar = useMutation({
    mutationFn: async () => {
      const atual = fechQ.data;
      if (!atual) throw new Error("Feche o balanço antes de validar");
      const nome = await resolveProfissionalNome(user?.id);
      const { data, error } = await supabase
        .from("balanco_hidrico_fechamentos")
        .update({ validado_em: new Date().toISOString(), snapshot: { ...atual.snapshot, validado_por_nome: nome } as unknown as Json })
        .eq("id", atual.id)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Sem permissão para validar este balanço");
    },
    onSuccess: () => { invalidar(); toast.success("Balanço validado"); },
    onError: (e) => toast.error("Balanço não validado", { description: errMsg(e) }),
  });

  return {
    lancamentos: lancQ.data ?? [],
    fechamento: fechQ.data ?? null,
    loading: lancQ.isLoading || fechQ.isLoading,
    erro: lancQ.error || fechQ.error,
    lancar, anular, fechar, validar,
  };
}
