import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeDiagnosisText } from "../lib/diagnosesText.ts";

test("lista em formato de codigo vira uma hipotese por linha", () => {
  assert.equal(normalizeDiagnosisText('["AVCI","ME?"]'), "AVCI\nME?");
});

test("tolera espacos e itens vazios dentro da lista", () => {
  assert.equal(normalizeDiagnosisText('  [ "AVCI" , "", " ME? " ]  '), "AVCI\nME?");
});

test("texto ja em linhas volta igual", () => {
  assert.equal(normalizeDiagnosisText("AVCI\nME?"), "AVCI\nME?");
});

test("colchetes que nao sao lista JSON valida voltam iguais", () => {
  assert.equal(normalizeDiagnosisText("[AVCI, ME?]"), "[AVCI, ME?]");
});

test("lista vazia ou so com vazios volta como veio", () => {
  assert.equal(normalizeDiagnosisText("[]"), "[]");
  assert.equal(normalizeDiagnosisText('["",""]'), '["",""]');
});

test("vazio e nulo viram string vazia", () => {
  assert.equal(normalizeDiagnosisText(null), "");
  assert.equal(normalizeDiagnosisText(undefined), "");
  assert.equal(normalizeDiagnosisText(""), "");
});

test("objeto JSON nao e tratado como lista", () => {
  assert.equal(normalizeDiagnosisText('{"a":1}'), '{"a":1}');
});
