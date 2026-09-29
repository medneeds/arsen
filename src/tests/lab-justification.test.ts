/**
 * Justificativas da requisicao: Laboratorio nao exige a justificativa clinica
 * geral (nem sem selecao, nem com exame fora da rotina); so a liberacao
 * condicionada de exame fora da rotina. Parecer e Imagens continuam exigindo.
 */
import { test } from "node:test";
import assert from "node:assert";
import {
  exigeJustificativaPrincipal,
  itensForaDaRotina,
  justificativaForaDaRotinaValida,
} from "../lib/labJustification.ts";

const ROTINA = new Set(["Hemograma Completo", "Ureia", "Creatinina", "PCR"]);

test("laboratorio nao exige justificativa principal", () => {
  assert.strictEqual(exigeJustificativaPrincipal("laboratorio"), false);
});

test("parecer e imagens continuam exigindo justificativa principal", () => {
  assert.strictEqual(exigeJustificativaPrincipal("parecer"), true);
  assert.strictEqual(exigeJustificativaPrincipal("imagens"), true);
});

test("laboratorio sem nada selecionado: sem exame fora da rotina", () => {
  assert.deepStrictEqual(itensForaDaRotina("laboratorio", [], ROTINA), []);
});

test("laboratorio so com exames de rotina: nenhum fora da rotina", () => {
  assert.deepStrictEqual(itensForaDaRotina("laboratorio", ["Ureia", "PCR"], ROTINA), []);
});

test("laboratorio com rotina + extra: so o extra e apontado", () => {
  assert.deepStrictEqual(
    itensForaDaRotina("laboratorio", ["Ureia", "TSH", "T4 Livre"], ROTINA),
    ["TSH", "T4 Livre"],
  );
});

test("outras categorias nunca marcam item fora da rotina", () => {
  assert.deepStrictEqual(itensForaDaRotina("imagens", ["TC de Crânio"], ROTINA), []);
  assert.deepStrictEqual(itensForaDaRotina("parecer", ["Nefrologia"], ROTINA), []);
});

test("justificativa fora da rotina: minimo de 10 caracteres uteis", () => {
  assert.strictEqual(justificativaForaDaRotinaValida(""), false);
  assert.strictEqual(justificativaForaDaRotinaValida("         "), false);
  assert.strictEqual(justificativaForaDaRotinaValida("curto"), false);
  assert.strictEqual(justificativaForaDaRotinaValida("  123456789  "), false);
  assert.strictEqual(justificativaForaDaRotinaValida("1234567890"), true);
  assert.strictEqual(justificativaForaDaRotinaValida("suspeita de hipotireoidismo"), true);
});
