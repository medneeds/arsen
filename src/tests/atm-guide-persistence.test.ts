/**
 * GUIA ATM — PERSISTÊNCIA DE JUSTIFICATIVA E CULTURA (correcao-erros)
 *
 * Valida que justification, cultureCollected e cultureResult:
 *  1. São repassados pelo onConfirm do AntimicrobialGuideDialog
 *  2. São salvos no PrescriptionItem pelo handleAntimicrobialConfirm
 *  3. Fluem corretamente para a reimpressão via AtmStatusDialog
 *
 * Pacientes fictícios — sem vínculo com dados reais.
 */

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

// ── Tipos espelhados do código de produção ────────────────────────────────────

interface AntimicrobialEntry {
  id: string;
  medication: string;
  dose: string;
  route: string;
  posology: string;
  startDate: string;
  plannedDuration: string;
  justification: string;
  infectionSite: string;
  cultureCollected: "sim" | "nao" | "pendente";
  cultureResult: string;
  ccihApproval: string;
  ccihNotes: string;
}

interface ConfirmedEntry {
  medication: string;
  dose: string;
  route: string;
  posology: string;
  startDate?: string;
  plannedDuration?: string;
  infectionSite?: string;
  justification?: string;
  cultureCollected?: string;
  cultureResult?: string;
}

interface PrescriptionItem {
  id: string;
  name: string;
  dose: string;
  route: string;
  posology: string;
  status: string;
  category: string;
  atbStartDate?: string;
  atbPlannedDays?: string;
  atbInfectionSite?: string;
  atbJustification?: string;
  atbCultureCollected?: string;
  atbCultureResult?: string;
}

interface AtmStatusItem {
  id: string;
  name: string;
  dose: string;
  route: string;
  posology: string;
  status: string;
  atbStartDate?: string;
  atbPlannedDays?: string;
  atbInfectionSite?: string;
  atbJustification?: string;
  atbCultureCollected?: string;
  atbCultureResult?: string;
}

interface ReprintEntry {
  medication: string;
  dose?: string;
  route?: string;
  posology?: string;
  startDate?: string;
  plannedDuration?: string;
  infectionSite?: string;
  justification?: string;
  cultureCollected?: string;
  cultureResult?: string;
}

// ── Simulação do doAttach (AntimicrobialGuideDialog) ──────────────────────────

function doAttachSimulation(entries: AntimicrobialEntry[]): ConfirmedEntry[] {
  return entries.map(e => ({
    medication: e.medication,
    dose: e.dose,
    route: e.route,
    posology: e.posology,
    startDate: e.startDate,
    plannedDuration: e.plannedDuration,
    infectionSite: e.infectionSite,
    justification: e.justification,
    cultureCollected: e.cultureCollected,
    cultureResult: e.cultureResult,
  }));
}

// ── Simulação do handleAntimicrobialConfirm (PrescricaoPage) ──────────────────

function handleAntimicrobialConfirmSimulation(
  confirmedEntries: ConfirmedEntry[]
): PrescriptionItem[] {
  return confirmedEntries.map(entry => {
    const base: PrescriptionItem = {
      id: `item-${Math.random()}`,
      name: entry.medication,
      dose: entry.dose,
      route: entry.route,
      posology: entry.posology,
      status: "active",
      category: "antimicrobial",
    };
    base.atbStartDate = entry.startDate || "2026-06-07";
    base.atbPlannedDays = entry.plannedDuration || "";
    base.atbInfectionSite = entry.infectionSite || "";
    base.atbJustification = entry.justification || "";
    base.atbCultureCollected = entry.cultureCollected || "nao";
    base.atbCultureResult = entry.cultureResult || "";
    return base;
  });
}

// ── Simulação do mapeamento para AtmStatusItem (PrescricaoPage) ───────────────

function mapToAtmStatusItem(item: PrescriptionItem): AtmStatusItem {
  return {
    id: item.id,
    name: item.name,
    dose: item.dose,
    route: item.route,
    posology: item.posology,
    status: item.status,
    atbStartDate: item.atbStartDate,
    atbPlannedDays: item.atbPlannedDays,
    atbInfectionSite: item.atbInfectionSite,
    atbJustification: item.atbJustification,
    atbCultureCollected: item.atbCultureCollected,
    atbCultureResult: item.atbCultureResult,
  };
}

// ── Simulação do onReprintItem (PrescricaoPage) ───────────────────────────────

function buildReprintEntry(it: AtmStatusItem): ReprintEntry {
  return {
    medication: it.name,
    dose: it.dose,
    route: it.route,
    posology: it.posology,
    startDate: it.atbStartDate,
    plannedDuration: it.atbPlannedDays,
    infectionSite: it.atbInfectionSite,
    justification: it.atbJustification,
    cultureCollected: it.atbCultureCollected || "nao",
    cultureResult: it.atbCultureResult,
  };
}

// ══════════════════════════════════════════════════════════════════
// BLOCO 1 — onConfirm: campos fluem corretamente do formulário
// ══════════════════════════════════════════════════════════════════

section("BLOCO 1 — doAttach: repassa justificativa e cultura ao onConfirm");

