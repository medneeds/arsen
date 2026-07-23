/**
 * Lista canônica de intervalos posológicos.
 *
 * Fonte única de verdade compartilhada entre:
 *  - AntimicrobialGuideDialog (seletor de posologia do guia ATB)
 *  - PrescricaoPage (seletor rápido inline na prescrição)
 *  - PDFs (rótulos consistentes)
 *
 * Inclui 48/48h e 72/72h (esquemas usados em vancomicina, polimixina, antifúngicos
 * em IRC, etc.) — ausentes antes desta unificação.
 *
 * Regra: este arquivo é PURO (sem React, sem side-effects). Pode ser importado
 * em qualquer camada.
 */

export interface PrescriptionInterval {
  /** Valor canônico armazenado no campo `posology` da prescrição/guia. */
  value: string;
  /** Rótulo amigável exibido na UI (ex.: "12/12h (2x/dia)"). */
  label: string;
  /** Quantas administrações em 24 h — usado por aprazamento/checagens. 0 = não aplicável. */
  phases: number;
  /** Categoria para agrupar no <Select> (frequência, contínuo, condicional). */
  group: 'frequente' | 'espacado' | 'continuo' | 'condicional';
}

export const PRESCRIPTION_INTERVALS: PrescriptionInterval[] = [
  // ── Esquemas frequentes (intra-dia) ────────────────────────────────────────
  { value: '1/1h',   label: '1/1h (24x/dia)',  phases: 24, group: 'frequente' },
  { value: '2/2h',   label: '2/2h (12x/dia)',  phases: 12, group: 'frequente' },
  { value: '3/3h',   label: '3/3h (8x/dia)',   phases: 8,  group: 'frequente' },
  { value: '4/4h',   label: '4/4h (6x/dia)',   phases: 6,  group: 'frequente' },
  { value: '6/6h',   label: '6/6h (4x/dia)',   phases: 4,  group: 'frequente' },
  { value: '8/8h',   label: '8/8h (3x/dia)',   phases: 3,  group: 'frequente' },
  { value: '12/12h', label: '12/12h (2x/dia)', phases: 2,  group: 'frequente' },
  { value: '24/24h', label: '24/24h (1x/dia)', phases: 1,  group: 'frequente' },

  // ── Esquemas espaçados (multi-dia) ─────────────────────────────────────────
  { value: '48/48h', label: '48/48h (a cada 2 dias)', phases: 1, group: 'espacado' },
  { value: '72/72h', label: '72/72h (a cada 3 dias)', phases: 1, group: 'espacado' },
  { value: '1x/semana', label: '1x/semana',           phases: 1, group: 'espacado' },

  // ── Esquemas alternativos de frequência (x/dia, sem intervalo fixo) ───────
  { value: '1x/dia', label: '1x/dia',  phases: 1, group: 'frequente' },
  { value: '2x/dia', label: '2x/dia',  phases: 2, group: 'frequente' },
  { value: '3x/dia', label: '3x/dia',  phases: 3, group: 'frequente' },
  { value: '4x/dia', label: '4x/dia',  phases: 4, group: 'frequente' },

  // ── Contínuo / dose única ──────────────────────────────────────────────────
  { value: 'Contínuo', label: 'Contínuo (BIC)', phases: 0, group: 'continuo' },
  { value: 'Única',    label: 'Dose única',     phases: 1, group: 'continuo' },
  // "Agora" (antiga flag AG): dose pontual imediata. NÃO renova na virada de
  // plantão — a lógica de renovação lê este valor. (Unificação 22/07/2026.)
  { value: 'Agora',    label: 'Agora (dose imediata)', phases: 1, group: 'continuo' },

  // ── Condicionais ───────────────────────────────────────────────────────────
  { value: 'S/N', label: 'S/N (se necessário)', phases: 0, group: 'condicional' },
  { value: 'ACM', label: 'ACM (a critério médico)', phases: 0, group: 'condicional' },
];

// ── Modificador condicional S/N ─────────────────────────────────────────────
// Unificação 22/07/2026 (decisão do gestor): as marcações SN/ACM/AG saíram das
// flags e passaram a viver no campo INTERVALO — a informação mora num lugar só.
//
// Regra clínica confirmada pelo gestor:
//  • "S/N" COMBINA com intervalo fixo — "6/6h S/N" = até de 6/6h, se necessário
//    (prescrição clássica de analgesia). Por isso é um SUFIXO, não um valor
//    que substitui o intervalo.
//  • "ACM" é EXCLUSIVO — a critério médico não admite intervalo fixo nem
//    modificador; ao selecioná-lo, o campo de intervalo trava.

