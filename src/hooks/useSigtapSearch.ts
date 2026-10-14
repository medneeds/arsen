import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SigtapProcedure {
  codigo: string;
  codigo_formatado: string;
  nome: string;
  complexidade: string | null;
  valor_total: number | string | null;
}

/**
 * Busca procedimentos no catalogo SIGTAP (tabela sigtap_procedimentos) por nome
 * ou codigo, restrito a media/alta complexidade (foco em alto custo das APACs).
 *
 * Seguro por construcao: so dispara com >=3 caracteres; se a tabela estiver
 * vazia ou ausente, o erro e absorvido pelo React Query e retorna lista vazia —
 * o picker da APAC continua funcionando com o catalogo local.
 */
export function useSigtapSearch(term: string) {
  const q = (term ?? "").trim();
  const digits = q.replace(/\D/g, "");
  const porCodigo = digits.length >= 3;

  return useQuery({
    queryKey: ["sigtap-search", q],
    enabled: q.length >= 3,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<SigtapProcedure[]> => {
      let query = supabase
        .from("sigtap_procedimentos")
        .select("codigo, codigo_formatado, nome, complexidade, valor_total")
        .in("complexidade", ["Alta Complexidade", "Media Complexidade"])
        .order("complexidade", { ascending: true })
        .limit(40);

      // Busca por codigo quando o termo tem digitos suficientes; senao por nome.
      // Evita o operador .or() (fragil a virgula/parenteses no termo digitado).
      query = porCodigo
        ? query.ilike("codigo", `%${digits}%`)
        : query.ilike("nome", `%${q}%`);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as SigtapProcedure[];
    },
  });
}
