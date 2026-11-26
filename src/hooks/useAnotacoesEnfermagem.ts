import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Escrita de anotacoes de enfermagem, intercorrencias (ciencia), evolucao do
 * enfermeiro, Fugulin e passagem de plantao (SBAR). Tabelas com RLS (4d):
 * autoria e nomes preenchidos pelo banco; nada se apaga (anulacao com motivo).
 * Erros e bloqueio silencioso de RLS (0 linhas) aparecem na tela.
 */
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));

export type TipoAnotacao = "anotacao_tecnico" | "evolucao_enfermeiro" | "intercorrencia" | "sae";

export function useAnotacoesAcoes() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["plantao-setor"] });
    qc.invalidateQueries({ queryKey: ["anotacoes-enf"] });
  };
  const exigeLinha = (data: unknown[] | null, msg: string) => { if (!data || data.length === 0) throw new Error(msg); };

  const registrar = useMutation({
    mutationFn: async (a: { internacaoId: string; tipo: TipoAnotacao; dataHora: Date; conteudo: unknown; texto: string; docCode?: string | null }) => {
      const { data, error } = await supabase.from("anotacoes_enfermagem").insert({
        internacao_id: a.internacaoId, tipo: a.tipo, data_hora: a.dataHora.toISOString(),
        conteudo: a.conteudo as Json, texto_gerado: a.texto, doc_code: a.docCode ?? null,
      }).select("id");
      if (error) throw error;
      exigeLinha(data, "Sem permissão para registrar");
      return data![0].id as string;
    },
    onSuccess: (_id, a) => {
      invalidar();
      toast.success(a.tipo === "intercorrencia" ? "Intercorrência registrada" : a.tipo === "evolucao_enfermeiro" ? "Evolução registrada" : "Anotação registrada",
        { description: a.tipo === "intercorrencia" ? "O painel do enfermeiro do setor foi avisado" : undefined });
    },
    onError: (e) => toast.error("Não registrado", { description: errMsg(e) }),
  });

  const ciencia = useMutation({
    mutationFn: async ({ id, conduta }: { id: string; conduta: string }) => {
      const { data, error } = await supabase.from("anotacoes_enfermagem")
        .update({ ciencia_em: new Date().toISOString(), ciencia_conduta: conduta.trim() }).eq("id", id).select("id");
      if (error) throw error;
      exigeLinha(data, "Só o enfermeiro registra ciência");
    },
    onSuccess: () => { invalidar(); toast.success("Ciência registrada"); },
    onError: (e) => toast.error("Ciência não registrada", { description: errMsg(e) }),
  });

  const anular = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { data, error } = await supabase.from("anotacoes_enfermagem")
        .update({ anulado_em: new Date().toISOString(), motivo_anulacao: motivo.trim() }).eq("id", id).select("id");
      if (error) throw error;
      exigeLinha(data, "Sem permissão para anular");
    },
    onSuccess: () => { invalidar(); toast.success("Anotação anulada"); },
    onError: (e) => toast.error("Não foi possível anular", { description: errMsg(e) }),
  });

  const salvarFugulin = useMutation({
    mutationFn: async (f: { id: string | null; internacaoId: string; data: string; escore: number; categoria: string; respostas: Record<string, number> }) => {
      const q = f.id
        ? supabase.from("classificacoes_cuidado").update({ escore: f.escore, categoria: f.categoria, respostas: f.respostas }).eq("id", f.id).select("id")
        : supabase.from("classificacoes_cuidado").insert({ internacao_id: f.internacaoId, data: f.data, escore: f.escore, categoria: f.categoria, respostas: f.respostas }).select("id");
      const { data, error } = await q;
      if (error) throw error;
      exigeLinha(data, "Só o enfermeiro classifica o cuidado");
    },
    onSuccess: () => { invalidar(); toast.success("Fugulin registrado"); },
    onError: (e) => toast.error("Fugulin não registrado", { description: errMsg(e) }),
  });

  const registrarPassagem = useMutation({
    mutationFn: async (p: { snapshot: unknown; observacoes: string; totalPacientes: number; leitosOcupados: number; noturno: boolean }) => {
      // passagens_plantao e tabela legada: criado_por referencia auth.users.
      const { data, error } = await supabase.from("passagens_plantao").insert({
        criado_por: user?.id ?? null, dados_snapshot: p.snapshot as Json, observacoes: p.observacoes.trim() || null,
        total_pacientes: p.totalPacientes, leitos_ocupados: p.leitosOcupados, tipo_turno: p.noturno ? "NOTURNO" : "DIURNO",
      }).select("id");
      if (error) throw error;
      exigeLinha(data, "Passagem não gravada");
    },
    onSuccess: () => toast.success("Passagem de plantão registrada"),
    onError: (e) => toast.error("Passagem não registrada", { description: errMsg(e) }),
  });

  return { registrar, ciencia, anular, salvarFugulin, registrarPassagem };
}
