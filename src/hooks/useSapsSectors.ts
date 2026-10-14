import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveSectorCode } from "@/config/sectorCoverage";
import { setSapsSectorsFromDb } from "@/lib/sectorComplexity";

/**
 * Carrega a habilitacao de SAPS por setor (coluna setores.aplica_saps) e popula
 * o cache usado por sectorRequiresSaps. Fonte unica da regra "este setor usa
 * ficha SAPS", substituindo as listas hardcoded red/yellow/outside.
 *
 * Cada setor habilitado entra no cache por NOME ("UTI 1") e por CODIGO resolvido
 * ("red"), porque patient.sector aparece das duas formas no app (codigo via
 * usePatients, nome via usePatientLive).
 *
 * Chame este hook nas telas que gateiam SAPS (admissao, aba SAPS, painel clinico).
 * Fora delas, sectorRequiresSaps cai no estatico = comportamento historico.
 */
export function useSapsSectors(enabled = true) {
  const query = useQuery({
    queryKey: ["saps-sectors"],
    staleTime: 5 * 60 * 1000,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setores")
        .select("nome, aplica_saps");
      if (error) throw error;
      return (data ?? []) as Array<{ nome: string; aplica_saps: boolean }>;
    },
  });

  useEffect(() => {
    // GUARDA: so popula quando ha linhas de setor de verdade. Um resultado vazio
    // (RLS/pre-auth) NAO pode virar "nenhum setor usa SAPS" — isso zeraria a ficha
    // em todo o app. Sem linhas, mantemos o fallback estatico.
    if (!query.data || query.data.length === 0) return;
    const identifiers: string[] = [];
    for (const s of query.data) {
      if (!s.aplica_saps || !s.nome) continue;
      identifiers.push(s.nome);
      const code = resolveSectorCode(s.nome);
      if (code) identifiers.push(code);
    }
    setSapsSectorsFromDb(identifiers);
  }, [query.data]);

  return query;
}
