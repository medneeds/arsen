/**
 * Contraste nos exames de alta complexidade (TC/RM) do laudo APAC.
 *
 * No SIGTAP o codigo da tomografia/ressonancia cobre "com ou sem contraste": nao ha
 * codigo separado. Por isso o contraste vai EXPLICITO no texto — sufixo no nome do
 * procedimento (campo 16/19/...) e linha nas observacoes (campo 37) — e o codigo
 * nao muda. Angiotomografia/angiorressonancia sao com contraste por natureza.
 *
 * Funcoes puras (sem I/O) para serem testadas fora do React.
 */
import { parseMaybeJsonArray } from "./admissionSoapNormalizer.ts";

export const CONTRASTE_SUFFIX = " — COM CONTRASTE";

const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

/** TC e RM (nao Doppler, nao angio isolado de outra familia) aceitam a marcacao. */
export function supportsContraste(name: string, code?: string): boolean {
  const n = norm(name);
  const c = (code || "").replace(/\D/g, "");
  return (
    n.includes("TOMOGRAFIA") || n.includes("RESSONANCIA") || n.includes("ANGIOTOMOGRAFIA") || n.includes("ANGIORRESSONANCIA") ||
    c.startsWith("0206") || c.startsWith("0207")
  );
}

/** Angiotomografia / angiorressonancia: o contraste faz parte do exame. */
export function isContrasteInerente(name: string): boolean {
  const n = norm(name);
  return n.startsWith("ANGIOTOMOGRAFIA") || n.startsWith("ANGIORRESSONANCIA") || n.startsWith("ANGIO ");
}

export interface ContrasteProc {
  name: string;
  code?: string;
  contraste?: boolean;
}

/** O exame sai com contraste? (marcado pelo medico ou inerente). So vale onde se aplica. */
export function comContraste(p: ContrasteProc): boolean {
  if (!supportsContraste(p.name, p.code)) return false;
  return !!p.contraste || isContrasteInerente(p.name);
}

/** Nome para o laudo/registro: acrescenta "— COM CONTRASTE" uma unica vez. */
export function procedureDisplayName(p: ContrasteProc): string {
  const base = (p.name || "").trim();
  if (!comContraste(p) || norm(base).includes("CONTRASTE")) return base;
  return base + CONTRASTE_SUFFIX;
}

// ─── Contraste como CODIGO faturavel (SIGTAP 202609) ───────────────
// No SIGTAP atual o contraste e um procedimento separado, com reembolso proprio.
// Quando o exame (TC/RM) e contrastado, o laudo deve incluir ESTE codigo como
// uma linha adicional (alem de manter a marcacao "— COM CONTRASTE" no nome).
export const CONTRASTE_TC = { code: "02.06.03.004-5", name: "CONTRASTE PARA TOMOGRAFIA COMPUTADORIZADA" } as const;
export const CONTRASTE_RM = { code: "02.06.03.005-3", name: "CONTRASTE PARA RESSONÂNCIA MAGNÉTICA" } as const;

/**
 * Linha de contraste faturavel para um exame contrastado, ou null se nao se
 * aplica. TC -> CONTRASTE PARA TC; RM -> CONTRASTE PARA RM. Doppler/USG e exames
 * que ja trazem "contraste" no nome (TC coluna "c/ ou s/ contraste") nao geram
 * linha extra — comContraste ja cuida de supportsContraste, e o nome embutido e
 * tratado abaixo.
 */
export function contrasteLineFor(p: ContrasteProc): { code: string; name: string } | null {
  // So quando o medico MARCA contraste explicitamente num TC/RM comum.
  if (!p.contraste) return null;
  if (!supportsContraste(p.name, p.code)) return null;
  // Exame inerentemente contrastado (angiotomografia/angiorressonancia): o
  // contraste ja esta embutido no codigo/valor do exame — nao bitributar.
  if (isContrasteInerente(p.name)) return null;
  // Exame cujo PROPRIO codigo ja cobre o contraste ("C/ OU S/ CONTRASTE" no nome).
  if (norm(p.name).includes("CONTRASTE")) return null;
  const code = (p.code || "").replace(/\D/g, "");
  const isRM = norm(p.name).includes("RESSONANCIA") || code.startsWith("0207");
  return isRM ? { ...CONTRASTE_RM } : { ...CONTRASTE_TC };
}

export interface ApacBillingLine { code: string; name: string; qty: number; }

/**
 * Expande os procedimentos do laudo para faturamento: cada exame contrastado
 * (TC/RM) ganha, logo apos ele, uma linha com o codigo de contraste
 * correspondente, com a mesma quantidade. Fonte UNICA usada no save e na
 * impressao para que registro e laudo batam.
 */
export function expandApacBilling(procs: Array<ContrasteProc & { qty?: number }>): ApacBillingLine[] {
  const out: ApacBillingLine[] = [];
  for (const p of procs) {
    const qty = Math.max(1, Math.floor(Number(p.qty) || 1));
    out.push({ code: p.code || "", name: procedureDisplayName(p), qty });
    const c = contrasteLineFor(p);
    if (c) out.push({ code: c.code, name: c.name, qty });
  }
  return out;
}

const SHORT: Array<[RegExp, string]> = [
  [/^TOMOGRAFIA COMPUTADORIZADA\s+(DE|DO|DA)?\s*/i, "TC "],
  [/^RESSON[ÂA]NCIA MAGN[ÉE]TICA\s+(DE|DO|DA)?\s*/i, "RM "],
  [/^ANGIOTOMOGRAFIA\s+(DE|DO|DA)?\s*/i, "ANGIOTC "],
];

function shortLabel(name: string): string {
  let out = name.trim();
  for (const [re, rep] of SHORT) {
    if (re.test(out)) { out = out.replace(re, rep); break; }
  }
  return out.replace(/\s+/g, " ").trim();
}

/**
 * Linha para o campo de observacoes: "Contraste: TC CRANIO e RM CRANIO com contraste."
 * A partir dos nomes JA exibidos (com sufixo) — serve tambem na reimpressao pelo historico.
 */
export function contrasteObservation(displayNames: string[]): string {
  const list = displayNames
    .filter((n) => (n || "").toUpperCase().endsWith(CONTRASTE_SUFFIX.trim().toUpperCase()) || (n || "").toUpperCase().includes(CONTRASTE_SUFFIX.toUpperCase()))
    .map((n) => shortLabel(n.replace(new RegExp(CONTRASTE_SUFFIX.replace(/[—]/g, "[—-]") + "$", "i"), "")));
  if (list.length === 0) return "";
  const joined = list.length === 1 ? list[0] : `${list.slice(0, -1).join(", ")} e ${list[list.length - 1]}`;
  return `Contraste: ${joined} com contraste.`;
}

/** Observacoes + linha de contraste (sem duplicar se ja existir). */
export function observationsWithContraste(observations: string, displayNames: string[]): string {
  const line = contrasteObservation(displayNames);
  const base = (observations || "").trimEnd();
  if (!line || base.includes(line)) return base;
  return base ? `${base}\n${line}` : line;
}

/**
 * Hipotese diagnostica gravada como lista serializada (["a","b"]) vira texto limpo
 * ("a; b"). Texto comum passa como veio.
 */
export function cleanDiagnosisText(raw: unknown): string {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  const arr = parseMaybeJsonArray(t);
  return arr ? arr.join("; ") : t;
}
