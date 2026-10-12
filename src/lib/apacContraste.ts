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
