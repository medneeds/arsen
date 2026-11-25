/**
 * Sistema de Classificacao de Pacientes de Fugulin (Fugulin, Gaidzinski & Kurcgant, 2005):
 * 12 areas de cuidado pontuadas de 1 a 4 (total 12–48).
 * Horas de enfermagem por paciente/24h: Resolucao COFEN 543/2017.
 * Puro.
 */
export const FUGULIN_AREAS = [
  { key: "estado_mental", label: "Estado mental" },
  { key: "oxigenacao", label: "Oxigenação" },
  { key: "sinais_vitais", label: "Sinais vitais" },
  { key: "motilidade", label: "Motilidade" },
  { key: "deambulacao", label: "Deambulação" },
  { key: "alimentacao", label: "Alimentação" },
  { key: "cuidado_corporal", label: "Cuidado corporal" },
  { key: "eliminacao", label: "Eliminação" },
  { key: "terapeutica", label: "Terapêutica" },
  { key: "integridade_cutaneo_mucosa", label: "Integridade cutâneo-mucosa" },
  { key: "curativo", label: "Curativo" },
  { key: "tempo_curativo", label: "Tempo utilizado em curativos" },
] as const;

export type FugulinAreaKey = (typeof FUGULIN_AREAS)[number]["key"];
export type FugulinRespostas = Partial<Record<FugulinAreaKey, number>>;

export type FugulinCategoria =
  | "cuidados_minimos"
  | "cuidados_intermediarios"
  | "alta_dependencia"
  | "cuidados_semi_intensivos"
  | "cuidados_intensivos";

export const FUGULIN_CATEGORIAS: Record<FugulinCategoria, { label: string; min: number; max: number; horas24h: number }> = {
  cuidados_minimos: { label: "Cuidados mínimos", min: 12, max: 17, horas24h: 4 },
  cuidados_intermediarios: { label: "Cuidados intermediários", min: 18, max: 22, horas24h: 6 },
  alta_dependencia: { label: "Alta dependência", min: 23, max: 28, horas24h: 10 },
  cuidados_semi_intensivos: { label: "Cuidados semi-intensivos", min: 29, max: 34, horas24h: 10 },
  cuidados_intensivos: { label: "Cuidados intensivos", min: 35, max: 48, horas24h: 18 },
};

export interface FugulinResultado {
  completo: boolean;
  faltando: FugulinAreaKey[];
  escore: number | null;
  categoria: FugulinCategoria | null;
  horas24h: number | null;
}

/** Classifica; so devolve categoria com as 12 areas respondidas (1–4). */
export function classificarFugulin(r: FugulinRespostas): FugulinResultado {
  const faltando: FugulinAreaKey[] = [];
  let soma = 0;
  for (const a of FUGULIN_AREAS) {
    const v = r[a.key];
    if (v == null || !Number.isInteger(v) || v < 1 || v > 4) faltando.push(a.key);
    else soma += v;
  }
  if (faltando.length > 0) return { completo: false, faltando, escore: null, categoria: null, horas24h: null };
  const categoria = categoriaPorEscore(soma);
  return { completo: true, faltando, escore: soma, categoria, horas24h: FUGULIN_CATEGORIAS[categoria].horas24h };
}

export function categoriaPorEscore(escore: number): FugulinCategoria {
  if (escore <= 17) return "cuidados_minimos";
  if (escore <= 22) return "cuidados_intermediarios";
  if (escore <= 28) return "alta_dependencia";
  if (escore <= 34) return "cuidados_semi_intensivos";
  return "cuidados_intensivos";
}

/** Horas de enfermagem necessarias no setor (soma dos pacientes classificados). */
export function horasNecessarias(categorias: (FugulinCategoria | null)[]): number {
  return categorias.reduce((s, c) => s + (c ? FUGULIN_CATEGORIAS[c].horas24h : 0), 0);
}
