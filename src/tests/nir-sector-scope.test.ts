/**
 * Classificação de setor no NIR.
 *
 * Dois defeitos reais motivaram estes testes, ambos do mesmo antipadrão —
 * decidir a natureza de um setor por substring do nome:
 *
 *  1. O alerta de saturação de UTI procurava um setor cujo código contivesse
 *     "uti". Os códigos das UTIs são "red" e "yellow": o alerta NUNCA disparou.
 *  2. Os recortes de "preso há 48h em UTI" acertavam quando o destino estava
 *     gravado como rótulo ("UTI 1") e erravam quando estava como código
 *     ("red") — e a base tem as duas formas.
 */
import { test } from "node:test";
import assert from "node:assert";

import { resolveSectorCode, isHighComplexity, getSectorCoverage } from "@/config/sectorCoverage";

test("resolve o código a partir do próprio código", () => {
  assert.strictEqual(resolveSectorCode("red"), "red");
  assert.strictEqual(resolveSectorCode("cc_bloco"), "cc_bloco");
});

test("resolve o código a partir do rótulo de exibição", () => {
  assert.strictEqual(resolveSectorCode("UTI 1"), "red");
  assert.strictEqual(resolveSectorCode("UCI 2"), "outside");
  assert.strictEqual(resolveSectorCode("Posto de Internação"), "internacao_ue");
});

test("resolve ignorando acento e caixa — a base grava das duas formas", () => {
  assert.strictEqual(resolveSectorCode("posto de internacao"), "internacao_ue");
  assert.strictEqual(resolveSectorCode("CLINICA CIRURGICA"), "clinica_cirurgica");
  assert.strictEqual(resolveSectorCode("Internação UE"), "internacao_ue");
});

test("código inexistente devolve undefined, nunca um palpite", () => {
  assert.strictEqual(resolveSectorCode("cc_bloco_cirurgico"), undefined);
  assert.strictEqual(resolveSectorCode(""), undefined);
  assert.strictEqual(resolveSectorCode(null), undefined);
});

test("alta complexidade reconhece código E rótulo", () => {
  for (const v of ["red", "yellow", "blue", "outside", "UTI 1", "UTI 2", "UCI 1", "UCI 2"]) {
    assert.ok(isHighComplexity(v), `deveria ser alta complexidade: ${v}`);
  }
});

test("a UCC não conta como alta complexidade", () => {
  // Unidade de Cuidados CLÍNICOS: enfermaria por definição institucional.
  // Contava como intensiva e inflava a taxa de ocupação com 37 leitos.
  assert.ok(!isHighComplexity("ucc"));
  assert.ok(!isHighComplexity("UCC"));
  assert.strictEqual(getSectorCoverage("ucc")?.group, "enfermaria");
});

test("o centro cirúrgico é recorte próprio, não enfermaria", () => {
  for (const code of ["cc_preparo", "cc_bloco", "cc_rpa"]) {
    assert.strictEqual(getSectorCoverage(code)?.group, "centro_cirurgico");
    assert.ok(!isHighComplexity(code));
  }
});