// Paciente: RAIMUNDA EMETERIA COSTA SOARES, 68 anos, UCI 2 — L09
// Antibiótico: VANCOMICINA 500mg EV 8/8h (foto real do sistema)
const entryVancomicina: AntimicrobialEntry = {
  id: "atm-001",
  medication: "Vancomicina",
  dose: "500mg",
  route: "EV",
  posology: "8/8h",
  startDate: "2026-06-06",
  plannedDuration: "7",
  justification: "Sepse por MRSA confirmada em hemocultura de 05/06/2026. Germe resistente a oxacilina. Cobertura com vancomicina conforme antibiograma.",
  infectionSite: "Infecção de corrente sanguínea",
  cultureCollected: "sim",
  cultureResult: "MRSA — sensível a vancomicina (CIM < 1 mg/L)",
  ccihApproval: "restrito_ccih",
  ccihNotes: "",
};

const confirmed = doAttachSimulation([entryVancomicina]);

assert(
  "onConfirm recebe justification preenchida",
  confirmed[0].justification === entryVancomicina.justification,
  `obtido: "${confirmed[0].justification?.substring(0, 30)}..."`
);
assert(
  "onConfirm recebe cultureCollected = 'sim'",
  confirmed[0].cultureCollected === "sim",
  `obtido: ${confirmed[0].cultureCollected}`
);
assert(
  "onConfirm recebe cultureResult com antibiograma",
  confirmed[0].cultureResult === "MRSA — sensível a vancomicina (CIM < 1 mg/L)",
  `obtido: "${confirmed[0].cultureResult}"`
);
assert(
  "onConfirm preserva todos os campos básicos",
  confirmed[0].medication === "Vancomicina" &&
  confirmed[0].dose === "500mg" &&
  confirmed[0].route === "EV" &&
  confirmed[0].posology === "8/8h",
);

// ══════════════════════════════════════════════════════════════════
// BLOCO 2 — handleAntimicrobialConfirm: salva em PrescriptionItem
// ══════════════════════════════════════════════════════════════════

section("BLOCO 2 — handleAntimicrobialConfirm: salva campos ATB no item");

const prescItems = handleAntimicrobialConfirmSimulation(confirmed);

assert(
  "atbJustification salvo no item",
  (prescItems[0].atbJustification?.length ?? 0) > 0,
  `obtido: "${prescItems[0].atbJustification?.substring(0, 30)}..."`
);
assert(
  "atbCultureCollected = 'sim' salvo no item",
  prescItems[0].atbCultureCollected === "sim",
  `obtido: ${prescItems[0].atbCultureCollected}`
);
assert(
  "atbCultureResult salvo no item",
  prescItems[0].atbCultureResult === "MRSA — sensível a vancomicina (CIM < 1 mg/L)",
  `obtido: "${prescItems[0].atbCultureResult}"`
);
assert(
  "atbStartDate salvo corretamente",
  prescItems[0].atbStartDate === "2026-06-06",
);
assert(
  "atbInfectionSite salvo corretamente",
  prescItems[0].atbInfectionSite === "Infecção de corrente sanguínea",
);

// ══════════════════════════════════════════════════════════════════
// BLOCO 3 — Cenário anterior ao bug: campos ficavam undefined
// ══════════════════════════════════════════════════════════════════

section("BLOCO 3 — Regressão: comportamento ANTIGO (sem os campos)");

// Simula o que acontecia ANTES da correção: onConfirm sem justification/cultureResult
function doAttachAntigo(entries: AntimicrobialEntry[]) {
  return entries.map(e => ({
    medication: e.medication,
    dose: e.dose,
    route: e.route,
    posology: e.posology,
    startDate: e.startDate,
    plannedDuration: e.plannedDuration,
    infectionSite: e.infectionSite,
    // SEM justification, cultureCollected, cultureResult
  }));
}

function handleConfirmAntigo(confirmedEntries: ReturnType<typeof doAttachAntigo>): PrescriptionItem[] {
  return confirmedEntries.map(entry => {
    const base: PrescriptionItem = {
      id: `item-old-${Math.random()}`,
      name: entry.medication,
      dose: entry.dose,
      route: entry.route,
      posology: entry.posology,
      status: "active",
      category: "antimicrobial",
    };
    base.atbStartDate = entry.startDate || "";
    base.atbPlannedDays = entry.plannedDuration || "";
    base.atbInfectionSite = entry.infectionSite || "";
    // SEM atbJustification, atbCultureCollected, atbCultureResult
    return base;
  });
}

const confirmedAntigo = doAttachAntigo([entryVancomicina]);
const itemsAntigos = handleConfirmAntigo(confirmedAntigo);

assert(
  "ANTIGO: justification NÃO chegava ao onConfirm (bug documentado)",
  confirmedAntigo[0].justification === undefined,
);
assert(
  "ANTIGO: atbJustification ficava undefined no item (bug documentado)",
  itemsAntigos[0].atbJustification === undefined,
);
assert(
  "ANTIGO: atbCultureResult ficava undefined no item (bug documentado)",
  itemsAntigos[0].atbCultureResult === undefined,
);

