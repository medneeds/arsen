import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { AprazamentoRow, AdministracaoRow, PrescricaoAtiva } from "@/hooks/useAprazamento";
import type { SinaisVitaisRow, Turno } from "@/lib/plantaoEnfermagem";
import { itensAprazaveis, type ItemAprazavel } from "@/lib/aprazamentoItens";
import { itensSemAprazamento, resumoLeito, type DoseFila, type ResumoLeito, type SituacaoBH } from "@/lib/plantaoEnfermagem";
import type { ValidityWindow } from "@/lib/prescriptionValidity";
import type { Periodo } from "@/lib/fluidBalance";
import { fortalezaParts } from "@/lib/docPrefixes";

/**
 * Dados de enfermagem de varios leitos (setor ou "meus leitos") — fonte do
 * painel do enfermeiro e do "Meu plantao". As mesmas tabelas das telas por
 * paciente (aprazamentos, administracoes, BH, sinais_vitais, prescricao ativa).
 * Nasce com o gatilho de tempo real: um canal para as internacoes da lista.
 */
export interface PlantaoLeitoRow {
  id: string; internacao_id: string; profissional_id: string; profissional_nome: string | null;
  turno_inicio: string; criado_em: string; encerrado_em: string | null;
}
export interface SinaisVitaisFullRow extends SinaisVitaisRow {
  id: string; internacao_id: string; pressao_diastolica: number | null; glicemia_capilar: number | null;
  dor_escala: number | null; fio2: number | null; pvc: number | null; observacoes: string | null;
}
export interface BhLancTurnoRow { internacao_id: string; data_hora: string; sentido: "ganho" | "perda"; categoria: string; volume_ml: number; origem: string; anulado_em: string | null }
export interface BhFechRow { internacao_id: string; periodo_inicio: string; validado_em: string | null }

export interface AnotacaoRow {
  id: string; internacao_id: string; data_hora: string; tipo: "anotacao_tecnico" | "evolucao_enfermeiro" | "intercorrencia" | "sae";
  conteudo: Record<string, unknown>; texto_gerado: string; status: string; registrado_por: string; registrado_por_nome: string | null;
  validado_em: string | null; ciencia_em: string | null; ciencia_por_nome: string | null; ciencia_conduta: string | null;
  doc_code: string | null; anulado_em: string | null; motivo_anulacao: string | null; criado_em: string;
}
export interface FugulinRow { id: string; internacao_id: string; data: string; escore: number; categoria: string; respostas: Record<string, number>; registrado_por_nome: string | null; atualizado_em: string }

export interface DadosSetor {
  /** anotacoes das ultimas 48h (anuladas excluidas) */
  anotacoes: AnotacaoRow[];
  fugulinHoje: Map<string, FugulinRow>;
  prescricoes: Map<string, PrescricaoAtiva>;
  horarios: AprazamentoRow[];
  checagens: AdministracaoRow[];
  ultimoSSVV: Map<string, SinaisVitaisFullRow>;
  fechamentosAnteriores: Map<string, BhFechRow>;
  lancamentosTurno: BhLancTurnoRow[];
  plantao: PlantaoLeitoRow[];
}

const HOUR_MS = 3_600_000;

