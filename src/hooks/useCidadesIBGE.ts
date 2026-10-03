import { useQuery } from "@tanstack/react-query";

/**
 * Lista de municipios de uma UF, via API publica do IBGE (localidades). Usado no
 * cadastro de endereco para o Select de cidade filtrado pela UF.
 *
 * - enabled so com UF valida.
 * - cache longo (municipios nao mudam): o React Query evita refetch a cada abertura.
 * - DEGRADACAO: em falha de rede (hospital com rede instavel) a query entra em
 *   error; o componente de endereco cai para campo de cidade em texto livre. Por
 *   isso retry baixo e sem travar a UI.
 */
export function useCidadesIBGE(uf: string | null | undefined) {
  const ufValida = (uf ?? "").trim().toUpperCase();
  return useQuery({
    queryKey: ["ibge-municipios", ufValida],
    enabled: ufValida.length === 2,
    staleTime: 1000 * 60 * 60 * 24, // 24h
    gcTime: 1000 * 60 * 60 * 24,
    retry: 1,
    queryFn: async (): Promise<string[]> => {
      const resp = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${ufValida}/municipios?orderBy=nome`,
      );
      if (!resp.ok) throw new Error(`IBGE ${resp.status}`);
      const data = (await resp.json()) as Array<{ nome?: string }>;
      return data
        .map((m) => (typeof m?.nome === "string" ? m.nome : ""))
        .filter(Boolean);
    },
  });
}
