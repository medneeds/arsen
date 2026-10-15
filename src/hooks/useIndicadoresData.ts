import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Internacao enxuta para calculo de indicadores de qualidade (gestao de pacientes). */
export interface InternacaoIndic {
  id: string;
  paciente_id: string | null;
  data_entrada: string | null;
  data_alta: string | null;
  status: string | null;
  setor_id: string | null;
}

interface InternacaoRaw {
  id: string;
  paciente_id: string | null;
  data_entrada: string | null;
  data_alta: string | null;
  status: string | null;
  setor_classificacao_id: string | null;
}
interface SetorRaw { id: string; nome: string }

/**
 * Carrega as internacoes + setores + total de leitos para o dashboard de
 * indicadores. Os indicadores sao calculados na pagina (useMemo) sobre o
 * periodo filtrado — simples e flexivel neste volume (centenas de internacoes).
 */
export function useIndicadoresData() {
  const [internacoes, setInternacoes] = useState<InternacaoIndic[]>([]);
  const [setores, setSetores] = useState<Record<string, string>>({});
  const [leitosTotal, setLeitosTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const [iRes, sRes, lRes] = await Promise.all([
        supabase
          .from("internacoes")
          .select("id, paciente_id, data_entrada, data_alta, status, setor_classificacao_id")
          .limit(20000),
        supabase.from("setores").select("id, nome"),
        supabase.from("leitos").select("id", { count: "exact", head: true }),
      ]);
      if (iRes.error) throw iRes.error;
      const rows = (iRes.data ?? []) as InternacaoRaw[];
      setInternacoes(rows.map((r) => ({
        id: r.id,
        paciente_id: r.paciente_id,
        data_entrada: r.data_entrada,
        data_alta: r.data_alta,
        status: r.status,
        setor_id: r.setor_classificacao_id,
      })));
      const sm: Record<string, string> = {};
      for (const s of (sRes.data ?? []) as SetorRaw[]) sm[s.id] = s.nome;
      setSetores(sm);
      setLeitosTotal(lRes.count ?? 0);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { internacoes, setores, leitosTotal, loading, error, refetch };
}
