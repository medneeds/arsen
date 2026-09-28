/**
 * Deriva o NUMERO de unidades a dispensar (ampolas, frascos, comprimidos...) a
 * partir da DOSE prescrita e da FORCA por unidade da apresentacao.
 *
 * Motivacao (auditoria clinica): a apresentacao ja traz a forca por unidade
 * (ex.: "500mg - Frasco-ampola"); quando a dose e "1g", isso sao 2 FA. O campo
 * Qtd nunca derivava disso, e a dose podia contradizer a Qtd em silencio
 * (Vancomicina: Qtd "1 AMP" para uma dose de 1g que exige 2 FA).
 *
 * REGRA DE OURO: em caso de duvida, NAO calcula — devolve motivo para a tela
 * avisar. Nunca arredonda uma unidade discreta nem inventa contagem.
 *
 * Funcoes puras, sem dependencia de React/catalogo — testadas em
 * src/tests/dose-to-units.test.ts.
 */

export type DoseUnitsResult =
  | { ok: true; quantity: string; unit: string; perUnitDose: string }
  | { ok: false; reason: string };

const norm = (s?: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// Grandezas oferecidas no campo de dose + as que aparecem nas apresentacoes.
// factor converte para a unidade-base da dimensao (massa->mg, volume->mL,
// atividade->UI, eletrolito->mEq).
const UNIT_DIM: Record<string, { dim: 'massa' | 'volume' | 'ui' | 'meq'; factor: number }> = {
  mcg: { dim: 'massa', factor: 0.001 },
  ug: { dim: 'massa', factor: 0.001 },
  mg: { dim: 'massa', factor: 1 },
  g: { dim: 'massa', factor: 1000 },
  ml: { dim: 'volume', factor: 1 },
  ui: { dim: 'ui', factor: 1 },
  u: { dim: 'ui', factor: 1 },
  meq: { dim: 'meq', factor: 1 },
};

// Formas farmaceuticas CONTAVEIS -> valor canonico do seletor de Forma (Qtd).
// So calculamos contagem para estas; fora daqui, silencio (nao ha o que contar).
const COUNTABLE_FORMA: { match: string; canonical: string }[] = [
  { match: 'frasco-ampola', canonical: 'frasco-ampola' },
  { match: 'frasco ampola', canonical: 'frasco-ampola' },
  { match: 'ampola', canonical: 'ampola' },
  { match: 'frasco', canonical: 'frasco' },
  { match: 'comprimido', canonical: 'comprimido' },
  { match: 'capsula', canonical: 'cápsula' },
  { match: 'bolsa', canonical: 'bolsa' },
  { match: 'sache', canonical: 'sachê' },
  { match: 'envelope', canonical: 'envelope' },
  { match: 'adesivo', canonical: 'adesivo' },
  { match: 'supositorio', canonical: 'supositório' },
  { match: 'ovulo', canonical: 'óvulo' },
];

// Ex.: "667mg/mL", "2mEq/mL", "40UI/mL" — a forca lider e CONCENTRACAO, nao o
// conteudo por unidade: o nº de frascos NAO e dose/concentracao. (Lactulose.)
const CONCENTRATION_RE = /(\d[\d.,]*)\s*(mcg|ug|mg|g|ui|u|meq)\s*\/\s*ml/i;

// Dose que NAO e um numero unico: faixa, condicional, por peso, por superficie.
const RANGE_RE = /\d\s*(?:[–-]|a|e|\/|ate|até)\s*\d/i;
const CONDITIONAL_RE = /(acm|s\/n|sos|se necess|conforme|criterio|crit[ée]rio|titul|livre demanda)/i;
const WEIGHT_RE = /\/\s*kg|kg\/|\bkg\b|\/\s*m2|\bm2\b|superficie/i;

const AMOUNT_RE = /([\d]+(?:[.,]\d+)?)\s*(mcg|µg|ug|mg|g|ml|ui|u|meq)(?![a-zµ])/gi;

interface Amount { dim: string; base: number }

function parseAllAmounts(text: string): Amount[] {
  const out: Amount[] = [];
  const t = norm(text);
  for (const m of t.matchAll(AMOUNT_RE)) {
    const value = parseFloat(m[1].replace(',', '.'));
    const u = UNIT_DIM[m[2].toLowerCase()];
    if (u && Number.isFinite(value)) out.push({ dim: u.dim, base: value * u.factor });
  }
  return out;
}

export interface PresentationStrength {
  /** Valor canonico da Forma para o seletor de Qtd (ex.: "frasco-ampola"). */
  forma: string | null;
  /** Forca por unidade, convertida para a base da dimensao. null se ausente. */
  base: number | null;
  dim: string | null;
  /** Forca por unidade VERBATIM da apresentacao (ex.: "500mg", "10mL"). Vai
   *  para o campo `dose` para o impresso multiplicar corretamente pela Qtd. */
  perUnitLabel: string | null;
  isConcentration: boolean;
}

// Primeiro valor+unidade VERBATIM (preserva grafia/virgula da apresentacao).
const VERBATIM_AMOUNT_RE = /(\d[\d.,]*)\s*(mcg|µg|ug|mg|g|ml|ui|u|meq)(?![a-zµ])/i;

/**
 * Le a apresentacao ("500mg - Frasco-ampola", "10mL - Ampola") e extrai a Forma
 * contavel e a forca por unidade. Detecta apresentacao em concentracao.
 */
export function parsePresentationStrength(presentation?: string): PresentationStrength {
  const raw = presentation || '';
  const p = norm(raw);
  const forma = COUNTABLE_FORMA.find((f) => p.includes(f.match))?.canonical ?? null;

  if (CONCENTRATION_RE.test(raw)) {
    return { forma, base: null, dim: null, perUnitLabel: null, isConcentration: true };
  }
  const first = parseAllAmounts(raw)[0];
  const verbatim = raw.match(VERBATIM_AMOUNT_RE);
  return {
    forma,
    base: first ? first.base : null,
    dim: first ? first.dim : null,
    perUnitLabel: verbatim ? verbatim[0].replace(/\s+/g, '') : null,
    isConcentration: false,
  };
}

// Grandezas do seletor de dose -> valor canonico exibido.
const DOSE_UNIT_CANON: Record<string, string> = {
  mcg: 'mcg', 'µg': 'mcg', ug: 'mcg', mg: 'mg', g: 'g',
  ml: 'mL', ui: 'UI', u: 'UI', meq: 'mEq', gota: 'gota', gotas: 'gota', gts: 'gota',
};

/**
 * Separa o valor numerico da grandeza no INICIO de um texto de dose, para
 * pre-preencher os campos valor+grandeza. So aceita "<numero> <grandeza>" no
 * comeco ("1g", "500mg", "1g (10mL)" -> 1 g). Faixa/ACM/texto -> null (o campo
 * fica em modo texto livre).
 */
export function splitDose(text?: string): { value: string; unit: string } | null {
  const m = (text || '').trim().match(/^(\d+(?:[.,]\d+)?)\s*(mcg|µg|ug|mg|g|ml|ui|u|meq|gotas?|gts)\b/i);
  if (!m) return null;
  const unit = DOSE_UNIT_CANON[m[2].toLowerCase()];
  return unit ? { value: m[1], unit } : null;
}

/** Numero em pt-BR curto: 2, 1,5. */
function fmt(n: number): string {
  return (Math.round(n * 100) / 100).toLocaleString('pt-BR');
}

/**
 * Calcula a Qtd (numero de unidades da Forma da apresentacao) para a dose dada.
 *
 * Retorno:
 *  - null            -> nada a calcular (sem dose, ou Forma nao contavel): silencio.
 *  - { ok:false }    -> ha dose e Forma contavel, mas NAO da para derivar com
 *                       seguranca: a tela mostra o motivo como aviso discreto.
 *  - { ok:true }     -> quantity + unit prontos para preencher a Qtd.
 */
export function computeUnitsFromDose(args: {
  presentation?: string;
  dose?: string;
  doseValue?: string;
  doseUnit?: string;
}): DoseUnitsResult | null {
  const pres = parsePresentationStrength(args.presentation);
  if (!pres.forma) return null; // apresentacao nao contavel -> nada a contar

  const doseText =
    args.doseValue && args.doseUnit ? `${args.doseValue}${args.doseUnit}` : args.dose || '';
  if (!doseText.trim()) return null; // dose opcional: sem dose, sem aviso

  if (RANGE_RE.test(norm(doseText)) || CONDITIONAL_RE.test(norm(doseText)))
    return { ok: false, reason: 'dose variável ou condicional — informe a Qtd manualmente' };
  if (WEIGHT_RE.test(norm(doseText)))
    return { ok: false, reason: 'dose por peso/superfície — informe a Qtd manualmente' };

  if (pres.isConcentration || pres.base == null || pres.dim == null)
    return { ok: false, reason: 'apresentação em concentração — informe a Qtd manualmente' };
  if (pres.base <= 0) return null;

  const amounts = parseAllAmounts(doseText);
  const match = amounts.find((a) => a.dim === pres.dim);
  if (!match)
    return { ok: false, reason: 'a unidade da dose não corresponde à apresentação' };

  const count = match.base / pres.base;
  if (!Number.isFinite(count) || count <= 0) return null;

  const rounded = Math.round(count);
  if (Math.abs(count - rounded) > 1e-6)
    return {
      ok: false,
      reason: `a dose não é múltiplo inteiro da apresentação (≈ ${fmt(count)} ${pres.forma})`,
    };

  return {
    ok: true,
    quantity: String(rounded),
    unit: pres.forma,
    perUnitDose: pres.perUnitLabel ?? '',
  };
}
