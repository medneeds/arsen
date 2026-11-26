import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { pesoRefFromRow, type InternacaoPesoRow, type PesoRef } from "@/lib/pesoReferencia";

/**
 * Peso de referencia da internacao (internacoes.peso_kg) — fonte unica das
 * telas multiprofissionais. Atualiza por realtime na linha da internacao.
 *
 * Le peso_kg com a origem (aferido/estimado/referido) e o momento do registro
 * (migration 20261126100000).
 */
export function usePesoReferencia(internacaoId: string | null): { peso: PesoRef; loading: boolean } {
  const qc = useQueryClient();
  const key = ["peso-referencia", internacaoId];
  const q = useQuery({
    queryKey: key,
    enabled: !!internacaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("internacoes")
        .select("peso_kg, peso_origem, peso_aferido_em")
        .eq("id", internacaoId as string)
        .maybeSingle();
      if (error) throw error;
      return pesoRefFromRow(data as InternacaoPesoRow | null);
    },
  });

  useEffect(() => {
    if (!internacaoId) return;
    const ch = supabase
      .channel(`peso-ref-${internacaoId}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "internacoes", filter: `id=eq.${internacaoId}` },
        () => { qc.invalidateQueries({ queryKey: ["peso-referencia", internacaoId] }); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [internacaoId, qc]);

  return { peso: q.data ?? pesoRefFromRow(null), loading: q.isLoading };
}
