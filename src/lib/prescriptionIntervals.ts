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

  // ── Condicionais ───────────────────────────────────────────────────────────
  { value: 'S/N', label: 'S/N (se necessário)', phases: 0, group: 'condicional' },
  { value: 'ACM', label: 'ACM (a critério médico)', phases: 0, group: 'condicional' },
];

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
