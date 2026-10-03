/**
 * Unidades Federativas do Brasil (sigla + nome), para o Select de UF no cadastro
 * de endereco. Lista estatica (nao muda); as cidades sao carregadas por UF via
 * IBGE (useCidadesIBGE). Ordenada por nome para o Select.
 */
export interface UF {
  sigla: string;
  nome: string;
}

export const UFS: UF[] = [
  { sigla: "AC", nome: "Acre" },
  { sigla: "AL", nome: "Alagoas" },
  { sigla: "AP", nome: "Amapá" },
  { sigla: "AM", nome: "Amazonas" },
  { sigla: "BA", nome: "Bahia" },
  { sigla: "CE", nome: "Ceará" },
  { sigla: "DF", nome: "Distrito Federal" },
  { sigla: "ES", nome: "Espírito Santo" },
  { sigla: "GO", nome: "Goiás" },
  { sigla: "MA", nome: "Maranhão" },
  { sigla: "MT", nome: "Mato Grosso" },
  { sigla: "MS", nome: "Mato Grosso do Sul" },
  { sigla: "MG", nome: "Minas Gerais" },
  { sigla: "PA", nome: "Pará" },
  { sigla: "PB", nome: "Paraíba" },
  { sigla: "PR", nome: "Paraná" },
  { sigla: "PE", nome: "Pernambuco" },
  { sigla: "PI", nome: "Piauí" },
  { sigla: "RJ", nome: "Rio de Janeiro" },
  { sigla: "RN", nome: "Rio Grande do Norte" },
  { sigla: "RS", nome: "Rio Grande do Sul" },
  { sigla: "RO", nome: "Rondônia" },
  { sigla: "RR", nome: "Roraima" },
  { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "SP", nome: "São Paulo" },
  { sigla: "SE", nome: "Sergipe" },
  { sigla: "TO", nome: "Tocantins" },
];

const SIGLAS = new Set(UFS.map((u) => u.sigla));

/** Normaliza uma UF livre (ex.: "ma", " MA ") para a sigla valida, ou "" se invalida. */
export function normalizeUf(value: string | null | undefined): string {
  const s = (value ?? "").trim().toUpperCase();
  return SIGLAS.has(s) ? s : "";
}
