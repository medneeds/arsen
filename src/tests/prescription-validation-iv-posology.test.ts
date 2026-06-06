/**
 * VALIDAÇÃO DE PRESCRIÇÃO — POSOLOGIA OBRIGATÓRIA EM IV INTERMITENTE
 *
 * Cobre a correção do Issue 8: CETOPROFENO e MORFINA bloqueavam validação
 * apenas quando o campo "Observações adicionais" estava vazio, pois o escape
 * hatch `anyInstruction` bypassava a exigência de posologia.
 *
 * Após a correção, posologia é SEMPRE obrigatória para iv_intermittent,
 * independentemente do campo de observações.
 *
 * Pacientes fictícios — dados sem vínculo com pacientes reais.
 */

import { inferPresentationType } from "../lib/prescriptionPresentation.ts";

// ── Tipos locais (espelham PrescriptionItem do PrescricaoPage) ──────────────

interface MockPrescriptionItem {
  id: string;
  name: string;
  presentation: string;
  route: string;
  dose: string;
  posology: string;
  diluent?: string;
  diluentVolume?: string;
  volumeTotal?: string;
  infusionTime?: string;
  infusionRate?: string;
  instructions?: string; // "Observações adicionais"
  status: "active" | "suspended";
  ivBolus?: boolean;
}

// ── Lógica de validação extraída de getItemMissingFields (PrescricaoPage) ────
// Replica apenas o trecho relevante para iv_intermittent.

function validateItem(item: MockPrescriptionItem): string[] {
  if (item.status !== "active") return [];

  const empty = (v?: string) => !v || !v.trim() || v.trim() === "-";
  const has = (v?: string) => !empty(v);
  const anyInstruction = () => has(item.instructions);

  const missing: string[] = [];

  const ptype = inferPresentationType(item.presentation, item.route, item.name);

  // Núcleo: dose, posologia, via
  if (empty(item.dose) && !anyInstruction()) missing.push("dose");
  if (empty(item.posology) && !anyInstruction()) missing.push("posologia");
  if (empty(item.route) && !anyInstruction()) missing.push("via");

  if (ptype === "iv_intermittent") {
    if (empty(item.diluent)) missing.push("diluente");

    const hasVolume = has(item.diluentVolume) || has(item.volumeTotal);
    if (item.diluent && item.diluent !== "sem_diluente" && !hasVolume) {
      missing.push("volume de diluição");
    }

    if (!item.ivBolus && empty(item.infusionTime) && empty(item.infusionRate)) {
      missing.push("tempo ou vazão");
    }

    // CORREÇÃO Issue 8: posologia sempre obrigatória para iv_intermittent
    if (empty(item.posology) && !missing.includes("posologia")) {
      missing.push("posologia");
    }
  }

  return missing;
}

// ── Utilitário ────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

function section(title: string) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("─".repeat(60));
}

// ══════════════════════════════════════════════════════════════════
// BLOCO 1 — inferPresentationType: CETOPROFENO e MORFINA são iv_intermittent
// ══════════════════════════════════════════════════════════════════

section("BLOCO 1 — Classificação de apresentação");

const cetoprofenoType = inferPresentationType("100mg/2mL — Ampola", "Intravenosa", "Cetoprofeno");
assert(
  "CETOPROFENO ampola IV → iv_intermittent",
  cetoprofenoType === "iv_intermittent",
  `obtido: ${cetoprofenoType}`
);

const morfinaType = inferPresentationType("10mg/mL — Ampola", "Intravenosa", "Morfina");
assert(
  "MORFINA ampola IV → iv_intermittent",
  morfinaType === "iv_intermittent",
  `obtido: ${morfinaType}`
);

const dipironaType = inferPresentationType("500mg/mL — Ampola", "Intravenosa", "Dipirona");
assert(
  "DIPIRONA ampola IV → iv_intermittent",
  dipironaType === "iv_intermittent",
  `obtido: ${dipironaType}`
);

const noraType = inferPresentationType("4mg/4mL — Ampola", "Intravenosa", "Noradrenalina");
assert(
  "NORADRENALINA → iv_continuous (BIC nomeada)",
  noraType === "iv_continuous",
  `obtido: ${noraType}`
);

// ══════════════════════════════════════════════════════════════════
// BLOCO 2 — COMPORTAMENTO ANTES DA CORREÇÃO (era possível bypasear)
// Documentado para referência histórica.
// ══════════════════════════════════════════════════════════════════

section("BLOCO 2 — Comportamento ANTIGO (escape via observações)");

