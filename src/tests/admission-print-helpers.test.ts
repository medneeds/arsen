/**
 * Impresso da admissao: nome do paciente nunca vem so da URL e a previsao de alta
 * sai apenas com a data (sem o "(D+N)" automatico).
 */
import { test } from "node:test";
import assert from "node:assert";
import { pickPrintName } from "../lib/printPatientName.ts";
import { stripDischargeDays } from "../lib/dischargeLabel.ts";

test("nome ao vivo tem prioridade sobre o da URL", () => {
  assert.strictEqual(pickPrintName("MARIA DAS DORES", "outro", ""), "MARIA DAS DORES");
});

test("URL vazia (cadastro criado depois): usa o nome do cadastro", () => {
  assert.strictEqual(pickPrintName(null, "MARIA DAS DORES", ""), "MARIA DAS DORES");
  assert.strictEqual(pickPrintName(undefined, undefined, "MARIA DAS DORES"), "MARIA DAS DORES");
});

test("ignora vazios e so espacos, e apara o nome", () => {
  assert.strictEqual(pickPrintName("", "   ", "  MARIA  "), "MARIA");
});

test("sem nenhum candidato devolve string vazia (o chamador decide)", () => {
  assert.strictEqual(pickPrintName(null, undefined, ""), "");
});

test("previsao de alta: remove o (D+N) e mantem a data", () => {
  assert.strictEqual(stripDischargeDays("21/10/2026 (D+10)"), "21/10/2026");
  assert.strictEqual(stripDischargeDays("03/06/2026 (D+7)"), "03/06/2026");
  assert.strictEqual(stripDischargeDays("21/10/2026 (D+0)"), "21/10/2026");
});

test("tolera espacos e caixa na marca", () => {
  assert.strictEqual(stripDischargeDays("21/10/2026  ( d + 12 ) "), "21/10/2026");
});

test("sem a marca o texto nao muda", () => {
  assert.strictEqual(stripDischargeDays("21/10/2026"), "21/10/2026");
  assert.strictEqual(stripDischargeDays("Sem previsão"), "Sem previsão");
  assert.strictEqual(stripDischargeDays("—"), "—");
});

test("vazio e nulo viram string vazia", () => {
  assert.strictEqual(stripDischargeDays(""), "");
  assert.strictEqual(stripDischargeDays(null), "");
  assert.strictEqual(stripDischargeDays(undefined), "");
});

import { splitDischargePrediction } from "../lib/dischargeLabel.ts";
test("previsao de alta sai do plano e vira campo proprio", () => {
  const r = splitDischargePrediction("Manter ATB\nSuporte\n\nPrevisão de alta: 21/10/2026 (D+10)");
  assert.equal(r.plan, "Manter ATB\nSuporte");
  assert.equal(r.label, "21/10/2026 (D+10)");
  const semPrev = splitDischargePrediction("Manter ATB", "");
  assert.equal(semPrev.plan, "Manter ATB");
  assert.equal(semPrev.label, "");
  assert.equal(splitDischargePrediction("x", "Previsao de alta: 01/01/2027").label, "01/01/2027");
  assert.equal(splitDischargePrediction("Previsão de alta: Sem previsão").plan, "");
  assert.equal(splitDischargePrediction(null).plan, "");
});