/** Sufixo canônico do modificador condicional. */
export const PRN_SUFFIX = 'S/N';

/** O intervalo carrega o modificador "se necessário"? (isolado ou como sufixo) */
export function hasPRN(posology?: string | null): boolean {
  const v = (posology || '').trim().toUpperCase();
  return v === 'S/N' || /\sS\/N$/.test(v);
}

/** Intervalo base, sem o modificador — "6/6h S/N" → "6/6h"; "S/N" → "". */
export function stripPRN(posology?: string | null): string {
  const v = (posology || '').trim();
  if (v.toUpperCase() === 'S/N') return '';
  return v.replace(/\s*S\/N\s*$/i, '').trim();
}

/** Liga/desliga o modificador preservando o intervalo base. */
export function withPRN(posology: string | null | undefined, on: boolean): string {
  const base = stripPRN(posology);
  if (!on) return base || '-';
  return base ? `${base} ${PRN_SUFFIX}` : PRN_SUFFIX;
}

/** ACM é exclusivo: trava o intervalo (não aceita esquema fixo nem S/N). */
export function isExclusiveInterval(posology?: string | null): boolean {
  return (posology || '').trim().toUpperCase() === 'ACM';
}

/** Dose imediata ("Agora") — não renova na virada de plantão. */
export function isNowInterval(posology?: string | null): boolean {
  return (posology || '').trim().toUpperCase() === 'AGORA';
}

/** Lista achatada de valores — útil para validações estritas. */
export const PRESCRIPTION_INTERVAL_VALUES: readonly string[] =
  PRESCRIPTION_INTERVALS.map(i => i.value);

/** Lookup rápido por valor. */
export function findInterval(value: string | undefined | null): PrescriptionInterval | undefined {
  if (!value) return undefined;
  return PRESCRIPTION_INTERVALS.find(i => i.value === value);
}

/** Quantas administrações em 24 h (default: 1). Compatível com `posologyToIntervals` legacy. */
export function intervalToPhases(value: string | undefined | null): number {
  const hit = findInterval(value || '');
  return hit?.phases ?? 1;
}

/**
 * Agrupamento ordenado para renderizar <SelectGroup> consistente.
 * Ordem: frequente → espacado → contínuo → condicional.
 */
export const INTERVAL_GROUPS: Array<{
  key: PrescriptionInterval['group'];
  title: string;
  items: PrescriptionInterval[];
}> = [
  { key: 'frequente',   title: 'Intervalo fixo',     items: PRESCRIPTION_INTERVALS.filter(i => i.group === 'frequente') },
  { key: 'espacado',    title: 'Espaçado (≥48h)',    items: PRESCRIPTION_INTERVALS.filter(i => i.group === 'espacado') },
  { key: 'continuo',    title: 'Contínuo / única',   items: PRESCRIPTION_INTERVALS.filter(i => i.group === 'continuo') },
  { key: 'condicional', title: 'Condicional',         items: PRESCRIPTION_INTERVALS.filter(i => i.group === 'condicional') },
];

/**
 * Compatibilidade com prescrições gravadas ANTES da unificação (22/07/2026).
 *
 * Itens antigos carregam as marcações como flags ('sn' | 'acm' | 'ag'). Esta
 * função dobra cada uma no campo INTERVALO equivalente e remove a flag legada,
 * para que nada se perca ao abrir uma prescrição antiga. É IDEMPOTENTE: itens
 * já normalizados passam intactos.
 *
 * Precedência: ACM é exclusivo e vence os demais. "Agora" só preenche o
 * intervalo quando ele está vazio (não sobrescreve um esquema já prescrito).
 */
export function normalizeLegacyIntervalFlags<
  T extends { posology?: string; flags?: readonly string[] }
>(item: T): T {
  const flags = item.flags ?? [];
  const hasLegacy = flags.some(f => f === 'sn' || f === 'acm' || f === 'ag');
  if (!hasLegacy) return item;

  const rest = flags.filter(f => f !== 'sn' && f !== 'acm' && f !== 'ag');
  let posology = (item.posology ?? '').trim();
  if (posology === '-') posology = '';

  if (flags.includes('acm')) {
    posology = 'ACM'; // exclusivo — descarta intervalo e modificador
  } else {
    if (flags.includes('ag') && !posology) posology = 'Agora';
    if (flags.includes('sn')) posology = withPRN(posology, true);
  }

  return { ...item, posology: posology || '-', flags: rest } as T;
}
