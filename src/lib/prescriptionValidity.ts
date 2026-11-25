/**
 * Vigencia da prescricao: 12:00 do dia D ate 12:00 do dia D+1 (America/Fortaleza).
 * Fonte UNICA para aprazamento, checagem, ambiente do tecnico, BH e painel do setor.
 *
 * Regra: um instante antes das 12:00 pertence a janela que TERMINA as 12:00 daquele
 * dia; a partir das 12:00 comeca a janela nova. Doses depois de `end` nao sao
 * aprazadas: aparecem na coluna "proxima prescricao".
 */
import { fortalezaLocal, fortalezaParts } from "./docPrefixes.ts";

export interface ValidityWindow { start: Date; end: Date }

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export function prescriptionValidityWindow(ref: Date): ValidityWindow {
  const p = fortalezaParts(ref);
  const noonToday = fortalezaLocal(p.year, p.month, p.day, 12, 0);
  const start = p.hour >= 12 ? noonToday : new Date(noonToday.getTime() - DAY_MS);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/** Ordem de exibicao das horas na grade da janela: 12..23, 0..11. */
export const VALIDITY_HOURS: readonly number[] = Object.freeze([
  ...Array.from({ length: 12 }, (_, i) => 12 + i),
  ...Array.from({ length: 12 }, (_, i) => i),
]);

/** start <= d < end */
export function isInsideWindow(d: Date, w: ValidityWindow): boolean {
  const t = d.getTime();
  return t >= w.start.getTime() && t < w.end.getTime();
}

/** Instante da hora local `hour` (0-23) dentro da janela (12..23 no dia D; 0..11 no D+1). */
export function windowHourToDate(w: ValidityWindow, hour: number, minute = 0): Date {
  const offsetH = hour >= 12 ? hour - 12 : hour + 12;
  return new Date(w.start.getTime() + offsetH * HOUR_MS + minute * 60_000);
}

/** Janela seguinte (para a coluna "proxima prescricao"). */
export function nextWindow(w: ValidityWindow): ValidityWindow {
  return { start: w.end, end: new Date(w.end.getTime() + DAY_MS) };
}
