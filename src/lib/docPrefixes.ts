/**
 * Registro UNICO dos prefixos de codigo de documento (Norma Zero, MAN.05-001).
 * Formato do codigo: PREFIXO-AAAAMMDD-HHMM (generateDocCode em printNormaZero).
 * Todo documento novo pega o prefixo daqui — nunca string solta no impresso.
 */
export const DOC_PREFIXES = {
  // Capitulo multiprofissional
  regulacaoExterna: "REQ-REG",
  nutricaoAvaliacao: "NUT-AVA",
  nutricaoMonitoramento: "NUT-MON",
  fisioEvolucao: "FIS-EVO",
  enfBalanco: "ENF-BH",
  enfAprazamento: "ENF-APZ",
  enfEvolucao: "ENF-EVO",
  enfSbar: "ENF-SBAR",
  // Existentes (referencia unica)
  reqLab: "REQ-LAB",
  reqHemo: "REQ-HEMO",
  reqCult: "REQ-CULT",
} as const;

export type DocPrefixKey = keyof typeof DOC_PREFIXES;
export type DocPrefix = (typeof DOC_PREFIXES)[DocPrefixKey];

/** Codigo PREFIXO-AAAAMMDD-HHMM no fuso de Sao Luis (America/Fortaleza, UTC-3). */
export function formatDocCode(prefix: DocPrefix | string, at: Date = new Date()): string {
  const p = fortalezaParts(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${prefix}-${p.year}${pad(p.month)}${pad(p.day)}-${pad(p.hour)}${pad(p.minute)}`;
}

/** Valida o formato PREFIXO-AAAAMMDD-HHMM (prefixo com letras e hifens). */
export function isValidDocCode(code: string): boolean {
  return /^[A-Z]+(?:-[A-Z]+)*-\d{8}-\d{4}$/.test(code);
}

/** Componentes de data/hora no fuso America/Fortaleza (UTC-3 fixo, sem horario de verao). */
export function fortalezaParts(d: Date): { year: number; month: number; day: number; hour: number; minute: number } {
  const shifted = new Date(d.getTime() + FORTALEZA_OFFSET_MIN * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

/** America/Fortaleza: UTC-3 o ano inteiro (sem horario de verao desde 2000). */
export const FORTALEZA_OFFSET_MIN = -180;

/** Date (instante UTC) correspondente a uma hora local de Fortaleza. */
export function fortalezaLocal(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - FORTALEZA_OFFSET_MIN * 60_000);
}
