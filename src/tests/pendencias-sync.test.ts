import test from "node:test";
import assert from "node:assert/strict";
import { applyPendencyDone, mergeLiveIntoLocal, diffPendencyToggles, pendencyKeys } from "../lib/pendenciasSync.ts";
import {
  parsePendency, setPendencyDone, setPendencyText, isStaleDonePendency, pruneStaleDonePendencies, todayLocalISO,
} from "../lib/pendencyMarker.ts";

const HOJE = todayLocalISO();

test("applyPendencyDone marca pelo texto, ignorando indice e caixa", () => {
  const l = ["Culturas", "[ ] Aguardar vaga", "[x] Parecer"];
  assert.deepEqual(applyPendencyDone(l, "aguardar  VAGA", true), ["Culturas", `[x ${HOJE}] Aguardar vaga`, "[x] Parecer"]);
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
  assert.deepEqual(applyPendencyDone(["X", "X"], "X", true), [`[x ${HOJE}] X`, "X"]);
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

// ── Regra do dia seguinte (27/11/2026): concluida some no dia seguinte ──────────

test("marcar como concluida grava a data de hoje; desmarcar remove a data", () => {
  assert.equal(setPendencyDone("Hemocultura", true, "2026-11-27"), "[x 2026-11-27] Hemocultura");
  assert.equal(setPendencyDone("[x 2026-11-27] Hemocultura", false), "[ ] Hemocultura");
  assert.equal(setPendencyDone("Hemocultura", true), `[x ${HOJE}] Hemocultura`);
});
test("re-marcar nao renova a data da conclusao", () => {
  assert.equal(setPendencyDone("[x 2026-11-20] A", true, "2026-11-27"), "[x 2026-11-20] A");
});
test("parsePendency le o marcador com e sem data", () => {
  assert.deepEqual(parsePendency("[x 2026-11-27] TC de cranio"), { done: true, text: "TC de cranio", doneOn: "2026-11-27" });
  assert.deepEqual(parsePendency("[x] TC"), { done: true, text: "TC", doneOn: null });
  assert.deepEqual(parsePendency("[ ] TC"), { done: false, text: "TC", doneOn: null });
  assert.deepEqual(parsePendency("TC"), { done: false, text: "TC", doneOn: null });
  // texto que parece data mas esta fora do marcador nao e confundido
  assert.equal(parsePendency("2026-11-27 coletar gaso").done, false);
});
test("editar o texto preserva estado e data", () => {
  assert.equal(setPendencyText("[x 2026-11-27] TC", "TC de torax"), "[x 2026-11-27] TC de torax");
  assert.equal(setPendencyText("[x] TC", "TC de torax"), "[x] TC de torax");
  assert.equal(setPendencyText("[ ] TC", "TC de torax"), "[ ] TC de torax");
  assert.equal(setPendencyText("TC", ""), "");
});
test("concluida hoje continua; concluida ontem ou sem data some; aberta nunca some", () => {
  const hoje = "2026-11-27";
  assert.equal(isStaleDonePendency("[x 2026-11-27] A", hoje), false);
  assert.equal(isStaleDonePendency("[x 2026-11-26] A", hoje), true);
  assert.equal(isStaleDonePendency("[x] A", hoje), true);            // legado sem data
  assert.equal(isStaleDonePendency("[ ] A", hoje), false);
  assert.equal(isStaleDonePendency("A", hoje), false);
  assert.equal(isStaleDonePendency("[x 2025-12-31] A", "2026-01-01"), true); // virada de ano
  assert.deepEqual(
    pruneStaleDonePendencies(["[ ] aberta", "[x 2026-11-27] hoje", "[x 2026-11-20] velha", "[x] legado", "sem marcador"], hoje),
    ["[ ] aberta", "[x 2026-11-27] hoje", "sem marcador"],
  );
});
test("mergeLiveIntoLocal adota a data da fonte sem carimbar hoje", () => {
  assert.deepEqual(mergeLiveIntoLocal(["[ ] A"], ["[x 2026-11-20] A"]), ["[x 2026-11-20] A"]);
});
test("todayLocalISO usa o fuso local, nao UTC", () => {
  // 23h de 27/11 no horario local continua sendo 27/11
  assert.equal(todayLocalISO(new Date(2026, 10, 27, 23, 30)), "2026-11-27");
  assert.equal(todayLocalISO(new Date(2026, 0, 5, 0, 5)), "2026-01-05");
});
