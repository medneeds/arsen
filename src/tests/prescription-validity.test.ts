/** Vigencia da prescricao 12h -> 12h (America/Fortaleza). */
import { test } from "node:test";
import assert from "node:assert";
import { prescriptionValidityWindow, isInsideWindow, VALIDITY_HOURS, windowHourToDate, nextWindow } from "../lib/prescriptionValidity.ts";
import { fortalezaLocal, fortalezaParts } from "../lib/docPrefixes.ts";

const iso = (d: Date) => d.toISOString();

test("criada 09:00 do dia D pertence a janela que TERMINA as 12:00 de D", () => {
  const w = prescriptionValidityWindow(fortalezaLocal(2026, 11, 25, 9, 0));
  assert.strictEqual(iso(w.start), iso(fortalezaLocal(2026, 11, 24, 12, 0)));
  assert.strictEqual(iso(w.end), iso(fortalezaLocal(2026, 11, 25, 12, 0)));
});

test("criada 13:00 do dia D abre a janela D 12:00 -> D+1 12:00", () => {
  const w = prescriptionValidityWindow(fortalezaLocal(2026, 11, 25, 13, 0));
  assert.strictEqual(iso(w.start), iso(fortalezaLocal(2026, 11, 25, 12, 0)));
  assert.strictEqual(iso(w.end), iso(fortalezaLocal(2026, 11, 26, 12, 0)));
});

test("exatamente 12:00 ja e a janela nova; 11:59 ainda e a anterior", () => {
  assert.strictEqual(iso(prescriptionValidityWindow(fortalezaLocal(2026, 11, 25, 12, 0)).start), iso(fortalezaLocal(2026, 11, 25, 12, 0)));
  assert.strictEqual(iso(prescriptionValidityWindow(fortalezaLocal(2026, 11, 25, 11, 59)).start), iso(fortalezaLocal(2026, 11, 24, 12, 0)));
});

test("virada de mes e de ano", () => {
  const w = prescriptionValidityWindow(fortalezaLocal(2026, 12, 31, 20, 0));
  assert.strictEqual(iso(w.end), iso(fortalezaLocal(2027, 1, 1, 12, 0)));
  const w2 = prescriptionValidityWindow(fortalezaLocal(2027, 1, 1, 3, 0));
  assert.strictEqual(iso(w2.start), iso(fortalezaLocal(2026, 12, 31, 12, 0)));
});

test("fuso: 01:00 UTC e 22:00 do dia anterior em Sao Luis", () => {
  const ref = new Date(Date.UTC(2026, 10, 26, 1, 0)); // 25/11 22:00 local
  const p = fortalezaParts(ref);
  assert.deepStrictEqual([p.day, p.hour], [25, 22]);
  assert.strictEqual(iso(prescriptionValidityWindow(ref).start), iso(fortalezaLocal(2026, 11, 25, 12, 0)));
});

test("grade 12..23, 0..11 e hora -> instante na janela", () => {
  assert.deepStrictEqual([...VALIDITY_HOURS], [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  const w = prescriptionValidityWindow(fortalezaLocal(2026, 11, 25, 13, 0));
  assert.strictEqual(iso(windowHourToDate(w, 18)), iso(fortalezaLocal(2026, 11, 25, 18, 0)));
  assert.strictEqual(iso(windowHourToDate(w, 6)), iso(fortalezaLocal(2026, 11, 26, 6, 0)));
});

test("limites: start dentro, end fora; proxima janela encadeada", () => {
  const w = prescriptionValidityWindow(fortalezaLocal(2026, 11, 25, 13, 0));
  assert.strictEqual(isInsideWindow(w.start, w), true);
  assert.strictEqual(isInsideWindow(w.end, w), false);
  assert.strictEqual(iso(nextWindow(w).start), iso(w.end));
});