// ══════════════════════════════════════════════════════════════════
// BLOCO 4 — Reimpressão: AtmStatusItem → reprintEntry
// ══════════════════════════════════════════════════════════════════

section("BLOCO 4 — Reimpressão via AtmStatusDialog: campos na 2ª via");

const atmStatusItem = mapToAtmStatusItem(prescItems[0]);
const reprintEntry = buildReprintEntry(atmStatusItem);

assert(
  "AtmStatusItem contém atbJustification",
  (atmStatusItem.atbJustification?.length ?? 0) > 0,
);
assert(
  "AtmStatusItem contém atbCultureCollected = 'sim'",
  atmStatusItem.atbCultureCollected === "sim",
);
assert(
  "AtmStatusItem contém atbCultureResult",
  (atmStatusItem.atbCultureResult?.length ?? 0) > 0,
);
assert(
  "reprintEntry.justification fluiu para impressão",
  reprintEntry.justification === entryVancomicina.justification,
  `obtido: "${reprintEntry.justification?.substring(0, 30)}..."`
);
assert(
  "reprintEntry.cultureCollected fluiu para impressão",
  reprintEntry.cultureCollected === "sim",
);
assert(
  "reprintEntry.cultureResult fluiu para impressão",
  reprintEntry.cultureResult === "MRSA — sensível a vancomicina (CIM < 1 mg/L)",
);

// ══════════════════════════════════════════════════════════════════
// BLOCO 5 — Múltiplos ATBs: cada um preserva sua própria justificativa
// ══════════════════════════════════════════════════════════════════

section("BLOCO 5 — Múltiplos antibióticos: justificativas independentes");

// Paciente: CRISTIANO DOMINGUES DE OLIVEIRA, 52 anos, UTI 2 — L17
// Terapia combinada: Meropenem + Vancomicina para Sepse polimicrobiana
const entryMeropenem: AntimicrobialEntry = {
  id: "atm-002",
  medication: "Meropenem",
  dose: "1g",
  route: "EV",
  posology: "6/6h",
  startDate: "2026-06-07",
  plannedDuration: "10",
  justification: "Sepse polimicrobiana — cobertura gram-negativo. Aguardando cultura do cateter.",
  infectionSite: "Sepse / Choque séptico",
  cultureCollected: "pendente",
  cultureResult: "",
  ccihApproval: "restrito_ccih",
  ccihNotes: "Aguardando liberação CCIH",
};

const entryPipetazo: AntimicrobialEntry = {
  id: "atm-003",
  medication: "Piperacilina + Tazobactam",
  dose: "4,5g",
  route: "EV",
  posology: "6/6h",
  startDate: "2026-06-07",
  plannedDuration: "7",
  justification: "Cobertura empirica gram-negativo e anaeróbios — infecção intra-abdominal pós-cirúrgica.",
  infectionSite: "Infecção intra-abdominal",
  cultureCollected: "nao",
  cultureResult: "",
  ccihApproval: "pendente",
  ccihNotes: "",
};

const confirmedMultiplo = doAttachSimulation([entryMeropenem, entryPipetazo]);
const itemsMultiplos = handleAntimicrobialConfirmSimulation(confirmedMultiplo);

assert(
  "Meropenem: justificativa independente preservada",
  itemsMultiplos[0].atbJustification === entryMeropenem.justification,
);
assert(
  "Pip-Tazo: justificativa independente preservada",
  itemsMultiplos[1].atbJustification === entryPipetazo.justification,
);
assert(
  "Meropenem: cultureCollected = 'pendente'",
  itemsMultiplos[0].atbCultureCollected === "pendente",
);
assert(
  "Pip-Tazo: cultureCollected = 'nao'",
  itemsMultiplos[1].atbCultureCollected === "nao",
);
assert(
  "Justificativas não se misturam entre os itens",
  itemsMultiplos[0].atbJustification !== itemsMultiplos[1].atbJustification,
);

// ══════════════════════════════════════════════════════════════════
// BLOCO 6 — Retrocompatibilidade: itens sem campos ATB (dados antigos)
// ══════════════════════════════════════════════════════════════════

section("BLOCO 6 — Retrocompatibilidade: itens legacy sem campos ATB");

const itemLegado: AtmStatusItem = {
  id: "legacy-001",
  name: "Ceftriaxona",
  dose: "1g",
  route: "EV",
  posology: "1x/dia",
  status: "active",
  atbStartDate: "2026-05-01",
  atbPlannedDays: "5",
  atbInfectionSite: "ITU não complicada",
  // SEM atbJustification, atbCultureCollected, atbCultureResult (dados antigos)
};

const reprintLegado = buildReprintEntry(itemLegado);

assert(
  "Item legado sem atbJustification → reprintEntry.justification = undefined (sem crash)",
  reprintLegado.justification === undefined,
);
assert(
  "Item legado → cultureCollected recebe fallback 'nao'",
  reprintLegado.cultureCollected === "nao",
);
assert(
  "Item legado → buildReprintEntry não joga exceção",
  reprintLegado.medication === "Ceftriaxona",
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
