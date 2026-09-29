/**
 * Contador de ocupacao do mapa de leitos (numerador de "N/capacidade").
 *
 * O contador contava todas as linhas de leito do setor (ocupadas + vagas),
 * entao um setor de 10 leitos com 2 pacientes mostrava 10/10. A regra correta:
 * conta so leitos com internacao ativa (isVacant = false), extras incluidos.
 */
import { test } from "node:test";
import assert from "node:assert";
import { occupiedBedCount, sectorCapacity } from "../utils/bedNaming.ts";

type Row = { bedNumber: string; isVacant: boolean };

const leitos = (n: number, ocupados: number[], extras: Row[] = []): Row[] =>
  [
    ...Array.from({ length: n }, (_, i) => ({
      bedNumber: `L${String(i + 1).padStart(2, "0")}`,
      isVacant: !ocupados.includes(i + 1),
    })),
    ...extras,
  ];

test("10 leitos, 2 ocupados -> 2 (e nao 10)", () => {
  assert.strictEqual(occupiedBedCount(leitos(10, [1, 2])), 2);
});

test("setor vazio -> 0", () => {
  assert.strictEqual(occupiedBedCount(leitos(10, [])), 0);
});

test("setor lotado -> igual ao numero de leitos", () => {
  assert.strictEqual(occupiedBedCount(leitos(10, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])), 10);
});

test("extra OCUPADO conta: 10 regulares cheios + 1 extra -> 11", () => {
  const rows = leitos(10, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [{ bedNumber: "EXTRA1", isVacant: false }]);
  assert.strictEqual(occupiedBedCount(rows), 11);
});

test("extra VAGO nao conta", () => {
  const rows = leitos(10, [1], [{ bedNumber: "EXTRA1", isVacant: true }]);
  assert.strictEqual(occupiedBedCount(rows), 1);
});

test("lista vazia -> 0", () => {
  assert.strictEqual(occupiedBedCount([]), 0);
});

test("isVacant ausente e tratado como ocupado (nao esconde paciente)", () => {
  assert.strictEqual(occupiedBedCount([{}, { isVacant: true }]), 1);
});

test("denominador continua sendo a capacidade fixa do setor", () => {
  assert.strictEqual(sectorCapacity("yellow"), 10);
});
