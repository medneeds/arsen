/**
 * Diagnosticos/antecedentes no painel do paciente: nunca exibir JSON, colchetes,
 * aspas ou chaves. Texto comum (uma linha por item) nao pode mudar.
 */
import { test } from "node:test";
import assert from "node:assert";
import { parseClinicalList } from "../lib/clinicalList.ts";

test("texto comum: uma linha, um item (comportamento antigo preservado)", () => {
  assert.deepStrictEqual(parseClinicalList("Sepse\nPneumonia\n\nIRA"), ["Sepse", "Pneumonia", "IRA"]);
});

test("vazio/nulo", () => {
  assert.deepStrictEqual(parseClinicalList(null), []);
  assert.deepStrictEqual(parseClinicalList(undefined), []);
  assert.deepStrictEqual(parseClinicalList(""), []);
  assert.deepStrictEqual(parseClinicalList("   \n  "), []);
});

test("array JSON em texto vira um item por linha", () => {
  assert.deepStrictEqual(
    parseClinicalList('["Diagnóstico 1","Diagnóstico 2","Diagnóstico 3"]'),
    ["Diagnóstico 1", "Diagnóstico 2", "Diagnóstico 3"],
  );
});

test("JSON formatado em varias linhas", () => {
  assert.deepStrictEqual(parseClinicalList('[\n  "Sepse",\n  "IRA"\n]'), ["Sepse", "IRA"]);
});

test("JSON com objetos pega o campo de texto", () => {
  assert.deepStrictEqual(
    parseClinicalList('[{"diagnostico":"Sepse"},{"nome":"IRA"},{"x":1}]'),
    ["Sepse", "IRA"],
  );
});

test("aspas escapadas e virgulas dentro do item sao preservadas", () => {
  assert.deepStrictEqual(
    parseClinicalList('["Pneumonia, grave","Lesão \\"aguda\\""]'),
    ["Pneumonia, grave", 'Lesão "aguda"'],
  );
});

test("literal de array do Postgres com chaves", () => {
  assert.deepStrictEqual(parseClinicalList('{"Sepse","Pneumonia, grave",IRA}'), ["Sepse", "Pneumonia, grave", "IRA"]);
  assert.deepStrictEqual(parseClinicalList("{Sepse,NULL,IRA}"), ["Sepse", "IRA"]);
});

test("JSON truncado e recuperado sem colchetes nem aspas", () => {
  assert.deepStrictEqual(parseClinicalList('["Sepse","IRA"'), ["Sepse", "IRA"]);
});

test("linhas entre aspas com virgula final", () => {
  assert.deepStrictEqual(parseClinicalList('"Sepse",\n"IRA"'), ["Sepse", "IRA"]);
});

test("array de strings: item serializado e expandido, item comum mantido", () => {
  assert.deepStrictEqual(parseClinicalList(['["Sepse","IRA"]', "Pneumonia"]), ["Sepse", "IRA", "Pneumonia"]);
  assert.deepStrictEqual(parseClinicalList(["A", "", "B"]), ["A", "B"]);
});

test("texto clinico que comeca com colchete mas nao e lista nao e destruido", () => {
  assert.deepStrictEqual(parseClinicalList("[RASCUNHO] Sepse de foco pulmonar"), ["[RASCUNHO] Sepse de foco pulmonar"]);
  assert.deepStrictEqual(parseClinicalList("{ver exames} IRA"), ["{ver exames} IRA"]);
});

test("numeracao e marcadores do texto original nao sao alterados", () => {
  assert.deepStrictEqual(parseClinicalList("1. Sepse\n2. IRA"), ["1. Sepse", "2. IRA"]);
});
