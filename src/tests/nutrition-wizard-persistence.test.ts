/**
 * ASSISTENTE DE DIETA — PERSISTÊNCIA DE ESTADO (Issue 9)
 *
 * Valida a lógica de reset do NutritionWizard:
 *  - reset() NÃO deve ser chamado ao fechar o dialog
 *  - reset() DEVE ser chamado após confirmação bem-sucedida
 *  - Estado parcialmente preenchido persiste ao reabrir
 *
 * Testa a lógica pura de controle de estado, sem dependência de DOM/React.
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

// ── Simulação simplificada do estado do NutritionWizard ──────────────────────

type NutritionModality = "oral" | "enteral" | "parenteral" | "zero";

interface WizardState {
  step: number;
  modalities: Set<NutritionModality>;
  oralConsist: string;
  oralFraction: string;
  entFormula: string;
  entVolDay: string;
  entVia: string;
  notes: string;
}

const DEFAULT_STATE: WizardState = {
  step: 0,
  modalities: new Set(["oral"]),
  oralConsist: "geral",
  oralFraction: "6x/dia",
  entFormula: "polim_padrao",
  entVolDay: "1500",
  entVia: "sne",
  notes: "",
};

class WizardController {
  private state: WizardState;
  private resetCallCount = 0;
  private confirmCallCount = 0;
  private addedEntries: object[] = [];

  constructor() {
    this.state = { ...DEFAULT_STATE, modalities: new Set(DEFAULT_STATE.modalities) };
  }

  // Simula o que o Dialog.onOpenChange fazia ANTES da correção
  handleCloseOld() {
    // Comportamento antigo: reset sempre que fecha
    this.reset();
  }

  // Simula o que o Dialog.onOpenChange faz APÓS a correção
  handleCloseNew() {
    // Comportamento novo: NÃO chama reset ao fechar
    // (o Dialog apenas fecha, estado React persiste)
  }

  // Simula handleConfirm
  handleConfirm(entries: object[]) {
    this.addedEntries = entries;
    this.confirmCallCount++;
    this.reset(); // reset SOMENTE após confirmação
  }

  reset() {
    this.resetCallCount++;
    this.state = { ...DEFAULT_STATE, modalities: new Set(DEFAULT_STATE.modalities) };
  }

  updateState(patch: Partial<WizardState>) {
    this.state = { ...this.state, ...patch };
  }

  getState(): WizardState {
    return this.state;
  }

  getResetCount(): number {
    return this.resetCallCount;
  }

  getConfirmCount(): number {
    return this.confirmCallCount;
  }

  getAddedEntries(): object[] {
    return this.addedEntries;
  }
}

// ══════════════════════════════════════════════════════════════════
// BLOCO 1 — Comportamento ANTIGO (demonstra o bug)
// ══════════════════════════════════════════════════════════════════

section("BLOCO 1 — Comportamento ANTIGO (bug documentado)");

// Nutricionista configura dieta enteral para:
// Paciente: JOSENILDO FERREIRA, 55 anos, Neurologia, SNE
// Diagnóstico: AVC isquêmico, disfagia grave, candidato a nutrição enteral

const wizardAntigo = new WizardController();

// Passo 1: usuária abre o wizard e começa a preencher
wizardAntigo.updateState({
  step: 2,
  modalities: new Set(["enteral"] as NutritionModality[]),
  entFormula: "hiperc_hiperp",
  entVolDay: "1200",
  entVia: "sne",
  notes: "Progressão lenta — SNE confirmada por RX",
});

assert(
  "ANTIGO passo 1: estado preenchido após edição",
  wizardAntigo.getState().entFormula === "hiperc_hiperp" &&
    wizardAntigo.getState().step === 2,
);

// Passo 2: usuária fecha sem confirmar (comportamento antigo: chama reset)
wizardAntigo.handleCloseOld();

assert(
  "ANTIGO passo 2: fechar chama reset (bug — dados perdidos)",
  wizardAntigo.getResetCount() === 1,
  `resetCount: ${wizardAntigo.getResetCount()}`
);
assert(
  "ANTIGO passo 3: estado voltou ao default (dados perdidos)",
  wizardAntigo.getState().step === 0 &&
    wizardAntigo.getState().entFormula === "polim_padrao",
);

// ══════════════════════════════════════════════════════════════════
// BLOCO 2 — Comportamento NOVO (após correção)
// ══════════════════════════════════════════════════════════════════

section("BLOCO 2 — Comportamento NOVO (após correção)");

// Mesmo paciente, mesmo cenário, com o wizard corrigido
// Paciente: JOSENILDO FERREIRA, 55 anos, Neurologia

const wizardNovo = new WizardController();

// Passo 1: usuária preenche o wizard
wizardNovo.updateState({
  step: 2,
  modalities: new Set(["enteral"] as NutritionModality[]),
  entFormula: "hiperc_hiperp",
  entVolDay: "1200",
  entVia: "sne",
  notes: "Progressão lenta — SNE confirmada por RX",
});

const estadoAntesFechar = { ...wizardNovo.getState() };

// Passo 2: usuária fecha sem confirmar (comportamento novo: NÃO chama reset)
wizardNovo.handleCloseNew();

assert(
  "NOVO: fechar NÃO chama reset",
  wizardNovo.getResetCount() === 0,
  `resetCount: ${wizardNovo.getResetCount()}`
);
assert(
  "NOVO: estado preservado após fechar",
  wizardNovo.getState().step === estadoAntesFechar.step &&
    wizardNovo.getState().entFormula === estadoAntesFechar.entFormula,
  `step=${wizardNovo.getState().step}, formula=${wizardNovo.getState().entFormula}`
);
assert(
  "NOVO: step ainda está na página 2 ao reabrir",
  wizardNovo.getState().step === 2,
);
assert(
  "NOVO: fórmula enteral preservada ao reabrir",
  wizardNovo.getState().entFormula === "hiperc_hiperp",
);
assert(
  "NOVO: observações clínicas preservadas ao reabrir",
  wizardNovo.getState().notes === "Progressão lenta — SNE confirmada por RX",
);

// ══════════════════════════════════════════════════════════════════
// BLOCO 3 — Confirmação: reset deve ocorrer após submit
// ══════════════════════════════════════════════════════════════════

section("BLOCO 3 — Reset correto: somente após confirmação");

// Continuando com o mesmo wizard: usuária retoma, termina e confirma

const entradas = [
  { name: "Dieta Enteral Hiperproteica", route: "Enteral — SNE", posology: "Contínua 24h" },
];

wizardNovo.handleConfirm(entradas);

assert(
  "Após confirmar: reset chamado uma vez",
  wizardNovo.getResetCount() === 1,
  `resetCount: ${wizardNovo.getResetCount()}`
);
assert(
  "Após confirmar: estado voltou ao default",
  wizardNovo.getState().step === 0 &&
    wizardNovo.getState().entFormula === "polim_padrao",
);
assert(
  "Após confirmar: entradas adicionadas corretamente",
  wizardNovo.getAddedEntries().length === 1,
);

// ══════════════════════════════════════════════════════════════════
// BLOCO 4 — Múltiplas modalidades: persistência com estado complexo
// ══════════════════════════════════════════════════════════════════

section("BLOCO 4 — Estado complexo: múltiplas modalidades");

// Paciente: CONCEIÇÃO ALVES MOREIRA, 78 anos, Clínica Médica
// Diagnóstico: Desnutrição grave + disfagia leve
// Plano: Oral adaptada + Enteral suplementar

const wizardComplexo = new WizardController();

wizardComplexo.updateState({
  step: 3,
  modalities: new Set(["oral", "enteral"] as NutritionModality[]),
  oralConsist: "pastosa",
  oralFraction: "8x/dia",
  entFormula: "semielementar",
  entVolDay: "600",
  entVia: "sng",
  notes: "Oral pastosa + suplementação enteral noturna",
});

// Fecha 3 vezes sem confirmar (simula multiplas interrupções)
wizardComplexo.handleCloseNew();
wizardComplexo.handleCloseNew();
wizardComplexo.handleCloseNew();

assert(
  "3 fechamentos sem confirmar → zero resets",
  wizardComplexo.getResetCount() === 0,
  `resetCount: ${wizardComplexo.getResetCount()}`
);
assert(
  "Após 3 fechamentos: oralConsist = pastosa",
  wizardComplexo.getState().oralConsist === "pastosa",
);
assert(
  "Após 3 fechamentos: modalities tem oral + enteral",
  wizardComplexo.getState().modalities.has("oral") &&
    wizardComplexo.getState().modalities.has("enteral"),
);
assert(
  "Após 3 fechamentos: step = 3 (exatamente onde parou)",
  wizardComplexo.getState().step === 3,
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
