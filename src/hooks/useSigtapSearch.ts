import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SigtapProcedure {
  codigo: string;
  codigo_formatado: string;
  nome: string;
  complexidade: string | null;
  valor_total: number | string | null;
  instrumento: string | null;
}

// Normaliza para busca: remove acentos e caixa. "CRÂNIO" -> "cranio".
function norm(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Palavras de ligacao que nao agregam a busca (ruido). Removidas dos tokens do
// termo digitado para "com contraste", "ressonancia de cranio" casarem.
const STOPWORDS = new Set(["de", "do", "da", "dos", "das", "com", "e", "ou", "para", "sem", "no", "na", "a", "o", "em"]);

// Sinonimos/abreviacoes comuns da radiologia -> termo como aparece no SIGTAP.
const SINONIMOS: Record<string, string> = {
  tc: "tomografia",
  rm: "ressonancia",
  rnm: "ressonancia",
  usg: "ultrassonografia",
  us: "ultrassonografia",
  eco: "ecocardiograma",
  rx: "radiografia",
};

// Expande um token: contrastado/contrastada/contrastadas -> contraste; aplica
// sinonimos; senao mantem.
function expandirToken(tok: string): string {
  if (/^contrast/.test(tok)) return "contraste";
  return SINONIMOS[tok] ?? tok;
}

// Quebra o termo em tokens uteis (sem acento/caixa, sem stopwords, >=2 chars).
function tokenizar(q: string): string[] {
  return norm(q)
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !STOPWORDS.has(t))
    .map(expandirToken)
    .filter((t) => t.length >= 2);
}

// Ordena por complexidade (alta -> media -> resto) para o alto custo vir primeiro.
const COMPLEX_RANK: Record<string, number> = {
  "Alta Complexidade": 0,
  "Media Complexidade": 1,
};

/**
 * Catalogo SIGTAP completo (tabela sigtap_procedimentos), carregado UMA vez e
 * cacheado. A busca e feita no cliente, ignorando ACENTO e CAIXA — essencial
 * para nomes em maiusculas acentuadas ("CRÂNIO", "TÓRAX") contra termos que o
 * medico digita sem acento ("cranio", "torax"). Solucao sem mudanca de banco.
 *
 * Carrega sob demanda (so quando o usuario comeca a digitar) e pagina em blocos
 * de 1000 (limite default do PostgREST). Se a tabela estiver vazia/ausente, o
 * React Query absorve o erro e a busca volta vazia — o picker segue no catalogo
 * local.
 */
export function useSigtapSearch(term: string) {
  const q = (term ?? "").trim();
  const enabled = q.length >= 2;

  const catalog = useQuery({
    queryKey: ["sigtap-catalog"],
    enabled,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    queryFn: async (): Promise<SigtapProcedure[]> => {
      const page = 1000;
      const all: SigtapProcedure[] = [];
      for (let from = 0; ; from += page) {
        const { data, error } = await supabase
          .from("sigtap_procedimentos")
          .select("codigo, codigo_formatado, nome, complexidade, valor_total, instrumento")
          .order("codigo", { ascending: true })
          .range(from, from + page - 1);
        if (error) throw error;
        const rows = (data ?? []) as SigtapProcedure[];
        all.push(...rows);
        if (rows.length < page) break;
      }
      return all;
    },
  });

  // Pre-normaliza os nomes uma vez por carga do catalogo (sem acento/caixa),
  // para o filtro por token nao reprocessar 5k linhas a cada tecla.
  const normalizado = useMemo(
    () => (catalog.data ?? []).map((r) => ({ r, nomeNorm: norm(r.nome) })),
    [catalog.data],
  );

  const data = useMemo<SigtapProcedure[]>(() => {
    if (q.length < 3 || normalizado.length === 0) return [];
    const digits = q.replace(/\D/g, "");
    // Busca por TOKENS: cada palavra util (sem acento/stopword, com sinonimos)
    // precisa aparecer em qualquer posicao do nome, em qualquer ordem.
    // "com contraste" -> [contraste]; "tc torax" -> [tomografia, torax].
    // Codigo casa em paralelo (>=3 digitos).
    const tokens = tokenizar(q);
    const hits = normalizado
      .filter(({ r, nomeNorm }) => {
        const nameMatch = tokens.length > 0 && tokens.every((t) => nomeNorm.includes(t));
        const codeMatch = digits.length >= 3 && (r.codigo.includes(digits) || (r.codigo_formatado ?? "").includes(q));
        return nameMatch || codeMatch;
      })
      .map(({ r }) => r);
    hits.sort((a, b) => {
      const ra = COMPLEX_RANK[a.complexidade ?? ""] ?? 2;
      const rb = COMPLEX_RANK[b.complexidade ?? ""] ?? 2;
      if (ra !== rb) return ra - rb;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
    return hits.slice(0, 50);
  }, [q, normalizado]);

  return { data, isFetching: catalog.isFetching };
}
