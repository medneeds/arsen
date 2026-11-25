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
  buildDiagnosticSnapshot,
  readDiagnosticSnapshot,
  resolveDiagnosticContextForDisplay,
  diagnosticContextLines,
  formatPredictionDate,
  DIAGNOSTIC_SNAPSHOT_KEY,
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

// ─── Snapshot da assinatura (evolucao validada e impresso) ─────────────────

const LIVE_HOJE = {
  utiDischargePrediction: "2026-12-20",
  hospitalDischargePrediction: "2026-12-30",
  isPalliative: false,
  isolationPrecautions: "",
};

test("snapshot guarda os 4 campos vigentes e a hora da assinatura", () => {
  const snap = buildDiagnosticSnapshot(
    { previsao_alta: "2026-11-30", previsao_alta_hospitalar: "2026-12-10", paliativo: true, precaucao_isolamento: "Contato" },
    "2026-11-25T10:00:00.000Z",
  );
  assert.deepStrictEqual(snap, {
    utiDischargePrediction: "2026-11-30",
    hospitalDischargePrediction: "2026-12-10",
    isPalliative: true,
    isolationPrecautions: "Contato",
    captured_at: "2026-11-25T10:00:00.000Z",
  });
});

test("validada mostra o snapshot da assinatura, nunca o valor de hoje", () => {
  const soap = { [DIAGNOSTIC_SNAPSHOT_KEY]: buildDiagnosticSnapshot({ precaucao_isolamento: "Contato", paliativo: true }) };
  const ctx = resolveDiagnosticContextForDisplay(true, soap, LIVE_HOJE);
  assert.strictEqual(ctx?.isolationPrecautions, "Contato");
  assert.strictEqual(ctx?.isPalliative, true);
  assert.strictEqual(ctx?.utiDischargePrediction, "", "nao pode herdar a previsao de hoje");
});

test("validada antiga (sem snapshot) nao inventa dado: retorna null", () => {
  assert.strictEqual(resolveDiagnosticContextForDisplay(true, { __cid_primary: "J18" }, LIVE_HOJE), null);
  assert.deepStrictEqual(diagnosticContextLines(null), []);
});

test("rascunho mostra o valor vivo da internacao (mesma fonte do mapa)", () => {
  const soap = { [DIAGNOSTIC_SNAPSHOT_KEY]: buildDiagnosticSnapshot({ precaucao_isolamento: "Contato" }) };
  assert.deepStrictEqual(resolveDiagnosticContextForDisplay(false, soap, LIVE_HOJE), LIVE_HOJE);
  // sem valor vivo disponivel, cai no snapshot
  assert.strictEqual(resolveDiagnosticContextForDisplay(false, soap, null)?.isolationPrecautions, "Contato");
});

test("snapshot corrompido ou de outro tipo e ignorado com seguranca", () => {
  assert.strictEqual(readDiagnosticSnapshot(null), null);
  assert.strictEqual(readDiagnosticSnapshot({ [DIAGNOSTIC_SNAPSHOT_KEY]: "texto" }), null);
  const r = readDiagnosticSnapshot({ [DIAGNOSTIC_SNAPSHOT_KEY]: { isPalliative: "true", isolationPrecautions: 3 } });
  assert.strictEqual(r?.isPalliative, false);
  assert.strictEqual(r?.isolationPrecautions, "");
});

test("linhas: ordem UTI, hospitalar, precaucao, paliativo; datas em dd/MM/yyyy", () => {
  const lines = diagnosticContextLines({
    utiDischargePrediction: "2026-11-30",
    hospitalDischargePrediction: "2026-12-10",
    isPalliative: true,
    isolationPrecautions: "Contato + Gotículas",
  });
  assert.deepStrictEqual(lines, [
    { label: "Previsão de alta UTI/UCI", value: "30/11/2026" },
    { label: "Previsão de alta hospitalar", value: "10/12/2026" },
    { label: "Precaução / Isolamento", value: "Contato + Gotículas" },
    { label: "Cuidados paliativos", value: "Sim" },
  ]);
});

test("paliativo aparece sempre (Nao tambem e informacao); campos vazios somem", () => {
  const lines = diagnosticContextLines({ utiDischargePrediction: "", hospitalDischargePrediction: " ", isPalliative: false, isolationPrecautions: "" });
  assert.deepStrictEqual(lines, [{ label: "Cuidados paliativos", value: "Não" }]);
});

test("data legada em texto livre passa como esta", () => {
  assert.strictEqual(formatPredictionDate("30/11/2026 (D+5)"), "30/11/2026 (D+5)");
  assert.strictEqual(formatPredictionDate("2026-11-30T00:00:00Z"), "30/11/2026");
  assert.strictEqual(formatPredictionDate(""), "");
});
