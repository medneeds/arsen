/**
 * Setor na tela de Requisicoes: nome do banco ("UTI 2") vira codigo ("yellow"),
 * para a UTI ver as rotinas da UTI. Codigo e valor desconhecido nao mudam.
 */
import { test } from "node:test";
import assert from "node:assert";
import { toSectorCode } from "../lib/requisitionSector.ts";

test("codigo canonico passa sem alteracao", () => {
  for (const c of ["red", "yellow", "blue", "outside", "ucc"]) {
    assert.strictEqual(toSectorCode(c), c);
  }
});

test("nome do setor no banco vira o codigo (UTI/UCI/UCC)", () => {
  assert.strictEqual(toSectorCode("UTI 1"), "red");
  assert.strictEqual(toSectorCode("UTI 2"), "yellow");
  assert.strictEqual(toSectorCode("UCI 1"), "blue");
  assert.strictEqual(toSectorCode("UCI 2"), "outside");
  assert.strictEqual(toSectorCode("UCC"), "ucc");
  assert.strictEqual(toSectorCode("UCC — Unidade de Cuidados Clínicos"), "ucc");
});

test("tolera espacos e caixa", () => {
  assert.strictEqual(toSectorCode("  uti 2 "), "yellow");
  assert.strictEqual(toSectorCode("Yellow"), "yellow");
});

test("enfermarias resolvem para o codigo delas (nao viram UTI)", () => {
  assert.strictEqual(toSectorCode("Neuro 01"), "neuro_01");
  assert.strictEqual(toSectorCode("Enfermaria de Transição"), "enfermaria_transicao");
});

test("vazio e nulo viram string vazia", () => {
  assert.strictEqual(toSectorCode(""), "");
  assert.strictEqual(toSectorCode(null), "");
  assert.strictEqual(toSectorCode(undefined), "");
  assert.strictEqual(toSectorCode("   "), "");
});

test("valor desconhecido volta como veio (sem inventar setor)", () => {
  assert.strictEqual(toSectorCode("Setor Inexistente"), "Setor Inexistente");
});
