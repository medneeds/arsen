/**
 * ESCAPE PARA O SETOR "clinico" — grade fantasma de leitos no mapa
 *
 * ─── O bug ──────────────────────────────────────────────────────────────────
 * O filtro do mapa de leitos (usePatients) casava o setor pedido contra
 * `setores.tipo`. Mas `setores.tipo` e uma CLASSIFICACAO ('clinico'/'cirurgico')
 * compartilhada por varios setores, nao a identidade de um setor. Quando um
 * valor de tipo caia em `selected_sector` (o "tipo poisoning"), o filtro casava
 * TODOS os leitos de TODOS os setores classificados como 'clinico' — dezenas de
 * leitos fantasma numa unica tela, com L01 repetido N vezes. Esse era o
 * "escape" para um setor 'clinico' que nao existe.
 *
 * ─── A regra correta ────────────────────────────────────────────────────────
 * Casamento por IDENTIDADE: nome real do setor no banco, ou codigo canonico
 * resolvido do nome. Nunca por classificacao. Um pedido que nao resolve para
 * setor real casa NADA — o mapa fica vazio, nao inventa leitos.
 */
import { test } from "node:test";
import assert from "node:assert";

import { bedBelongsToSector } from "../config/sectorCoverage.ts";

// Faixa de leitos representando setores classificados como 'clinico' no banco.
// Cada linha e o setor (nome + tipo) a que o leito pertence.
const SETORES_CLINICOS = [
  { nome: "NEURO 01", tipo: "clinico" },
  { nome: "NEURO 02", tipo: "clinico" },
  { nome: "CLÍNICA CIRÚRGICA", tipo: "clinico" },
  { nome: "ENFERMARIA VASCULAR", tipo: "clinico" },
  { nome: "UCC", tipo: "clinico" },
];

test("o escape para 'clinico' nao casa nenhum leito (grade vazia, nao fantasma)", () => {
  const casados = SETORES_CLINICOS.filter((s) => bedBelongsToSector(s, "clinico"));
  assert.strictEqual(casados.length, 0, "classificacao nunca deve casar leitos");
});

test("'cirurgico' tambem nao casa — e classificacao, nao setor", () => {
  const rows = [
    { nome: "CC PREPARO", tipo: "cirurgico" },
    { nome: "CC BLOCO CIRÚRGICO", tipo: "cirurgico" },
    { nome: "CC RPA", tipo: "cirurgico" },
  ];
  assert.strictEqual(rows.filter((s) => bedBelongsToSector(s, "cirurgico")).length, 0);
});

test("pedido por NOME real do banco casa so o setor daquele nome", () => {
  const casados = SETORES_CLINICOS.filter((s) => bedBelongsToSector(s, "NEURO 01"));
  assert.deepStrictEqual(casados.map((s) => s.nome), ["NEURO 01"]);
});

test("pedido por CODIGO canonico casa o setor certo, um so", () => {
  // 'clinica_cirurgica' e o codigo canonico de "CLÍNICA CIRÚRGICA".
  const casados = SETORES_CLINICOS.filter((s) => bedBelongsToSector(s, "clinica_cirurgica"));
  assert.deepStrictEqual(casados.map((s) => s.nome), ["CLÍNICA CIRÚRGICA"]);
});

test("codigo canonico casa pelo rotulo mesmo com tipo poluido", () => {
  // "UTI 1" resolve para 'red'; o tipo do banco aqui e a classificacao, nao o codigo.
  assert.ok(bedBelongsToSector({ nome: "UTI 1", tipo: "clinico" }, "red"));
  assert.ok(bedBelongsToSector({ nome: "UTI 1", tipo: "clinico" }, "UTI 1"));
});

test("base legada com tipo = codigo valido continua funcionando", () => {
  // Se `setores.tipo` guardar um SectorType valido (nao classificacao) e o nome
  // nao resolver, o pedido por esse codigo ainda casa via tipo.
  assert.ok(bedBelongsToSector({ nome: "Enf. Vascular (Anexo)", tipo: "enfermaria_vascular" }, "enfermaria_vascular"));
  // Mas o mesmo setor NAO e capturado por uma classificacao.
  assert.ok(!bedBelongsToSector({ nome: "Enf. Vascular (Anexo)", tipo: "enfermaria_vascular" }, "clinico"));
});

test("pedido vazio ou nulo nao casa nada", () => {
  assert.ok(!bedBelongsToSector({ nome: "UTI 1", tipo: "red" }, ""));
  assert.ok(!bedBelongsToSector({ nome: "UTI 1", tipo: "red" }, null));
  assert.ok(!bedBelongsToSector({ nome: "UTI 1", tipo: "red" }, undefined));
});

test("setor de nome desconhecido casa apenas por nome exato, nunca por tipo", () => {
  const row = { nome: "Ala Nova Experimental", tipo: "clinico" };
  assert.ok(bedBelongsToSector(row, "Ala Nova Experimental"));
  assert.ok(!bedBelongsToSector(row, "clinico"));
  assert.ok(!bedBelongsToSector(row, "outra coisa"));
});
