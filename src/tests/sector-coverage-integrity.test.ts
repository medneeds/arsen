/**
 * Integridade da estrutura de setores e leitos virtuais.
 *
 * Importa o CÓDIGO REAL (o tsx resolve o alias @/ via tsconfig) — nada de
 * cópias espelhadas: se a configuração de produção mudar, estes testes veem.
 *
 * Protege as decisões institucionais de 19/08/2026
 * (docs/disposicao-setores-leitos-arsen.pdf):
 *   • 296 leitos virtuais em 16 setores, faixas exatas por setor;
 *   • sobreposição L37–L40 entre Clínica Cirúrgica e Enf. Transição é
 *     INTENCIONAL e confirmada — o teste falha se alguém "corrigir";
 *   • três níveis de cobertura (clinical / tracking / out);
 *   • fora-do-escopo e agrupamentos não são ofertados como novos destinos.
 */
import { test } from "node:test";
import assert from "node:assert";

import {
  SECTOR_COVERAGE,
  sectorsByLevel,
  OUT_OF_SCOPE_SECTOR_CODES,
  KNOWN_UNCLASSIFIED,
  assertSectorCoverageIntegrity,
} from "@/config/sectorCoverage";
import { SECTOR_BED_CONFIG, getNextBedNumber } from "@/utils/bedNaming";
import { DESTINATION_SECTORS } from "@/lib/destinationSectors";
import { SECTOR_TYPES, isSectorType } from "@/types/patient";

// Estrutura aprovada: setor -> [capacidade, primeiro leito, último leito]
const APROVADO: Record<string, [number, string, string]> = {
  red: [8, "L01", "L08"],
  yellow: [10, "L09", "L18"],
  blue: [6, "L01", "L06"],
  outside: [8, "L07", "L14"],
  ucc: [37, "L01", "L37"],
  neuro_01: [10, "L01", "L10"],
  neuro_02: [10, "L11", "L20"],
  clinica_cirurgica: [40, "L01", "L40"],
  enfermaria_transicao: [10, "L37", "L46"],
  enfermaria_vascular: [95, "L01", "L95"],
  sala_vermelha: [6, "SV01", "SV06"],
  sala_laranja: [12, "OL01", "OL12"],
  internacao_ue: [14, "M01", "M14"],
  cc_preparo: [14, "CP01", "CP14"],
  cc_bloco: [6, "CB01", "CB06"],
  cc_rpa: [10, "CR01", "CR10"],
};

const faixa = (sector: string): string[] => {
  const beds: string[] = [];
  for (;;) {
    const next = getNextBedNumber(sector, beds);
    if (next.startsWith("EXTRA")) break;
    beds.push(next);
    if (beds.length > 200) throw new Error(`faixa de ${sector} não termina`);
  }
  return beds;
};

test("autochecagem interna da cobertura passa", () => {
  assert.doesNotThrow(() => assertSectorCoverageIntegrity());
});

test("todo setor coberto (clinical+tracking) tem configuração de leitos", () => {
  for (const code of [...sectorsByLevel("clinical"), ...sectorsByLevel("tracking")]) {
    assert.ok(SECTOR_BED_CONFIG[code], `setor coberto sem SECTOR_BED_CONFIG: ${code}`);
  }
});

test("capacidades e faixas batem com o documento aprovado (296 leitos)", () => {
  let total = 0;
  for (const [sector, [cap, primeiro, ultimo]] of Object.entries(APROVADO)) {
    const beds = faixa(sector);
    assert.strictEqual(beds.length, cap, `${sector}: capacidade ${beds.length} ≠ ${cap}`);
    assert.strictEqual(beds[0], primeiro, `${sector}: primeiro ${beds[0]} ≠ ${primeiro}`);
    assert.strictEqual(beds[beds.length - 1], ultimo, `${sector}: último ≠ ${ultimo}`);
    total += cap;
  }
  assert.strictEqual(total, 296, `total de leitos ${total} ≠ 296 aprovados`);
});

test("sobreposição L37–L40 (Clínica Cirúrgica ∩ Enf. Transição) é preservada", () => {
  const cc = new Set(faixa("clinica_cirurgica"));
  const et = faixa("enfermaria_transicao");
  const compartilhados = et.filter((b) => cc.has(b));
  assert.deepStrictEqual(
    compartilhados,
    ["L37", "L38", "L39", "L40"],
    "a sobreposição intencional confirmada pela Direção Clínica foi alterada",
  );
});

test("gerador: faixa cheia vira EXTRA; maca legada M-01 não interfere", () => {
  const cheia = faixa("internacao_ue");
  assert.strictEqual(getNextBedNumber("internacao_ue", cheia), "EXTRA1");
  // legado "M-01" (hífen) não conta como M01 nem quebra a sequência
  assert.strictEqual(getNextBedNumber("internacao_ue", ["M-01"]), "M01");
});

test("todo setor coberto é ofertável como destino; fora-do-escopo não é", () => {
  const porValue = new Map(DESTINATION_SECTORS.map((s) => [s.value, s]));
  for (const code of [...sectorsByLevel("clinical"), ...sectorsByLevel("tracking")]) {
    const opt = porValue.get(code);
    assert.ok(opt, `setor coberto ausente de DESTINATION_SECTORS: ${code}`);
    assert.ok(!opt!.legacyOnly, `setor coberto marcado legacyOnly: ${code}`);
  }
  for (const code of OUT_OF_SCOPE_SECTOR_CODES) {
    const opt = porValue.get(code);
    if (opt) assert.ok(opt.legacyOnly, `setor fora do escopo ofertável como novo destino: ${code}`);
  }
  // agrupamento não é destino-folha
  assert.ok(porValue.get("ue_horizontal")?.legacyOnly, "ue_horizontal (agrupamento) deve ser legacyOnly");
});

test("níveis cobrem exatamente os 19 setores + agrupamento conhecido", () => {
  const cobertos = Object.keys(SECTOR_COVERAGE).sort();
  assert.strictEqual(cobertos.length, 19);
  assert.deepStrictEqual(KNOWN_UNCLASSIFIED, ["ue_horizontal"]);
});

test("SECTOR_TYPES é exatamente cobertura + agrupamento conhecido", () => {
  const declarados = [...SECTOR_COVERAGE.map((s) => s.code), ...KNOWN_UNCLASSIFIED].sort();
  assert.deepStrictEqual(
    [...SECTOR_TYPES].sort(),
    declarados,
    "a união SectorType divergiu de SECTOR_COVERAGE — atualizar os dois juntos",
  );
});

test("isSectorType rejeita código inexistente e o erro histórico", () => {
  assert.ok(isSectorType("cc_bloco"));
  assert.ok(!isSectorType("cc_bloco_cirurgico"), "código inventado a partir do rótulo deve ser rejeitado");
  assert.ok(!isSectorType(""));
  assert.ok(!isSectorType(null));
});
