/**
 * Pedido de impressao da guia de requisicao (lista e popup "Requisicao enviada").
 *
 * O popup montava um objeto proprio, sem nome/leito/setor do paciente nem
 * solicitante, e a guia impressa por ele saia com esses campos vazios. Os dois
 * caminhos agora usam normalizeSolicitacao + applyAuthor; este teste garante que
 * o pedido carrega tudo o que a guia le.
 */
import { test } from "node:test";
import assert from "node:assert";
import { normalizeSolicitacao, applyAuthor } from "../lib/solicitacaoNormalize.ts";

const row = {
  id: "r1",
  internacao_id: "43de57c0-33de-4735-9897-7d6457ad567f",
  categoria: "laboratorio",
  itens: [{ name: "Gasometria Arterial" }, { name: "Hemograma Completo" }],
  prioridade: "rotina",
  status: "pendente",
  indicacao_clinica: "",
  observacoes: "",
  criado_em: "2026-10-04T00:15:00Z",
  solicitado_por: "prof-1",
};
const ctx = { patientName: "RAIMUNDO NONATO MARQUES", patientBed: "L10", patientSector: "red" };
const autor = { id: "prof-1", nome: "ARTUR AUGUSTO SANTOS BATISTA", crm: "11788" };

test("pedido da guia carrega paciente, leito, setor e itens", () => {
  const req = normalizeSolicitacao(row, ctx);
  assert.strictEqual(req.patient_name, "RAIMUNDO NONATO MARQUES");
  assert.strictEqual(req.patient_bed, "L10");
  assert.strictEqual(req.patient_sector, "red");
  assert.strictEqual(req.patient_id, row.internacao_id);
  assert.strictEqual(req.category, "laboratorio");
  assert.deepStrictEqual(req.items, row.itens);
  assert.strictEqual(req.created_at, row.criado_em);
});

test("autor resolvido entra como requested_by_name e requested_by_crm", () => {
  const req = applyAuthor(normalizeSolicitacao(row, ctx), autor);
  assert.strictEqual(req.requested_by_name, "ARTUR AUGUSTO SANTOS BATISTA");
  assert.strictEqual(req.requested_by_crm, "11788");
});

test("sem autor resolvido: devolve o pedido intacto (nao quebra a guia)", () => {
  const req = normalizeSolicitacao(row, ctx);
  assert.strictEqual(applyAuthor(req, null), req);
  assert.strictEqual(applyAuthor(req, undefined), req);
  assert.strictEqual(req.requested_by_name, "");
});

test("autor sem nome ou sem CRM nao vira 'null' nem 'undefined' no texto", () => {
  const req = applyAuthor(normalizeSolicitacao(row, ctx), { id: "p", nome: null, crm: null });
  assert.strictEqual(req.requested_by_name, "");
  assert.strictEqual(req.requested_by_crm, null);
});

test("contexto vazio gera strings vazias, nunca undefined", () => {
  const req = normalizeSolicitacao(row, {});
  assert.strictEqual(req.patient_name, "");
  assert.strictEqual(req.patient_bed, "");
  assert.strictEqual(req.patient_sector, "");
});

test("itens ausentes viram lista vazia (a guia nao quebra)", () => {
  assert.deepStrictEqual(normalizeSolicitacao({ ...row, itens: null }, ctx).items, []);
});

test("applyAuthor nao altera o pedido original (imutavel)", () => {
  const base = normalizeSolicitacao(row, ctx);
  applyAuthor(base, autor);
  assert.strictEqual(base.requested_by_name, "");
});