export function usePlantaoSetor(ids: string[], janela: ValidityWindow, turno: Turno, periodoAnterior: Periodo) {
  const qc = useQueryClient();
  const chave = useMemo(() => [...ids].sort().join(","), [ids]);
  const key = useMemo(
    () => ["plantao-setor", chave, janela.start.toISOString(), turno.inicio.toISOString()],
    [chave, janela.start, turno.inicio],
  );

  const q = useQuery({
    queryKey: key,
    enabled: ids.length > 0,
    refetchInterval: 5 * 60_000, // atraso muda com o relogio, nao so com eventos
    queryFn: async (): Promise<DadosSetor> => {
      const lista = chave.split(",");
      const desde48h = new Date(Date.now() - 48 * HOUR_MS).toISOString();
      const hojeLocal = (() => { const p = fortalezaParts(new Date()); return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`; })();
      const [presc, apz, adm, ssvv, fech, lanc, pl, anot, fug] = await Promise.all([
        supabase.from("prescricoes").select("id, internacao_id, status, itens, criado_em, atualizado_em")
          .in("internacao_id", lista).neq("status", "draft").order("criado_em", { ascending: false }),
        supabase.from("aprazamentos").select("*").in("internacao_id", lista).eq("janela_inicio", janela.start.toISOString()),
        supabase.from("administracoes").select("*").in("internacao_id", lista)
          .gte("realizado_em", janela.start.toISOString()).lt("realizado_em", new Date(janela.end.getTime() + 3 * HOUR_MS).toISOString()),
        supabase.from("sinais_vitais").select("id, internacao_id, data_hora, pressao_sistolica, pressao_diastolica, freq_cardiaca, freq_respiratoria, spo2, temperatura, nivel_consciencia, o2_suplementar, fio2, pvc, glicemia_capilar, dor_escala, observacoes")
          .in("internacao_id", lista).gte("data_hora", desde48h).order("data_hora", { ascending: false }),
        supabase.from("balanco_hidrico_fechamentos").select("internacao_id, periodo_inicio, validado_em")
          .in("internacao_id", lista).eq("periodo_inicio", periodoAnterior.start.toISOString()),
        supabase.from("balanco_hidrico_lancamentos").select("internacao_id, data_hora, sentido, categoria, volume_ml, origem, anulado_em")
          .in("internacao_id", lista).gte("data_hora", turno.inicio.toISOString()).lt("data_hora", turno.fim.toISOString()),
        supabase.from("plantao_leitos").select("*").in("internacao_id", lista).eq("turno_inicio", turno.inicio.toISOString()).is("encerrado_em", null),
        supabase.from("anotacoes_enfermagem").select("*").in("internacao_id", lista).is("anulado_em", null).gte("data_hora", desde48h).order("data_hora", { ascending: true }),
        supabase.from("classificacoes_cuidado").select("id, internacao_id, data, escore, categoria, respostas, registrado_por_nome, atualizado_em").in("internacao_id", lista).eq("data", hojeLocal),
      ]);
      for (const r of [presc, apz, adm, ssvv, fech, lanc, pl, anot, fug]) if (r.error) throw r.error;
      const fugulinHoje = new Map<string, FugulinRow>();
      for (const f of (fug.data ?? []) as FugulinRow[]) fugulinHoje.set(f.internacao_id, f);
      const prescricoes = new Map<string, PrescricaoAtiva>();
      for (const p of (presc.data ?? []) as (PrescricaoAtiva & { internacao_id: string })[]) {
        if (!prescricoes.has(p.internacao_id)) prescricoes.set(p.internacao_id, p);
      }
      const ultimoSSVV = new Map<string, SinaisVitaisFullRow>();
      for (const v of (ssvv.data ?? []) as SinaisVitaisFullRow[]) if (!ultimoSSVV.has(v.internacao_id)) ultimoSSVV.set(v.internacao_id, v);
      const fechamentosAnteriores = new Map<string, BhFechRow>();
      for (const f of (fech.data ?? []) as BhFechRow[]) fechamentosAnteriores.set(f.internacao_id, f);
      return {
        anotacoes: (anot.data ?? []) as AnotacaoRow[],
        fugulinHoje,
        prescricoes,
        horarios: (apz.data ?? []) as AprazamentoRow[],
        checagens: (adm.data ?? []) as AdministracaoRow[],
        ultimoSSVV,
        fechamentosAnteriores,
        lancamentosTurno: ((lanc.data ?? []) as BhLancTurnoRow[]).map((l) => ({ ...l, volume_ml: Number(l.volume_ml) })),
        plantao: (pl.data ?? []) as PlantaoLeitoRow[],
      };
    },
  });

  // Tempo real: qualquer mudanca nas internacoes da lista recarrega.
  useEffect(() => {
    if (!chave) return;
    const filtro = `internacao_id=in.(${chave})`;
    let ch = supabase.channel(`plantao-${Math.random().toString(36).slice(2, 10)}`);
    for (const table of ["aprazamentos", "administracoes", "sinais_vitais", "balanco_hidrico_lancamentos", "balanco_hidrico_fechamentos", "plantao_leitos", "prescricoes", "anotacoes_enfermagem", "classificacoes_cuidado"]) {
      ch = ch.on("postgres_changes", { event: "*", schema: "public", table, filter: filtro }, () => {
        qc.invalidateQueries({ queryKey: ["plantao-setor"] });
      });
    }
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [chave, qc]);

  return { dados: q.data ?? null, carregando: q.isLoading, erro: q.error as Error | null };
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));

/** Assumir/liberar leitos no turno, registrar SSVV e controles da hora. */
export function usePlantaoAcoes() {
  const qc = useQueryClient();
  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["plantao-setor"] });
    qc.invalidateQueries({ queryKey: ["bh-lancamentos"] });
  };

  const assumir = useMutation({
    mutationFn: async ({ ids, turnoInicio }: { ids: string[]; turnoInicio: Date }) => {
      if (!ids.length) return;
      const { data, error } = await supabase.from("plantao_leitos")
        .insert(ids.map((internacao_id) => ({ internacao_id, turno_inicio: turnoInicio.toISOString() }))).select("id");
      if (error) throw error;
      if (!data || data.length !== ids.length) throw new Error("Sem permissão para assumir leitos");
    },
    onSuccess: () => { invalidar(); toast.success("Leitos do plantão registrados"); },
    onError: (e) => toast.error("Não foi possível assumir os leitos", { description: errMsg(e) }),
  });

  const liberar = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from("plantao_leitos").update({ encerrado_em: new Date().toISOString() }).eq("id", id).select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Só quem assumiu o leito pode liberá-lo");
    },
    onSuccess: () => { invalidar(); toast.success("Leito liberado"); },
    onError: (e) => toast.error("Não foi possível liberar", { description: errMsg(e) }),
  });

  const registrarControles = useMutation({
    mutationFn: async (c: {
      internacaoId: string; dataHora: Date; registradoPor: string | null;
      ssvv: Record<string, number | boolean | string | null> | null;
      perdas: { categoria: string; volumeMl: number }[];
    }) => {
      if (c.ssvv) {
        // sinais_vitais e tabela legada (sem default de autoria): grava o profissional logado.
        const { error } = await supabase.from("sinais_vitais").insert({
          internacao_id: c.internacaoId, data_hora: c.dataHora.toISOString(), registrado_por: c.registradoPor, ...c.ssvv,
        } as never);
        if (error) throw error;
      }
      if (c.perdas.length) {
        const { error } = await supabase.from("balanco_hidrico_lancamentos").insert(c.perdas.map((p) => ({
          internacao_id: c.internacaoId, data_hora: c.dataHora.toISOString(), sentido: "perda", categoria: p.categoria,
          volume_ml: p.volumeMl, origem: "manual", descricao: "Controle da hora",
        })));
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidar(); toast.success("Controles registrados"); },
    onError: (e) => toast.error("Controles não registrados", { description: errMsg(e) }),
  });

  return { assumir, liberar, registrarControles };
}

// ── Derivacao por leito (painel e "Meu plantao" leem a MESMA conta) ─────────

export interface DoseLeito extends DoseFila { apz: AprazamentoRow; checagemRow: AdministracaoRow | null }

export interface LeitoEnfermagem {
  internacaoId: string;
  prescricaoId: string | null;
  itens: ItemAprazavel[];
  doses: DoseLeito[];
  dcPendentes: AdministracaoRow[];
  semHorario: ItemAprazavel[];
  resumo: ResumoLeito;
  plantao: PlantaoLeitoRow[];
  ssvv: SinaisVitaisFullRow | null;
  turno: { ganhos: number; perdas: number };
  intercorrenciasAbertas: AnotacaoRow[];
  /** anotacoes e intercorrencias desde o inicio do turno */
  anotacoesTurno: AnotacaoRow[];
  fugulin: FugulinRow | null;
}

export function derivarLeito(dados: DadosSetor, internacaoId: string, agora: Date, janela: ValidityWindow, janelaAtual: boolean, turnoInicio: Date = new Date(agora.getTime() - 12 * HOUR_MS)): LeitoEnfermagem {
  const presc = dados.prescricoes.get(internacaoId) ?? null;
  const itens = presc ? itensAprazaveis(presc.itens, agora) : [];
  const horarios = dados.horarios.filter((h) => h.internacao_id === internacaoId);
  const checagens = dados.checagens.filter((c) => c.internacao_id === internacaoId && !c.anulado_em);
  const porApz = new Map(checagens.filter((c) => c.aprazamento_id).map((c) => [c.aprazamento_id as string, c]));
  const doses: DoseLeito[] = horarios.map((h) => {
    const c = porApz.get(h.id) ?? null;
    return { id: h.id, internacaoId, horario: new Date(h.horario), checagem: c ? { status: c.status } : null, cancelado: !!h.cancelado_em, apz: h, checagemRow: c };
  });
  const existentes = horarios.map((h) => ({ itemId: h.item_id, horario: new Date(h.horario), cancelado: !!h.cancelado_em, aprazadoEm: new Date(h.aprazado_em), canceladoEm: h.cancelado_em ? new Date(h.cancelado_em) : null }));
  const semHorario = janelaAtual && presc ? itensSemAprazamento(itens, janela, agora, existentes) : [];
  const dcPendentes = checagens.filter((c) => c.mav && c.status === "realizado" && !c.dupla_checagem_em);
  const fech = dados.fechamentosAnteriores.get(internacaoId);
  const bhAnterior: SituacaoBH = fech?.validado_em ? "validado" : fech ? "fechado" : "aberto";
  const plantao = dados.plantao.filter((p) => p.internacao_id === internacaoId);
  const ssvv = dados.ultimoSSVV.get(internacaoId) ?? null;
  const lanc = dados.lancamentosTurno.filter((l) => l.internacao_id === internacaoId && !l.anulado_em);
  const anot = dados.anotacoes.filter((a) => a.internacao_id === internacaoId);
  const intercorrenciasAbertas = anot.filter((a) => a.tipo === "intercorrencia" && !a.ciencia_em);
  const anotacoesTurno = anot.filter((a) => (a.tipo === "anotacao_tecnico" || a.tipo === "intercorrencia") && new Date(a.data_hora).getTime() >= turnoInicio.getTime());
  const fugulin = dados.fugulinHoje.get(internacaoId) ?? null;
  const soma = (s: "ganho" | "perda") => Math.round(lanc.filter((l) => l.sentido === s).reduce((a, l) => a + l.volume_ml, 0) * 10) / 10;
  return {
    internacaoId, prescricaoId: presc?.id ?? null, itens, doses, dcPendentes, semHorario, plantao, ssvv,
    turno: { ganhos: soma("ganho"), perdas: soma("perda") },
    intercorrenciasAbertas, anotacoesTurno, fugulin,
    resumo: resumoLeito({
      agora, doses, duplaPendente: dcPendentes.length, semAprazamento: semHorario.length, ultimoSSVV: ssvv,
      bhAnterior, intercorrenciasAbertas: intercorrenciasAbertas.length, tecnicos: plantao.map((p) => (p.profissional_nome ?? "").split(/\s+/).slice(0, 2).join(" ")).filter(Boolean),
    }),
  };
}
