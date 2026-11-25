/** Balanco hidrico 07 -> 07 e volume enteral infundido (fonte unica BH x nutricao). */
import { test } from "node:test";
import assert from "node:assert";
import { periodoBH, computeFluidBalance, computeInfusedEnteral, type Lancamento } from "../lib/fluidBalance.ts";
import { fortalezaLocal } from "../lib/docPrefixes.ts";

const P = periodoBH(fortalezaLocal(2026, 11, 25, 10, 0));
const L = (d: number, h: number, sentido: "ganho" | "perda", categoria: string, volumeMl: number, extra: Partial<Lancamento> = {}): Lancamento =>
  ({ dataHora: fortalezaLocal(2026, 11, d, h, 0), sentido, categoria, volumeMl, origem: "manual", ...extra });

test("periodo: 06:59 pertence ao BH do dia anterior; 07:00 abre o novo", () => {
  assert.strictEqual(periodoBH(fortalezaLocal(2026, 11, 25, 6, 59)).start.getTime(), fortalezaLocal(2026, 11, 24, 7).getTime());
  assert.strictEqual(periodoBH(fortalezaLocal(2026, 11, 25, 7, 0)).start.getTime(), fortalezaLocal(2026, 11, 25, 7).getTime());
});

test("parciais 07–13, 13–19, 19–07 e total", () => {
  const r = computeFluidBalance([
    L(25, 8, "ganho", "ev_continuo", 500), L(25, 10, "perda", "diurese", 300),
    L(25, 14, "ganho", "oral", 200), L(25, 22, "perda", "diurese", 400), L(26, 3, "ganho", "dieta_enteral", 250),
  ], P, { pesoKg: 70, incluirInsensiveis: false });
  assert.deepStrictEqual(r.parciais, { t07_13: 200, t13_19: 200, t19_07: -150 });
  assert.deepStrictEqual([r.ganhos, r.perdas, r.balanco], [950, 700, 250]);
});

test("insensiveis: desligado por padrao; ligado = 10 mL/kg/24h", () => {
  const off = computeFluidBalance([], P, { pesoKg: 70, incluirInsensiveis: false });
  assert.strictEqual(off.insensiveis, null);
  const on = computeFluidBalance([], P, { pesoKg: 70, incluirInsensiveis: true });
  assert.strictEqual(on.insensiveis, 700);
  assert.strictEqual(on.balanco, -700);
});

test("insensiveis com febre: +10% por grau nas horas febris", () => {
  const r = computeFluidBalance([], P, { pesoKg: 70, incluirInsensiveis: true, horasFebre: 12, grausAcima: 1 });
  assert.strictEqual(r.insensiveis, 735);
});

test("sem peso: nao calcula insensiveis nem mL/kg/h e avisa", () => {
  const r = computeFluidBalance([L(25, 8, "perda", "diurese", 100)], P, { pesoKg: null, incluirInsensiveis: true });
  assert.strictEqual(r.insensiveis, null);
  assert.strictEqual(r.diureseMlKgH, null);
  assert.strictEqual(r.alertas.some((a) => a.tipo === "sem_peso"), true);
});

test("oliguria: < 0,5 mL/kg/h nas ultimas 6h", () => {
  const lanc = [L(25, 7, "perda", "diurese", 200), L(25, 8, "perda", "diurese", 10), L(25, 9, "perda", "diurese", 10),
    L(25, 10, "perda", "diurese", 10), L(25, 11, "perda", "diurese", 10), L(25, 12, "perda", "diurese", 10), L(25, 13, "perda", "diurese", 10)];
  const r = computeFluidBalance(lanc, P, { pesoKg: 70, incluirInsensiveis: false, agora: fortalezaLocal(2026, 11, 25, 14) });
  assert.strictEqual(r.alertas.some((a) => a.tipo === "oliguria"), true);
  const ok = computeFluidBalance(lanc.map((l) => ({ ...l, volumeMl: 60 })), P, { pesoKg: 70, incluirInsensiveis: false, agora: fortalezaLocal(2026, 11, 25, 14) });
  assert.strictEqual(ok.alertas.some((a) => a.tipo === "oliguria"), false);
});

test("lancamento anulado, fora do periodo ou volume invalido nao entra", () => {
  const r = computeFluidBalance([
    L(25, 8, "ganho", "oral", 300, { anulado: true }), L(24, 22, "ganho", "oral", 999),
    L(25, 9, "ganho", "oral", -50), L(25, 9, "ganho", "oral", Number.NaN), L(25, 9, "ganho", "oral", 100),
  ], P, { pesoKg: 70, incluirInsensiveis: false });
  assert.strictEqual(r.ganhos, 100);
});

test("infused enteral: 62 mL/h com pausas banho 09h e TC 15–17h — mesmo valor na nutricao e no BH", () => {
  const ini = fortalezaLocal(2026, 11, 25, 7);
  const fim = fortalezaLocal(2026, 11, 26, 7);
  const pausas = [
    { inicio: fortalezaLocal(2026, 11, 25, 9), fim: fortalezaLocal(2026, 11, 25, 10) },
    { inicio: fortalezaLocal(2026, 11, 25, 15), fim: fortalezaLocal(2026, 11, 25, 17) },
  ];
  const v = computeInfusedEnteral(62, ini, fim, pausas);
  assert.strictEqual(v, 62 * 21);
  const bh = computeFluidBalance([{ dataHora: ini, sentido: "ganho", categoria: "dieta_enteral", volumeMl: v, origem: "dieta" }], P, { pesoKg: 70, incluirInsensiveis: false });
  assert.strictEqual(bh.ganhos, v);
});

test("infused enteral: pausas sobrepostas e fora do intervalo nao contam duas vezes", () => {
  const ini = fortalezaLocal(2026, 11, 25, 7);
  const fim = fortalezaLocal(2026, 11, 25, 17);
  const v = computeInfusedEnteral(50, ini, fim, [
    { inicio: fortalezaLocal(2026, 11, 25, 9), fim: fortalezaLocal(2026, 11, 25, 11) },
    { inicio: fortalezaLocal(2026, 11, 25, 10), fim: fortalezaLocal(2026, 11, 25, 12) },
    { inicio: fortalezaLocal(2026, 11, 25, 5), fim: fortalezaLocal(2026, 11, 25, 6) },
    { inicio: fortalezaLocal(2026, 11, 25, 16), fim: fortalezaLocal(2026, 11, 25, 20) },
  ]);
  assert.strictEqual(v, 50 * 6);
  assert.strictEqual(computeInfusedEnteral(0, ini, fim, []), 0);
  assert.strictEqual(computeInfusedEnteral(50, fim, ini, []), 0);
});