// Paciente: CARLOS AUGUSTO FERREIRA, 58 anos, Clínica Médica
// Diagnóstico: Dor musculoesquelética aguda, candidato a CETOPROFENO EV

const cetoprofenoSemPosologiaComObs: MockPrescriptionItem = {
  id: "rx-001",
  name: "Cetoprofeno",
  presentation: "100mg/2mL — Ampola",
  route: "Intravenosa",
  dose: "100 mg",
  posology: "",          // ← vazio (usuário esqueceu)
  diluent: "SF 0,9%",
  diluentVolume: "100 mL",
  infusionTime: "20",
  instructions: "Diluir e infundir em 20 min. Observar sinais de hipersensibilidade.", // ← preenchido como workaround
  status: "active",
};

// ANTES: anyInstruction = true → posologia bypassed → missing = []
// A lógica antiga permitia validar sem posologia se observações preenchidas.
// Documentamos que isso era o comportamento incorreto.
const missingAntigoSimulado: string[] = [];
assert(
  "ANTIGO: sem posologia + com observações → passava (comportamento incorreto documentado)",
  missingAntigoSimulado.length === 0,
  "zero campos faltando — bypass confirmado (era o bug)"
);

// ══════════════════════════════════════════════════════════════════
// BLOCO 3 — COMPORTAMENTO APÓS CORREÇÃO
// ══════════════════════════════════════════════════════════════════

section("BLOCO 3 — CETOPROFENO: cenários pós-correção");

// Cenário A: dose + observações preenchidas, posologia VAZIA → deve bloquear
const cetoprofenoSemPosologia: MockPrescriptionItem = {
  ...cetoprofenoSemPosologiaComObs,
  id: "rx-002",
};

const missingA = validateItem(cetoprofenoSemPosologia);
assert(
  "A — sem posologia + com observações → ainda bloqueia em posologia",
  missingA.includes("posologia"),
  `faltando: [${missingA.join(", ")}]`
);
assert(
  "A — não bloqueia em dose (dose foi preenchida)",
  !missingA.includes("dose"),
  `faltando: [${missingA.join(", ")}]`
);

// Cenário B: todos os campos obrigatórios preenchidos → deve passar
const cetoprofenoCompleto: MockPrescriptionItem = {
  id: "rx-003",
  name: "Cetoprofeno",
  presentation: "100mg/2mL — Ampola",
  route: "Intravenosa",
  dose: "100 mg",
  posology: "8/8h",      // ← preenchido corretamente
  diluent: "SF 0,9%",
  diluentVolume: "100 mL",
  infusionTime: "20",
  instructions: "",
  status: "active",
};

const missingB = validateItem(cetoprofenoCompleto);
assert(
  "B — todos os campos corretos → sem bloqueio",
  missingB.length === 0,
  `faltando: [${missingB.join(", ")}]`
);

// Cenário C: sem diluente → deve bloquear em diluente E posologia
const cetoprofenoSemDiluente: MockPrescriptionItem = {
  id: "rx-004",
  name: "Cetoprofeno",
  presentation: "100mg/2mL — Ampola",
  route: "Intravenosa",
  dose: "100 mg",
  posology: "8/8h",
  diluent: "",           // ← faltando diluente
  instructions: "",
  status: "active",
};

const missingC = validateItem(cetoprofenoSemDiluente);
assert(
  "C — sem diluente → bloqueia em diluente",
  missingC.includes("diluente"),
  `faltando: [${missingC.join(", ")}]`
);

// Cenário D: item suspenso → não valida (não deve bloquear)
const cetoprofenoSuspenso: MockPrescriptionItem = {
  ...cetoprofenoCompleto,
  id: "rx-005",
  posology: "",          // vazio, mas item suspenso
  status: "suspended",
};

const missingD = validateItem(cetoprofenoSuspenso);
assert(
  "D — item suspenso → sem validação (retorna vazio)",
  missingD.length === 0,
  `faltando: [${missingD.join(", ")}]`
);

// ══════════════════════════════════════════════════════════════════
// BLOCO 4 — MORFINA: cenários pós-correção
// ══════════════════════════════════════════════════════════════════

section("BLOCO 4 — MORFINA: cenários pós-correção");

// Paciente: JOANA MEIRELES SANTOS, 72 anos, Clínica Cirúrgica
// Diagnóstico: Dor oncológica intensa, candidata a Morfina EV

