/** Corpo do PDF ENF-APZ. */
import { test } from "node:test";
import assert from "node:assert";
import { buildAprazamentoBody } from "../lib/aprazamentoDoc.ts";

test("grade de 24 colunas na ordem da vigencia, status e escape", () => {
  const html = buildAprazamentoBody({
    vigencia: "26/11 12h → 27/11 12h",
    aprazadoPor: "ENF <X>",
    linhas: [
      { nome: "Cefepime <2g>", resumo: "2g · EV · 8/8h", mav: false, doses: [
        { hora: 14, minuto: 0, status: "realizada", checadoAs: "14:10", por: "TEC A" },
        { hora: 22, minuto: 0, status: "nao_realizada", checadoAs: "22:05", por: "TEC B" },
        { hora: 6, minuto: 0, status: "pendente" },
      ] },
      { nome: "Heparina", resumo: "5000 UI · SC · 12/12h", mav: true, doses: [
        { hora: 18, minuto: 30, status: "realizada", checadoAs: "18:31", por: "TEC A", duplaPendente: true },
        { hora: 6, minuto: 0, status: "cancelada" },
      ] },
    ],
    ocorrencias: [{ quando: "26/11 22:05", item: "Cefepime", texto: "Não realizado: paciente em exame", por: "TEC B" }],
  });
  const ths = [...html.matchAll(/<thead>.*?<\/thead>/gs)][0][0].match(/<th[^>]*>(\d\d)<\/th>/g)!.map((t) => t.replace(/<[^>]+>/g, ""));
  assert.strictEqual(ths.length, 24);
  assert.strictEqual(ths[0], "12");
  assert.strictEqual(ths[12], "00");
  assert.strictEqual(ths[23], "11");
  assert.ok(html.includes("Cefepime &lt;2g&gt;"));
  assert.ok(html.includes("ENF &lt;X&gt;"));
  assert.ok(html.includes("✓ 14:10"));
  assert.ok(html.includes("✗ 22:05"));
  assert.ok(html.includes("<s>06h</s>"));
  assert.ok(html.includes("18:30"));
  assert.ok(html.includes("DC pend."));
  assert.ok(html.includes("apz-mav"));
  assert.ok(html.includes("paciente em exame"));
  // cada linha tem 1 th + 24 td
  const linha = html.match(/<tbody><tr>.*?<\/tr>/s)![0];
  assert.strictEqual((linha.match(/<td/g) ?? []).length, 24);
});

test("sem itens", () => {
  const html = buildAprazamentoBody({ vigencia: "x", linhas: [], ocorrencias: [] });
  assert.ok(html.includes("Nenhum item aprazado"));
  assert.ok(!html.includes("Ocorrências"));
});
