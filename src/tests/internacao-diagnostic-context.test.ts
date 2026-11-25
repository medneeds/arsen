/**
 * Contexto diagnostico da internacao: previsao de alta UTI/UCI x hospitalar,
 * paliativo e precaucao vivem em colunas distintas de `internacoes` e o
 * mapeamento nao pode trocar uma pela outra nem gravar lixo.
 */
import { test } from "node:test";
import assert from "node:assert";
import {
  DIAGNOSTIC_CONTEXT_COLUMN,
  fromInternacaoRow,
  toColumnValue,
  toHypothesesList,
} from "../lib/internacaoDiagnosticContext.ts";

test("UTI/UCI e hospitalar mapeiam para colunas diferentes", () => {
  assert.strictEqual(DIAGNOSTIC_CONTEXT_COLUMN.utiDischargePrediction, "previsao_alta");
  assert.strictEqual(DIAGNOSTIC_CONTEXT_COLUMN.hospitalDischargePrediction, "previsao_alta_hospitalar");
  assert.notStrictEqual(
    DIAGNOSTIC_CONTEXT_COLUMN.utiDischargePrediction,
    DIAGNOSTIC_CONTEXT_COLUMN.hospitalDischargePrediction,
  );
});

test("linha completa da internacao vira o view-model sem cruzar previsoes", () => {
  const ctx = fromInternacaoRow({
    previsao_alta: "2026-11-30",
    previsao_alta_hospitalar: "2026-12-10",
    paliativo: true,
    precaucao_isolamento: "Contato",
  });
  assert.deepStrictEqual(ctx, {
    utiDischargePrediction: "2026-11-30",
    hospitalDischargePrediction: "2026-12-10",
    isPalliative: true,
    isolationPrecautions: "Contato",
  });
});

test("so a previsao da UTI preenchida nao inventa alta hospitalar", () => {
  const ctx = fromInternacaoRow({ previsao_alta: "2026-11-30", previsao_alta_hospitalar: null });
  assert.strictEqual(ctx.utiDischargePrediction, "2026-11-30");
  assert.strictEqual(ctx.hospitalDischargePrediction, "");
});

test("linha ausente ou com nulls volta vazio e nao paliativo", () => {
  for (const row of [null, undefined, {}, { paliativo: null, precaucao_isolamento: null }]) {
    const ctx = fromInternacaoRow(row);
    assert.strictEqual(ctx.isPalliative, false);
    assert.strictEqual(ctx.isolationPrecautions, "");
    assert.strictEqual(ctx.utiDischargePrediction, "");
    assert.strictEqual(ctx.hospitalDischargePrediction, "");
  }
});

test("paliativo so e true com true estrito (nao aceita string)", () => {
  assert.strictEqual(fromInternacaoRow({ paliativo: "true" as unknown as boolean }).isPalliative, false);
  assert.strictEqual(toColumnValue("isPalliative", "true"), false);
  assert.strictEqual(toColumnValue("isPalliative", true), true);
  assert.strictEqual(toColumnValue("isPalliative", false), false);
});

test("texto vazio ou so espacos grava null (limpa a coluna), texto e aparado", () => {
  assert.strictEqual(toColumnValue("isolationPrecautions", ""), null);
  assert.strictEqual(toColumnValue("isolationPrecautions", "   "), null);
  assert.strictEqual(toColumnValue("isolationPrecautions", "  Contato  "), "Contato");
  assert.strictEqual(toColumnValue("utiDischargePrediction", ""), null);
  assert.strictEqual(toColumnValue("hospitalDischargePrediction", "2026-12-10"), "2026-12-10");
});

test("hipoteses: array, texto com quebras e lixo viram lista limpa", () => {
  assert.deepStrictEqual(toHypothesesList(["Sepse", " ", "PAC  "]), ["Sepse", "PAC"]);
  assert.deepStrictEqual(toHypothesesList("Sepse\n\n PAC \n"), ["Sepse", "PAC"]);
  assert.deepStrictEqual(toHypothesesList(null), []);
  assert.deepStrictEqual(toHypothesesList(undefined), []);
  assert.deepStrictEqual(toHypothesesList(42), []);
  assert.deepStrictEqual(toHypothesesList([null, undefined, ""]), []);
});
