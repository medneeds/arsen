/** PDF ENF-BH: mesmo numero da tela (aceite da etapa 4a) e casos de borda. */
import { test } from "node:test";
import assert from "node:assert";
import { buildBalancoHidricoBody, type BalancoDocInput } from "../lib/balancoHidricoDoc.ts";
import { computeFluidBalance, periodoBH, formatMl, type Lancamento } from "../lib/fluidBalance.ts";
import { fortalezaLocal } from "../lib/docPrefixes.ts";

const P = periodoBH(fortalezaLocal(2026, 11, 26, 10));
const L = (h: number, sentido: "ganho" | "perda", categoria: string, volumeMl: number, anulado = false): Lancamento =>
  ({ dataHora: fortalezaLocal(2026, 11, h >= 7 ? 26 : 27, h), sentido, categoria, volumeMl, origem: "manual", anulado });

function doc(lanc: Lancamento[], extra: Partial<BalancoDocInput> = {}): { html: string; result: ReturnType<typeof computeFluidBalance> } {
  const result = computeFluidBalance(lanc, P, { pesoKg: 70, incluirInsensiveis: false });
  const html = buildBalancoHidricoBody({ result, lancamentos: lanc, periodoInicio: P.start, pesoTexto: "70 kg", incluirInsensiveis: false, status: "aberto", ...extra });
  return { html, result };
}

test("total do PDF = total da tela (mesma funcao de calculo)", () => {
  const { html, result } = doc([L(8, "ganho", "ev_continuo", 500), L(10, "perda", "diurese", 300), L(3, "perda", "dreno", 50)]);
  assert.strictEqual(result.balanco, 150);
  assert.ok(html.includes(formatMl(result.balanco, true)), "balanco 24h");
  assert.ok(html.includes(formatMl(result.ganhos)), "ganhos");
  assert.ok(html.includes(formatMl(result.perdas)), "perdas");
});

test("so as categorias usadas viram colunas; anulado nao entra", () => {
  const { html, result } = doc([L(8, "ganho", "oral", 200), L(9, "ganho", "hemoderivado", 300, true), L(10, "perda", "diurese", 100)]);
  assert.ok(html.includes("Via oral"));
  assert.ok(!html.includes("Hemoderivado"), "categoria so com lancamento anulado nao aparece");
  assert.ok(!html.includes("Vômito"));
  assert.strictEqual(result.ganhos, 200);
});

test("periodo sem lancamentos: mensagem, sem tabela vazia", () => {
  const { html } = doc([]);
  assert.ok(html.includes("Nenhum lançamento no período"));
  assert.ok(!html.includes("bh-grid"));
});

test("situacao: parcial, fechado e validado com o nome de quem validou", () => {
  assert.ok(doc([]).html.includes("PARCIAL"));
  assert.ok(doc([], { status: "fechado" }).html.includes("aguardando validação"));
  assert.ok(doc([], { status: "validado", validadoPor: "ENFERMEIRA TESTE" }).html.includes("Validado por ENFERMEIRA TESTE"));
});

test("texto do paciente e escapado (sem HTML injetado)", () => {
  const { html } = doc([], { pesoTexto: "<b>70</b> kg" });
  assert.ok(html.includes("&lt;b&gt;70&lt;/b&gt; kg"));
});

test("insensiveis sem peso: aparece 'peso não registrado'", () => {
  const result = computeFluidBalance([], P, { pesoKg: null, incluirInsensiveis: true });
  const html = buildBalancoHidricoBody({ result, lancamentos: [], periodoInicio: P.start, pesoTexto: "—", incluirInsensiveis: true, status: "aberto" });
  assert.ok(html.includes("peso não registrado"));
});
