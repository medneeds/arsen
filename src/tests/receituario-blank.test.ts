/**
 * Receituario simples em branco: reconhecimento, validacao e corpo impresso.
 * Documento clinico: o texto do medico nao pode ser alterado nem quebrar o HTML.
 */
import { test } from "node:test";
import assert from "node:assert";
import {
  BLANK_RX_NOTICE,
  buildBlankReceituarioHtml,
  escapeRxHtml,
  isBlankReceituario,
  validateBlankReceituario,
} from "../lib/receituarioBlank.ts";

test("em branco = sem itens e com texto", () => {
  assert.strictEqual(isBlankReceituario([], "Dipirona 1 g VO se dor"), true);
  assert.strictEqual(isBlankReceituario(undefined, "texto"), true);
  assert.strictEqual(isBlankReceituario(null, "texto"), true);
});

test("com itens ou sem texto nao e em branco", () => {
  assert.strictEqual(isBlankReceituario([{ name: "Dipirona" }], "orientacao"), false);
  assert.strictEqual(isBlankReceituario([], ""), false);
  assert.strictEqual(isBlankReceituario([], "   \n  "), false);
  assert.strictEqual(isBlankReceituario([], undefined), false);
});

test("validacao: vazio e so espacos sao recusados, texto passa", () => {
  assert.ok(validateBlankReceituario(""));
  assert.ok(validateBlankReceituario("   \n\t "));
  assert.ok(validateBlankReceituario(null));
  assert.strictEqual(validateBlankReceituario("Repouso e hidratação"), null);
});

test("corpo preserva quebras de linha e acentos", () => {
  const html = buildBlankReceituarioHtml("1) Dipirona 1 g\n2) Hidratação oral");
  assert.ok(html.includes("white-space:pre-wrap"));
  assert.ok(html.includes("1) Dipirona 1 g\n2) Hidratação oral"));
});

test("caracteres especiais sao escapados (nao viram HTML)", () => {
  const html = buildBlankReceituarioHtml('Se PA < 90 & FC > 120: "chamar" <b>medico</b>');
  assert.ok(!html.includes("<b>"));
  assert.ok(html.includes("PA &lt; 90 &amp; FC &gt; 120"));
  assert.ok(html.includes("&quot;chamar&quot;"));
});

test("script digitado nao executa no papel", () => {
  const html = buildBlankReceituarioHtml("<script>alert(1)</script>");
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("CRLF vira LF e espacos finais sao removidos", () => {
  const html = buildBlankReceituarioHtml("linha 1\r\nlinha 2   \n\n");
  assert.ok(html.includes("linha 1\nlinha 2<"));
  assert.ok(!html.includes("\r"));
});

test("escapeRxHtml e o aviso fixo de controlados", () => {
  assert.strictEqual(escapeRxHtml("a&b<c>d\"e"), "a&amp;b&lt;c&gt;d&quot;e");
  assert.ok(BLANK_RX_NOTICE.includes("344/98"));
  assert.ok(BLANK_RX_NOTICE.includes("Controle Especial"));
});
