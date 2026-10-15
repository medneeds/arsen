import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Linha do relatorio de gestao de leitos (view vw_gestao_leitos — setor de
 * qualidade). Uma linha por MOVIMENTACAO de leito: admissao hospitalar ou
 * transferencia interna. Os tempos vem calculados em MINUTOS pela view.
 *
 * A view nao esta nos tipos gerados do Supabase (e objeto de banco, nao tabela),
 * entao a consulta usa cast. Se a view ainda nao existir no banco, o hook devolve
 * lista vazia + erro (a UI mostra o estado "view nao aplicada").
 */
export interface GestaoLeitoRow {
  tipo_movimento: "admissao" | "transferencia_interna" | string;
  evento_id: string;
  internacao_id: string;
  numero_atendimento: string | null;
  prontuario: string | null;
  nome_paciente: string | null;
  sexo: string | null;
  dt_nascimento: string | null;
  idade_anos: number | null;
  diagnostico: string | null;
  setor_procedencia: string | null;
  leito_procedencia: string | null;
  data_admissao_hospitalar: string | null;
  dt_pedido_leito: string | null;
  dt_recebimento_solicitacao: string | null;
  tipo_leito_solicitado: string | null;
  dt_liberacao_leito: string | null;
  dt_admissao_no_leito: string | null;
  destino_setor: string | null;
  leito_destino: string | null;
  desfecho: string | null;
  motivo_nao_ocupacao: string | null;
  min_espera_apos_solicitacao: number | null;
  min_ate_recebimento: number | null;
  min_transito: number | null;
}

export function useGestaoLeitos() {
  const [rows, setRows] = useState<GestaoLeitoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as unknown as {
        from: (v: string) => {
          select: (c: string) => {
            order: (c: string, o: { ascending: boolean }) => {
              limit: (n: number) => Promise<{ data: GestaoLeitoRow[] | null; error: { message: string } | null }>;
            };
          };
        };
      })
        .from("vw_gestao_leitos")
        .select("*")
        .order("dt_pedido_leito", { ascending: false })
        .limit(5000);
      if (error) {
        setError(error.message);
        setRows([]);
      } else {
        setRows((data ?? []) as GestaoLeitoRow[]);
        setError(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { rows, loading, error, refetch };
}
