/**
 * Hierarquia de navegação de setores.
 *
 * Protege a decisão institucional de 19/08/2026: o menu de setores mostra
 * apenas setores DENTRO do escopo de internação. O que aparecia indevidamente
 * — RIV, Observação Clínica (fora do escopo) e UE Horizontal (agrupamento) —
 * não pode voltar por descuido.
 */
import { test } from "node:test";
import assert from "node:assert";

import {
  SECTOR_NAVIGATION,
  INPATIENT_SECTOR_GROUPS,
  NAVIGABLE_DEPARTMENTS,
} from "@/config/sectorNavigation";
import { DEPARTMENT_TO_SECTOR } from "@/contexts/DepartmentContext";
import { sectorsByLevel, OUT_OF_SCOPE_SECTOR_CODES } from "@/config/sectorCoverage";
import { SECTOR_BED_CONFIG } from "@/utils/bedNaming";
import { HOSPITAL_SECTOR_GROUPS, INPATIENT_SECTOR_GROUPS as INPATIENT_CATALOG } from "@/lib/hospitalSectors";

const setoresDeInternacao = () =>
  INPATIENT_SECTOR_GROUPS.flatMap((g) => g.sectors.map((s) => DEPARTMENT_TO_SECTOR[s.department as string]));

test("nenhum setor fora do escopo aparece entre os setores de internação", () => {
  const codigos = setoresDeInternacao();
  for (const fora of OUT_OF_SCOPE_SECTOR_CODES) {
    assert.ok(!codigos.includes(fora), `setor fora do escopo no menu de internação: ${fora}`);
  }
});

test("ue_horizontal não é ofertado como setor de internação (é agrupamento)", () => {
  assert.ok(!setoresDeInternacao().includes("ue_horizontal"));
});

test("todo setor coberto pela plataforma está alcançável pelo menu", () => {
  const codigos = setoresDeInternacao();
  for (const code of [...sectorsByLevel("clinical"), ...sectorsByLevel("tracking")]) {
    assert.ok(codigos.includes(code), `setor coberto ausente do menu: ${code}`);
  }
});

test("todo item do menu resolve para um setor conhecido do banco", () => {
  for (const dep of NAVIGABLE_DEPARTMENTS) {
    assert.ok(DEPARTMENT_TO_SECTOR[dep], `department sem setor correspondente: ${dep}`);
  }
});

test("o Posto usa o rótulo institucional, não o antigo", () => {
  const deps = NAVIGABLE_DEPARTMENTS;
  assert.ok(deps.includes("POSTO INTERNAÇÃO"));
  assert.ok(!deps.includes("INTERNAÇÃO UE"), "rótulo antigo não deve ser ofertado no menu");
});

test("todo setor de internação do menu tem faixa de leitos configurada", () => {
  for (const code of setoresDeInternacao()) {
    assert.ok(SECTOR_BED_CONFIG[code], `setor no menu sem SECTOR_BED_CONFIG: ${code}`);
  }
});

test("o menu nao oferece nada fora da internacao", () => {
  // A plataforma so recebe paciente internado (Direcao Clinica, 20/08/2026):
  // nenhum grupo do menu pode estar fora do escopo.
  assert.strictEqual(
    SECTOR_NAVIGATION.filter((g) => g.outOfInpatientScope).length,
    0,
    "surgiu grupo fora do escopo de internacao no menu",
  );
  assert.deepStrictEqual(SECTOR_NAVIGATION, INPATIENT_SECTOR_GROUPS);
});

test("UTI e UCI ficam no mesmo bloco de alta complexidade", () => {
  const bloco = SECTOR_NAVIGATION.find((g) => g.group === "Alta Complexidade");
  assert.ok(bloco, "bloco de alta complexidade ausente");
  const deps = bloco!.sectors.map((s) => s.department);
  assert.deepStrictEqual(deps, ["UTI 1", "UTI 2", "UCI 1", "UCI 2"]);
});

test("destino de transferencia interna nao oferece setor fora do escopo", () => {
  const destinos = INPATIENT_CATALOG.flatMap((g) => g.items.map((i) => i.key));
  for (const fora of [...OUT_OF_SCOPE_SECTOR_CODES, "ue_horizontal"]) {
    assert.ok(!destinos.includes(fora), `setor fora do escopo ofertado como destino: ${fora}`);
  }
  // e todo setor coberto continua alcançável como destino
  for (const code of [...sectorsByLevel("clinical"), ...sectorsByLevel("tracking")]) {
    assert.ok(destinos.includes(code), `setor coberto ausente dos destinos: ${code}`);
  }
});

test("o catalogo completo preserva os setores fora do escopo para lookup", () => {
  const todos = HOSPITAL_SECTOR_GROUPS.flatMap((g) => g.items.map((i) => i.key));
  // Transfusao em observacao clinica e legitima; requisicoes antigas citam riv.
  for (const code of ["observacao_clinica", "riv", "ue_vertical"]) {
    assert.ok(todos.includes(code), `codigo sumiu do catalogo e quebraria lookup: ${code}`);
  }
});
