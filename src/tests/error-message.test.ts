import { test } from "node:test";
import assert from "node:assert";
import { errorMessage } from "../lib/errorMessage.ts";

test("erro do Supabase (objeto) mostra a mensagem em vez de [object Object]", () => {
  const e = { message: 'new row for relation "altas" violates check constraint "altas_tipo_check"', code: "23514" };
  assert.equal(errorMessage(e), 'new row for relation "altas" violates check constraint "altas_tipo_check"');
  assert.equal(errorMessage({ message: "x", details: "d", hint: "h" }), "x — d — h");
});
test("Error, string e valores estranhos", () => {
  assert.equal(errorMessage(new Error("falhou")), "falhou");
  assert.equal(errorMessage("texto"), "texto");
  assert.equal(errorMessage({ code: "1" }), '{"code":"1"}');
  assert.equal(errorMessage(null), "null");
});