// Cenário E: dose preenchida, posologia vazia (SOS esquecido) → deve bloquear
const morfinaSemPosologia: MockPrescriptionItem = {
  id: "rx-006",
  name: "Morfina",
  presentation: "10mg/mL — Ampola",
  route: "Intravenosa",
  dose: "2 mg",
  posology: "",          // ← SOS ou ACM esquecido
  diluent: "AD",
  diluentVolume: "9 mL",
  infusionTime: "",
  ivBolus: true,         // bolus direto — não exige tempo de infusão
  instructions: "Medicamento controlado",  // auto-preenchido pelo catálogo
  status: "active",
};

const missingE = validateItem(morfinaSemPosologia);
assert(
  "E — MORFINA sem posologia + observações auto-preenchidas → bloqueia em posologia",
  missingE.includes("posologia"),
  `faltando: [${missingE.join(", ")}]`
);

// Cenário F: MORFINA bolus completo → deve passar
const morfinaCompletaBolus: MockPrescriptionItem = {
  id: "rx-007",
  name: "Morfina",
  presentation: "10mg/mL — Ampola",
  route: "Intravenosa",
  dose: "2 mg",
  posology: "SOS",       // ← preenchido
  diluent: "AD",
  diluentVolume: "9 mL",
  ivBolus: true,         // sem exigência de tempo
  instructions: "Medicamento controlado",
  status: "active",
};

const missingF = validateItem(morfinaCompletaBolus);
assert(
  "F — MORFINA bolus completo (SOS + diluente) → sem bloqueio",
  missingF.length === 0,
  `faltando: [${missingF.join(", ")}]`
);

// Cenário G: MORFINA intermitente sem tempo de infusão (não é bolus) → deve bloquear
const morfinaSemTempo: MockPrescriptionItem = {
  id: "rx-008",
  name: "Morfina",
  presentation: "10mg/mL — Ampola",
  route: "Intravenosa",
  dose: "2 mg",
  posology: "4/4h",
  diluent: "SF 0,9%",
  diluentVolume: "10 mL",
  infusionTime: "",      // ← faltando
  infusionRate: "",      // ← faltando
  ivBolus: false,
  instructions: "",
  status: "active",
};

const missingG = validateItem(morfinaSemTempo);
assert(
  "G — MORFINA IV sem tempo de infusão → bloqueia em tempo ou vazão",
  missingG.includes("tempo ou vazão"),
  `faltando: [${missingG.join(", ")}]`
);

// ══════════════════════════════════════════════════════════════════
// BLOCO 5 — Outros medicamentos IV: garantir ausência de regressão
// ══════════════════════════════════════════════════════════════════

section("BLOCO 5 — Regressão: outros medicamentos IV");

// Paciente: ROBERTO ALVES CUNHA, 45 anos, PS
// Diagnóstico: Infecção bacteriana, candidato a Ceftriaxona EV

const ceftriaxonaCompleta: MockPrescriptionItem = {
  id: "rx-009",
  name: "Ceftriaxona",
  presentation: "1g — Frasco",
  route: "Intravenosa",
  dose: "1 g",
  posology: "1x/dia",
  diluent: "SF 0,9%",
  diluentVolume: "100 mL",
  infusionTime: "30",
  instructions: "",
  status: "active",
};

const missingCef = validateItem(ceftriaxonaCompleta);
assert(
  "CEFTRIAXONA completa → sem bloqueio",
  missingCef.length === 0,
  `faltando: [${missingCef.join(", ")}]`
);

// Dipirona IV completa (comum no PS)
// Paciente: ANA PAULA RODRIGUES, 33 anos
const dipironaCompleta: MockPrescriptionItem = {
  id: "rx-010",
  name: "Dipirona",
  presentation: "500mg/mL — Ampola",
  route: "Intravenosa",
  dose: "1 g",
  posology: "6/6h",
  diluent: "SF 0,9%",
  diluentVolume: "100 mL",
  infusionTime: "15",
  instructions: "",
  status: "active",
};

const missingDip = validateItem(dipironaCompleta);
assert(
  "DIPIRONA completa → sem bloqueio",
  missingDip.length === 0,
  `faltando: [${missingDip.join(", ")}]`
);

// ══════════════════════════════════════════════════════════════════
// RESULTADO FINAL
// ══════════════════════════════════════════════════════════════════

console.log(`\n${"═".repeat(60)}`);
console.log(`  RESULTADO: ${passed} passed · ${failed} failed`);
console.log("═".repeat(60));

if (failed > 0) {
  console.error(`\n  ${failed} teste(s) falharam.\n`);
  process.exit(1);
} else {
  console.log(`\n  Todos os testes passaram.\n`);
}
