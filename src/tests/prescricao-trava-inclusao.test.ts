import test from "node:test";
import assert from "node:assert/strict";
import { hasNewItemIds, isAdditionsGated, shouldExitAddingMode } from "../lib/prescriptionGate.ts";

const a = { id: "a" }, b = { id: "b" }, c = { id: "c" };

test("inclusao com id novo e detectada", () => {
  assert.equal(hasNewItemIds([a, b], [a, b, c]), true);
});
test("substituicao completa por ids novos conta como inclusao (loads usam setItemsRaw)", () => {
  assert.equal(hasNewItemIds([a], [c]), true);
});
test("map/remocao/reordenacao nao sao inclusao", () => {
  assert.equal(hasNewItemIds([a, b], [b, a]), false);
  assert.equal(hasNewItemIds([a, b], [a]), false);
  assert.equal(hasNewItemIds([a, b], [{ id: "a" }, { id: "b" }]), false);
  assert.equal(hasNewItemIds([a], []), false);
  assert.equal(hasNewItemIds([], []), false);
});
test("trava so fecha com tudo validado e fora do modo adicionar", () => {
  assert.equal(isAdditionsGated(true, false), true);
  assert.equal(isAdditionsGated(true, true), false);
  assert.equal(isAdditionsGated(false, false), false); // pendente/renovacao parcial: fluxo atual preservado
  assert.equal(isAdditionsGated(false, true), false);
});
test("modo adicionar nao encerra no clique inicial (nada pendente visto ainda)", () => {
  assert.equal(shouldExitAddingMode(true, true, false), false);
});
test("modo adicionar encerra ao validar tudo ou remover o pendente", () => {
  assert.equal(shouldExitAddingMode(true, true, true), true);
});
test("modo adicionar segue aberto enquanto ha pendente", () => {
  assert.equal(shouldExitAddingMode(true, false, true), false);
  assert.equal(shouldExitAddingMode(false, true, true), false);
});
