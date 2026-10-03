/**
 * Rotulo de idade do painel do paciente: nunca "42a anos", nunca caixa alta,
 * e valor desconhecido nao ganha unidade inventada.
 */
import { test } from "node:test";
import assert from "node:assert";
import { formatAgeLabel } from "../lib/ageLabel.ts";

test('"42a" (formato do cadastro) vira "42 anos"', () => {
  assert.strictEqual(formatAgeLabel("42a"), "42 anos");
});

test('"42a anos" (sufixo duplicado) vira "42 anos"', () => {
  assert.strictEqual(formatAgeLabel("42a anos"), "42 anos");
});

test("numero puro, string numerica e ja formatado convergem", () => {
  assert.strictEqual(formatAgeLabel(42), "42 anos");
  assert.strictEqual(formatAgeLabel("42"), "42 anos");
  assert.strictEqual(formatAgeLabel("42 anos"), "42 anos");
  assert.strictEqual(formatAgeLabel("42 ANOS"), "42 anos");
  assert.strictEqual(formatAgeLabel("  42a  "), "42 anos");
});

test("singular: 1 ano, 1 mes, 1 dia", () => {
  assert.strictEqual(formatAgeLabel("1a"), "1 ano");
  assert.strictEqual(formatAgeLabel(1), "1 ano");
  assert.strictEqual(formatAgeLabel("1 mes"), "1 mês");
  assert.strictEqual(formatAgeLabel("1d"), "1 dia");
});

test("meses, semanas e dias", () => {
  assert.strictEqual(formatAgeLabel("8m"), "8 meses");
  assert.strictEqual(formatAgeLabel("8 meses"), "8 meses");
  assert.strictEqual(formatAgeLabel("3 semanas"), "3 semanas");
  assert.strictEqual(formatAgeLabel("10 dias"), "10 dias");
  assert.strictEqual(formatAgeLabel("5 DV"), "5 dias");
});

test("sem dado: null (o chamador decide o que mostrar)", () => {
  assert.strictEqual(formatAgeLabel(null), null);
  assert.strictEqual(formatAgeLabel(undefined), null);
  assert.strictEqual(formatAgeLabel(""), null);
  assert.strictEqual(formatAgeLabel("   "), null);
  assert.strictEqual(formatAgeLabel(-3), null);
  assert.strictEqual(formatAgeLabel(Number.NaN), null);
});

test("formato desconhecido volta como veio, sem unidade inventada", () => {
  assert.strictEqual(formatAgeLabel("1a 3m"), "1a 3m");
  assert.strictEqual(formatAgeLabel("RN"), "RN");
});

test("menor de 1 ano calculado do nascimento aparece como 0 anos (limite conhecido da fonte)", () => {
  assert.strictEqual(formatAgeLabel("0a"), "0 anos");
});
