/**
 * Ocupação de leito no modelo de faixa fixa.
 *
 * Reproduz a lógica de occupyBedInSector contra um banco simulado. O que se
 * protege aqui é a regra que os fluxos da urgência violavam: com a faixa
 * oficial semeada, admitir paciente é OCUPAR a linha vaga de menor número —
 * inserir linha nova deixaria os leitos oficiais vazios e todo paciente como
 * EXTRA, além de colidir com a unicidade (unit, sector, bed_number).
 */
import { test } from "node:test";
import assert from "node:assert";
import { getNextBedNumber } from "@/utils/bedNaming";

type Row = { id: string; bed_number: string; is_vacant: boolean };

const faixaDe = (sector: string): string[] => {
  const beds: string[] = [];
  for (;;) {
    const n = getNextBedNumber(sector, beds);
    if (n.startsWith("EXTRA")) break;
    beds.push(n);
    if (beds.length > 200) break;
  }
  return beds;
};

/** Mesma decisão de occupyBedInSector, sobre linhas em memória. */
function escolherLeito(sector: string, rows: Row[]) {
  const porNumero = new Map(rows.map((r) => [r.bed_number, r]));
  const faixa = faixaDe(sector);
  const vago = faixa.map((n) => porNumero.get(n)).find((r) => r && r.is_vacant);
  if (vago) return { bedNumber: vago.bed_number, acao: "update" as const, isExtra: false };
  return {
    bedNumber: getNextBedNumber(sector, rows.map((r) => r.bed_number)),
    acao: "insert" as const,
    isExtra: true,
  };
}

const semear = (sector: string): Row[] =>
  faixaDe(sector).map((b, i) => ({ id: `id-${i}`, bed_number: b, is_vacant: true }));

test("faixa recém-semeada: ocupa M01 por UPDATE, nunca cria leito", () => {
  const r = escolherLeito("internacao_ue", semear("internacao_ue"));
  assert.strictEqual(r.bedNumber, "M01");
  assert.strictEqual(r.acao, "update");
  assert.strictEqual(r.isExtra, false);
});

test("ocupa sempre o MENOR número livre, não o próximo da sequência", () => {
  const rows = semear("internacao_ue");
  rows[0].is_vacant = false; // M01 ocupado
  rows[1].is_vacant = false; // M02 ocupado
  rows[4].is_vacant = false; // M05 ocupado, M03 e M04 livres
  assert.strictEqual(escolherLeito("internacao_ue", rows).bedNumber, "M03");
});

test("alta em M02 devolve o leito ao pool (não gera EXTRA)", () => {
  const rows = semear("internacao_ue").map((r) => ({ ...r, is_vacant: false }));
  rows[1].is_vacant = true; // alta em M02
  const r = escolherLeito("internacao_ue", rows);
  assert.strictEqual(r.bedNumber, "M02");
  assert.strictEqual(r.acao, "update");
});

test("faixa lotada: abre EXTRA por INSERT — nunca recusa o paciente", () => {
  const rows = semear("internacao_ue").map((r) => ({ ...r, is_vacant: false }));
  const r = escolherLeito("internacao_ue", rows);
  assert.strictEqual(r.bedNumber, "EXTRA1");
  assert.strictEqual(r.acao, "insert");
  assert.strictEqual(r.isExtra, true);
});

test("maca legada M-01 não é confundida com a faixa oficial", () => {
  const rows: Row[] = [
    { id: "legado", bed_number: "M-01", is_vacant: false },
    ...semear("internacao_ue"),
  ];
  const r = escolherLeito("internacao_ue", rows);
  assert.strictEqual(r.bedNumber, "M01", "a maca legada não deve deslocar a faixa oficial");
});

test("a regra vale para todo setor de faixa fixa, não só o Posto", () => {
  for (const [sector, primeiro] of [
    ["sala_vermelha", "SV01"],
    ["cc_preparo", "CP01"],
    ["neuro_02", "L11"],
    ["enfermaria_vascular", "L01"],
  ] as const) {
    const r = escolherLeito(sector, semear(sector));
    assert.strictEqual(r.bedNumber, primeiro, `${sector} deveria ocupar ${primeiro}`);
    assert.strictEqual(r.acao, "update");
  }
});
