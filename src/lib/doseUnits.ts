/**
 * Catálogo canônico de unidades de dose (Guia ATB / Prescrição).
 *
 * Lista fechada (decisão do PO): médico escolhe; sem campo livre. Se faltar
 * uma unidade clinicamente relevante, **adicionar aqui** e propagar — não
 * usar fallback de texto livre, que reintroduz erro de digitação.
 *
 * Cada unidade tem `value` (token canônico armazenado), `label` (UI) e
 * `family` (massa, volume, atividade, unidade-prática, eletrólito) — útil
 * para validação cruzada futura.
 */

export type DoseUnitFamily = 'massa' | 'volume' | 'atividade' | 'pratica' | 'eletrolito';

export interface DoseUnit {
  value: string;
  label: string;
  family: DoseUnitFamily;
}

export const DOSE_UNITS: DoseUnit[] = [
  // Massa
  { value: 'g',   label: 'g',   family: 'massa' },
  { value: 'mg',  label: 'mg',  family: 'massa' },
  { value: 'mcg', label: 'mcg', family: 'massa' },

  // Atividade biológica
  { value: 'UI',  label: 'UI',  family: 'atividade' },

  // Volume
  { value: 'mL',  label: 'mL',  family: 'volume' },

  // Unidades práticas de embalagem
  { value: 'ampola',        label: 'ampola',        family: 'pratica' },
  { value: 'frasco-ampola', label: 'frasco-ampola', family: 'pratica' },
  { value: 'frasco',        label: 'frasco',        family: 'pratica' },
  { value: 'comprimido',    label: 'comprimido',    family: 'pratica' },

  // Eletrólitos
  { value: 'mEq',  label: 'mEq',  family: 'eletrolito' },
  { value: 'mmol', label: 'mmol', family: 'eletrolito' },
];

export const DOSE_UNIT_VALUES: readonly string[] = DOSE_UNITS.map(u => u.value);

/**
 * Tenta extrair `{value, unit}` de uma string de dose legacy ("1 g", "500 mg",
 * "1.200.000 UI", "30 mL", "3 ampolas"). Retorna `undefined` se não der match
 * confiável — nesse caso a UI deixa o seletor vazio e o médico escolhe.
 */
export function parseDoseLegacy(raw: string | undefined | null): { value: string; unit: string } | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  // Aceita números com . , ou separador de milhar
  const m = s.match(/^([\d.,]+)\s*([a-zA-ZµμÁÉÍÓÚáéíóú/-]+)/);
  if (!m) return undefined;
  const numRaw = m[1];
  const unitRaw = m[2];
  // Normaliza unidade
  const u = unitRaw.toLowerCase();
  const map: Record<string, string> = {
    g: 'g', mg: 'mg', mcg: 'mcg', µg: 'mcg', μg: 'mcg',
    ui: 'UI', u: 'UI', un: 'UI',
    ml: 'mL',
    ampola: 'ampola', ampolas: 'ampola', amp: 'ampola',
    'frasco-ampola': 'frasco-ampola', fa: 'frasco-ampola',
    frasco: 'frasco', frascos: 'frasco', fr: 'frasco',
    comprimido: 'comprimido', comprimidos: 'comprimido', cp: 'comprimido', comp: 'comprimido',
    meq: 'mEq', mmol: 'mmol',
  };
  const unit = map[u];
  if (!unit) return undefined;
  return { value: numRaw, unit };
}

/** Compõe a string canônica `${value} ${unit}` — compatível com leitores legacy de `dose`. */
export function formatDose(value: string | undefined | null, unit: string | undefined | null): string {
  const v = (value || '').trim();
  const u = (unit || '').trim();
  if (!v && !u) return '';
  if (!v) return u;
  if (!u) return v;
  return `${v} ${u}`;
}
