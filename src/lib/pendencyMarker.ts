/**
 * Encoding leve para marcar uma pendência como "concluída" sem mudar o schema:
 * `[x 2026-11-27] texto` → concluída no dia 27/11/2026
 * `[x] texto`            → concluída (legado, sem data)
 * `[ ] texto`            → aberta (explícito)
 * `texto`                → aberta (legado)
 *
 * Persistência permanece string[] — compatível com print, hooks e PDF antigos.
 *
 * Regra clínica (Artur, 27/11/2026): pendência concluída fica visível no dia em que
 * foi concluída e some no dia seguinte, tanto da evolução nova quanto do Painel
 * Clínico. O registro dela permanece na evolução do dia da conclusão. Por isso a
 * marcação grava a DATA da conclusão — sem ela não há como saber quando sumir.
 */
const RE = /^\s*\[( |x|X)(?:\s+(\d{4}-\d{2}-\d{2}))?\]\s?/;

export interface ParsedPendency {
  done: boolean;
  text: string;
  /** Data local (yyyy-MM-dd) da conclusão; null quando aberta ou legado sem data. */
  doneOn: string | null;
}

export function parsePendency(raw: string): ParsedPendency {
  if (typeof raw !== "string") return { done: false, text: "", doneOn: null };
  const m = raw.match(RE);
  if (!m) return { done: false, text: raw, doneOn: null };
  const done = m[1].toLowerCase() === "x";
  return { done, text: raw.replace(RE, ""), doneOn: done ? m[2] ?? null : null };
}

/** Data local de hoje no formato yyyy-MM-dd (fuso do aparelho, nao UTC). */
export function todayLocalISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

/**
 * Marca/desmarca. Ao concluir, grava a data: mantem a data que a linha ja tinha
 * (re-marcar nao "renova" a pendencia), senao usa `doneOn` ou hoje.
 */
export function setPendencyDone(raw: string, done: boolean, doneOn?: string | null): string {
  const p = parsePendency(raw);
  if (!p.text.trim() && !done) return ""; // mantém vazio limpo
  if (!done) return `[ ] ${p.text}`;
  const date = (p.done && p.doneOn) || doneOn || todayLocalISO();
  return `[x ${date}] ${p.text}`;
}

/** Troca o texto mantendo o marcador (estado e data de conclusao). */
export function setPendencyText(raw: string, text: string): string {
  const p = parsePendency(raw);
  if (!p.done) return setPendencyDone(text, false);
  return p.doneOn ? `[x ${p.doneOn}] ${text}` : `[x] ${text}`;
}

export function stripPendencyMarker(raw: string): string {
  return parsePendency(raw).text;
}

/**
 * Concluida em dia anterior a `today` — ou concluida sem data (legado, anterior a
 * esta regra): nao deve mais aparecer nem ser regravada na fonte.
 */
export function isStaleDonePendency(raw: string, today: string = todayLocalISO()): boolean {
  const p = parsePendency(raw);
  if (!p.done) return false;
  return !p.doneOn || p.doneOn < today;
}

/** Remove as pendencias concluidas em dia anterior (ver isStaleDonePendency). */
export function pruneStaleDonePendencies(lines: string[], today: string = todayLocalISO()): string[] {
  return lines.filter((l) => !isStaleDonePendency(l, today));
}
