// Testa a fonte unica de habilitacao de SAPS por setor:
// sectorRequiresSaps + cache dinamico (setores.aplica_saps) + mapeamento
// nome<->codigo (resolveSectorCode). Rodar: npx tsx src/tests/saps-habilitacao-setor.test.ts
import { sectorRequiresSaps, setSapsSectorsFromDb } from "../lib/sectorComplexity.ts";
import { resolveSectorCode } from "../config/sectorCoverage.ts";

let pass = 0, fail = 0;
function check(label: string, got: boolean, want: boolean) {
  if (got === want) { pass++; }
  else { fail++; console.error(`FALHOU: ${label} -> got ${got}, want ${want}`); }
}

// Replica a construcao de identificadores do hook useSapsSectors (nome + codigo).
function buildIdentifiers(setores: Array<{ nome: string; aplica_saps: boolean }>): string[] {
  const ids: string[] = [];
  for (const s of setores) {
    if (!s.aplica_saps || !s.nome) continue;
    ids.push(s.nome);
    const code = resolveSectorCode(s.nome);
    if (code) ids.push(code);
  }
  return ids;
}

// ── 1. ANTES do cache (null): fallback estatico = comportamento historico ──
check("fallback red (UTI 1)", sectorRequiresSaps("red"), true);
check("fallback yellow (UTI 2)", sectorRequiresSaps("yellow"), true);
check("fallback outside (UCI 2)", sectorRequiresSaps("outside"), true);
check("fallback uti_01", sectorRequiresSaps("uti_01"), true);
check("fallback blue (UCI 1) nao-SAPS", sectorRequiresSaps("blue"), false);
check("fallback vazio", sectorRequiresSaps(""), false);
check("fallback null", sectorRequiresSaps(null), false);

// ── 2. Confirma o mapeamento nome->codigo que o cache usa ──
check("resolveSectorCode UTI 1 = red", resolveSectorCode("UTI 1") === "red", true);
check("resolveSectorCode UTI 2 = yellow", resolveSectorCode("UTI 2") === "yellow", true);
check("resolveSectorCode UCI 2 = outside", resolveSectorCode("UCI 2") === "outside", true);
check("resolveSectorCode UCI 1 = blue", resolveSectorCode("UCI 1") === "blue", true);

// ── 3. Cache padrao do banco (UTI 1/UTI 2/UCI 2 = true) ──
const padrao = [
  { nome: "UTI 1", aplica_saps: true },
  { nome: "UTI 2", aplica_saps: true },
  { nome: "UCI 2", aplica_saps: true },
  { nome: "UCI 1", aplica_saps: false },
  { nome: "Enfermaria de Transicao", aplica_saps: false },
  { nome: "Sala Vermelha", aplica_saps: false },
];
setSapsSectorsFromDb(buildIdentifiers(padrao));
// por codigo (usePatients)
check("cache: red", sectorRequiresSaps("red"), true);
check("cache: yellow", sectorRequiresSaps("yellow"), true);
check("cache: outside", sectorRequiresSaps("outside"), true);
check("cache: blue (UCI 1) nao", sectorRequiresSaps("blue"), false);
// por nome (usePatientLive)
check("cache: nome UTI 1", sectorRequiresSaps("UTI 1"), true);
check("cache: nome UCI 2", sectorRequiresSaps("UCI 2"), true);
check("cache: nome UCI 1 nao", sectorRequiresSaps("UCI 1"), false);
check("cache: nome Enfermaria nao", sectorRequiresSaps("Enfermaria de Transicao"), false);

// ── 4. Toggle: desabilita UCI 2 -> para de exigir SAPS (nome e codigo) ──
const semUci2 = padrao.map(s => s.nome === "UCI 2" ? { ...s, aplica_saps: false } : s);
setSapsSectorsFromDb(buildIdentifiers(semUci2));
check("toggle off: UCI 2 nome nao", sectorRequiresSaps("UCI 2"), false);
check("toggle off: outside (codigo UCI 2) nao", sectorRequiresSaps("outside"), false);
check("toggle off: UTI 1 segue sim", sectorRequiresSaps("UTI 1"), true);
check("toggle off: red segue sim", sectorRequiresSaps("red"), true);

// ── 5. Toggle: habilita uma enfermaria -> passa a exigir SAPS ──
const comEnf = padrao.map(s => s.nome === "Enfermaria de Transicao" ? { ...s, aplica_saps: true } : s);
setSapsSectorsFromDb(buildIdentifiers(comEnf));
check("toggle on enfermaria: nome sim", sectorRequiresSaps("Enfermaria de Transicao"), true);

console.log(`\n${pass} passaram, ${fail} falharam`);
if (fail > 0) process.exit(1);
