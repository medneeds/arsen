/**
 * Dispositivos ativos e dias de dispositivo/VM — fonte unica para fisioterapia,
 * bundle PAV, cockpit e SBAR. Puro.
 *
 * Contagem de dias igual a do impresso (calcDIH): dias de calendario desde a
 * insercao (dia da insercao = D0), no fuso de Sao Luis.
 * Ventilacao mecanica: IOT -> TQT sem intervalo (ate 24h entre retirada e nova
 * via aerea) e UMA ventilacao — a troca nao zera a contagem.
 */
import { fortalezaParts } from "./docPrefixes.ts";

export interface Dispositivo {
  id: string;
  /** Chave do devicesCatalog: iot, tqt, cvc, svd, snesog, dreno, pai... */
  tipo: string;
  insertedAt: Date;
  removedAt?: Date | null;
  detalhe?: string | null;
}

export const VIA_AEREA_VM: readonly string[] = ["iot", "tqt"];
const DAY_MS = 86_400_000;
const GAP_MAX_MS = DAY_MS;

function dayNumber(d: Date): number {
  const p = fortalezaParts(d);
  return Math.floor(Date.UTC(p.year, p.month - 1, p.day) / DAY_MS);
}

/** Dias de calendario entre `from` e `at` (D0 no dia de `from`); nunca negativo. */
export function calendarDays(from: Date, at: Date): number {
  return Math.max(0, dayNumber(at) - dayNumber(from));
}

export function isActiveAt(d: Dispositivo, at: Date): boolean {
  if (d.insertedAt.getTime() > at.getTime()) return false;
  return !d.removedAt || d.removedAt.getTime() > at.getTime();
}

export function getActiveDevices(list: Dispositivo[], at: Date): Dispositivo[] {
  return list.filter((d) => isActiveAt(d, at)).sort((a, b) => a.insertedAt.getTime() - b.insertedAt.getTime());
}

export function daysOn(d: Dispositivo, at: Date): number {
  return calendarDays(d.insertedAt, at);
}

/** Inicio da ventilacao mecanica vigente em `at` (cadeia IOT/TQT), ou null. */
export function ventilationStart(list: Dispositivo[], at: Date): Date | null {
  const vias = list
    .filter((d) => VIA_AEREA_VM.includes(d.tipo) && d.insertedAt.getTime() <= at.getTime())
    .sort((a, b) => a.insertedAt.getTime() - b.insertedAt.getTime());
  const atual = vias.filter((d) => isActiveAt(d, at)).pop();
  if (!atual) return null;
  let inicio = atual.insertedAt;
  // Recua pela cadeia enquanto a via anterior terminou ate 24h antes do inicio atual.
  for (let i = vias.indexOf(atual) - 1; i >= 0; i--) {
    const prev = vias[i];
    const fim = prev.removedAt ? prev.removedAt.getTime() : Infinity;
    if (fim >= inicio.getTime() - GAP_MAX_MS) {
      if (prev.insertedAt.getTime() < inicio.getTime()) inicio = prev.insertedAt;
    } else break;
  }
  return inicio;
}

/** "D4 de VM" | null quando sem via aerea artificial ativa. */
export function ventilationDayLabel(list: Dispositivo[], at: Date): string | null {
  const inicio = ventilationStart(list, at);
  return inicio ? `D${calendarDays(inicio, at)} de VM` : null;
}
