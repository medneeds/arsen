import test from "node:test";
import assert from "node:assert/strict";
import { applyPendencyDone, mergeLiveIntoLocal, diffPendencyToggles, pendencyKeys } from "../lib/pendenciasSync.ts";

test("applyPendencyDone marca pelo texto, ignorando indice e caixa", () => {
  const l = ["Culturas", "[ ] Aguardar vaga", "[x] Parecer"];
  assert.deepEqual(applyPendencyDone(l, "aguardar  VAGA", true), ["Culturas", "[x] Aguardar vaga", "[x] Parecer"]);
  assert.deepEqual(applyPendencyDone(l, "Parecer", false), ["Culturas", "[ ] Aguardar vaga", "[ ] Parecer"]);
});
test("applyPendencyDone devolve null quando nao ha o que mudar", () => {
  const l = ["[x] A", "B"];
  assert.equal(applyPendencyDone(l, "A", true), null);   // ja marcada
  assert.equal(applyPendencyDone(l, "B", false), null);  // ja desmarcada (legado = aberta)
  assert.equal(applyPendencyDone(l, "inexistente", true), null);
  assert.equal(applyPendencyDone(l, "  ", true), null);
});
test("applyPendencyDone com duplicadas marca so a primeira no estado oposto", () => {
  assert.deepEqual(applyPendencyDone(["X", "X"], "X", true), ["[x] X", "X"]);
});
test("applyPendencyDone nao altera a lista original", () => {
  const l = ["A"]; applyPendencyDone(l, "A", true); assert.deepEqual(l, ["A"]);
});
test("mergeLiveIntoLocal adota estado marcado da fonte e acrescenta itens novos", () => {
  const local = ["[ ] A", "B digitada agora"];
  const live = ["[x] A", "[ ] C nova"];
  assert.deepEqual(mergeLiveIntoLocal(local, live), ["[x] A", "B digitada agora", "[ ] C nova"]);
});
test("mergeLiveIntoLocal nunca apaga item local e preserva a referencia sem mudanca", () => {
  const local = ["[x] A", "B"];
  assert.equal(mergeLiveIntoLocal(local, ["[x] A"]), local);
  assert.equal(mergeLiveIntoLocal(local, []), local);
  assert.equal(mergeLiveIntoLocal([], []).length, 0);
});
test("mergeLiveIntoLocal semeia lista local vazia com a fonte", () => {
  assert.deepEqual(mergeLiveIntoLocal([], ["[ ] A", "[x] B", ""]), ["[ ] A", "[x] B"]);
});
test("mergeLiveIntoLocal desmarca quando a fonte desmarcou", () => {
  assert.deepEqual(mergeLiveIntoLocal(["[x] A"], ["[ ] A"]), ["[ ] A"]);
});
test("diffPendencyToggles detecta so marcar/desmarcar", () => {
  assert.deepEqual(diffPendencyToggles(["A", "[x] B"], ["[x] A", "[x] B"]), [{ text: "A", done: true }]);
  assert.deepEqual(diffPendencyToggles(["[x] A"], ["[ ] A"]), [{ text: "A", done: false }]);
  assert.deepEqual(diffPendencyToggles(["A"], ["A editado"]), []);   // edicao de texto nao e toggle
  assert.deepEqual(diffPendencyToggles(["A", "B"], ["A"]), []);       // remocao nao e toggle
  assert.deepEqual(diffPendencyToggles(["A"], ["A"]), []);
});
test("mergeLiveIntoLocal nao re-acrescenta item ja visto que o usuario removeu do formulario", () => {
  const seen = pendencyKeys(["[ ] A", "[ ] B"]);
  // usuario removeu B do formulario (ainda nao salvou); fonte muda o estado de A
  assert.deepEqual(mergeLiveIntoLocal(["[ ] A"], ["[x] A", "[ ] B"], seen), ["[x] A"]);
  // item realmente novo na fonte (nunca visto) entra
  assert.deepEqual(mergeLiveIntoLocal(["[ ] A"], ["[ ] A", "[ ] C"], seen), ["[ ] A", "[ ] C"]);
});
