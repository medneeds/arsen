import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Ultima acao clinica (evolucao OU prescricao) por paciente, para o Painel Clinico.
// Objetivo: mostrar QUEM fez a ultima acao e QUANDO, num relance.
//
// IMPORTANTE (regressao recente de burst): NAO faz fetch por paciente. Usa
// consultas EM LOTE (poucas queries) via react-query, chaveadas pelos ids do
// setor, respeitando o cache. Autor da evolucao vive em soap.__created_by_name
// (nome, nao id). Autor da prescricao vem de criado_por (profissionais.id),
// resolvido para nome numa unica query adicional.

export type UltimaAcaoTipo = "Evolucao" | "Prescricao";

export interface UltimaAcao {
  tipo: UltimaAcaoTipo;
  autor: string | null;
  quando: string;
}

interface EvolucaoRow {
  internacao_id: string | null;
  data_hora: string | null;
  soap: { __created_by_name?: string | null } | null;
}

interface PrescricaoRow {
  internacao_id: string | null;
  criado_em: string | null;
  criado_por: string | null;
}

interface ProfissionalRow {
  id: string;
  nome: string | null;
  numero_conselho: string | null;
}

export function useLastClinicalAction(ids: string[]): Map<string, UltimaAcao> {
  // Dedup, sem nulos, ordenados — queryKey estavel independente da ordem da lista.
  const sortedIds = useMemo(
    () => Array.from(new Set(ids.filter((id): id is string => !!id))).sort(),
    [ids],
  );

  const evolucoesQuery = useQuery({
    queryKey: ["painel-ultima-evolucao", sortedIds],
    enabled: sortedIds.length > 0,
    queryFn: async (): Promise<EvolucaoRow[]> => {
      const { data, error } = await supabase
        .from("evolucoes")
        .select("internacao_id, data_hora, soap")
        .in("internacao_id", sortedIds)
        .order("data_hora", { ascending: false });
      if (error || !data) return [];
      return data as EvolucaoRow[];
    },
  });

  const prescricoesQuery = useQuery({
    queryKey: ["painel-ultima-prescricao", sortedIds],
    enabled: sortedIds.length > 0,
    queryFn: async (): Promise<PrescricaoRow[]> => {
      const { data, error } = await supabase
        .from("prescricoes")
        .select("internacao_id, criado_em, criado_por")
        .in("internacao_id", sortedIds)
        .order("criado_em", { ascending: false });
      if (error || !data) return [];
      return data as PrescricaoRow[];
    },
  });

  // Ordenado desc na query → a primeira ocorrencia por internacao_id e a mais recente.
  const ultimaEvolucaoPorPaciente = useMemo(() => {
    const map = new Map<string, EvolucaoRow>();
    for (const row of evolucoesQuery.data ?? []) {
      if (!row.internacao_id || !row.data_hora) continue;
      if (!map.has(row.internacao_id)) map.set(row.internacao_id, row);
    }
    return map;
  }, [evolucoesQuery.data]);

  const ultimaPrescricaoPorPaciente = useMemo(() => {
    const map = new Map<string, PrescricaoRow>();
    for (const row of prescricoesQuery.data ?? []) {
      if (!row.internacao_id || !row.criado_em) continue;
      if (!map.has(row.internacao_id)) map.set(row.internacao_id, row);
    }
    return map;
  }, [prescricoesQuery.data]);

  // Resolve autor da prescricao (criado_por = profissionais.id) → nome, em lote.
  const criadoPorIds = useMemo(() => {
    const set = new Set<string>();
    for (const row of ultimaPrescricaoPorPaciente.values()) {
      if (row.criado_por) set.add(row.criado_por);
    }
    return Array.from(set).sort();
  }, [ultimaPrescricaoPorPaciente]);

  const profissionaisQuery = useQuery({
    queryKey: ["painel-ultima-acao-profissionais", criadoPorIds],
    enabled: criadoPorIds.length > 0,
    queryFn: async (): Promise<ProfissionalRow[]> => {
      const { data, error } = await supabase
        .from("profissionais")
        .select("id, nome, numero_conselho")
        .in("id", criadoPorIds);
      if (error || !data) return [];
      return data as ProfissionalRow[];
    },
  });

  const nomePorProfissionalId = useMemo(() => {
    const map = new Map<string, string>();
    for (const prof of profissionaisQuery.data ?? []) {
      if (prof.id && prof.nome) map.set(prof.id, prof.nome);
    }
    return map;
  }, [profissionaisQuery.data]);

  return useMemo(() => {
    const result = new Map<string, UltimaAcao>();
    for (const id of sortedIds) {
      const evo = ultimaEvolucaoPorPaciente.get(id);
      const presc = ultimaPrescricaoPorPaciente.get(id);
      const evoTime = evo?.data_hora ? new Date(evo.data_hora).getTime() : null;
      const prescTime = presc?.criado_em ? new Date(presc.criado_em).getTime() : null;

      if (evoTime === null && prescTime === null) continue;

      // Em empate, a evolucao vence (texto clinico mais descritivo).
      const evoIsLatest = prescTime === null || (evoTime !== null && evoTime >= prescTime);

      if (evoIsLatest && evo) {
        result.set(id, {
          tipo: "Evolucao",
          autor: evo.soap?.__created_by_name ?? null,
          quando: evo.data_hora as string,
        });
      } else if (presc) {
        result.set(id, {
          tipo: "Prescricao",
          autor: presc.criado_por ? nomePorProfissionalId.get(presc.criado_por) ?? null : null,
          quando: presc.criado_em as string,
        });
      }
    }
    return result;
  }, [sortedIds, ultimaEvolucaoPorPaciente, ultimaPrescricaoPorPaciente, nomePorProfissionalId]);
}
