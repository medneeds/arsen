/**
 * ESPECIALIDADES MÉDICAS ENVOLVIDAS — Issues 1 e 2
 *
 * Valida:
 *  - Estrutura do campo `specialties` em MedicalResponsibility
 *  - Serialização e retrocompatibilidade com registros sem especialidades
 *  - Regras de apresentação no indicador do card de leito
 *  - Cenários de múltiplas especialidades por paciente
 *
 * Pacientes fictícios — dados sem vínculo com registros reais.
 */

import type { MedicalResponsibility, MedicalResponsibilityType } from "../types/patient.ts";

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

// ── Simulação do handleSave do MedicalResponsibilityDialog ────────────────────

function buildResponsibility(
  type: MedicalResponsibilityType,
  doctorName: string,
  specialties: string[]
): MedicalResponsibility {
  return {
    type,
    responsibleDoctorName: doctorName || undefined,
    specialties: specialties.length > 0 ? specialties : undefined,
  };
}

// ── Simulação do botão no EditPatientDialog ───────────────────────────────────

function getButtonText(r?: MedicalResponsibility): string {
  const hasType = !!r?.type;
  const hasSpecialties = (r?.specialties?.length ?? 0) > 0;

  if (!hasType && !hasSpecialties) return "Definir especialidades envolvidas";

  return [
    r?.type?.toUpperCase(),
    hasSpecialties ? `${r!.specialties!.length} especialidade(s)` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

// ── Simulação do indicador do card (MedicalResponsibilityIndicator) ───────────

function shouldRenderIndicator(r?: MedicalResponsibility): boolean {
  const hasSpecialties = (r?.specialties?.length ?? 0) > 0;
  return !!(r?.type) || hasSpecialties;
}

function getIndicatorAbbreviation(r?: MedicalResponsibility): string {
  const hasSpecialties = (r?.specialties?.length ?? 0) > 0;
  switch (r?.type) {
    case "rotineiro":      return "ROTIN.";
    case "plantonista":    return "PLANT.";
    case "intercorrencista": return "INTERC.";
    default: return hasSpecialties ? "ESPEC." : "";
  }
}

// ── Retrocompatibilidade: parsear JSONB do banco ──────────────────────────────

function parseFromDb(raw: Record<string, unknown>): MedicalResponsibility {
  return raw as MedicalResponsibility;
}

// ══════════════════════════════════════════════════════════════════
// BLOCO 1 — Estrutura e tipo
// ══════════════════════════════════════════════════════════════════

section("BLOCO 1 — Estrutura do campo specialties");

// Responsabilidade sem especialidades (registro legado)
const semEspecialidades = buildResponsibility("rotineiro", "Dra. Márcia Oliveira", []);
assert(
  "Sem especialidades → campo undefined (não persiste array vazio)",
  semEspecialidades.specialties === undefined,
  `obtido: ${JSON.stringify(semEspecialidades.specialties)}`
);

// Responsabilidade com uma especialidade
const umaEspecialidade = buildResponsibility("plantonista", "Dr. Fábio Teixeira", ["Cardiologia"]);
assert(
  "Uma especialidade → array com 1 elemento",
  umaEspecialidade.specialties?.length === 1,
  `obtido: ${JSON.stringify(umaEspecialidade.specialties)}`
);
assert(
  "Especialidade correta salva",
  umaEspecialidade.specialties?.[0] === "Cardiologia",
);

// Paciente: MANOEL RODRIGUES LIMA, 71 anos, UTI Cardiológica
// Caso complexo: três especialidades envolvidas
const tresEspecialidades = buildResponsibility("rotineiro", "Dr. André Castilho", [
  "Cardiologia",
  "Nefrologia",
  "Infectologia",
]);
assert(
  "Três especialidades → array com 3 elementos",
  tresEspecialidades.specialties?.length === 3,
  `obtido: ${JSON.stringify(tresEspecialidades.specialties)}`
);

// ══════════════════════════════════════════════════════════════════
// BLOCO 2 — Retrocompatibilidade com registros legados (sem specialties)
// ══════════════════════════════════════════════════════════════════

section("BLOCO 2 — Retrocompatibilidade com banco (JSONB legado)");

// Simula registro antigo do banco: apenas type e responsibleDoctorName
const registroLegado = parseFromDb({
  type: "rotineiro",
  responsibleDoctorName: "Dr. Luiz Henrique Matos",
});
assert(
  "Registro legado sem specialties → shouldRenderIndicator = true",
  shouldRenderIndicator(registroLegado),
);
assert(
  "Registro legado sem specialties → specialties undefined (sem crash)",
  registroLegado.specialties === undefined,
);

// Simula registro ainda mais antigo (tipos legacy)
const registroMuitoLegado = parseFromDb({
  type: "lider",
  leaderNames: "Dr. Wagner Fernandes",
});
assert(
  "Tipo legado 'lider' → ainda renderiza indicador",
  shouldRenderIndicator(registroMuitoLegado),
);

// Registro sem nada (type null, sem specialties)
const registroVazio = parseFromDb({ type: null });
assert(
  "Tipo null + sem specialties → NÃO renderiza indicador",
  !shouldRenderIndicator(registroVazio),
);

// ══════════════════════════════════════════════════════════════════
// BLOCO 3 — Indicador no card de leito
// ══════════════════════════════════════════════════════════════════

section("BLOCO 3 — Indicador no card de leito");

// Paciente: LETÍCIA BARROS SOUZA, 45 anos, Clínica Médica
// Apenas especialidades definidas, sem tipo de acompanhamento
const apenasEspecialidades: MedicalResponsibility = {
  type: null,
  specialties: ["Neurologia", "Psiquiatria"],
};
assert(
  "Apenas especialidades (sem tipo) → indicador DEVE renderizar",
  shouldRenderIndicator(apenasEspecialidades),
);
assert(
  "Apenas especialidades → abreviação 'ESPEC.'",
  getIndicatorAbbreviation(apenasEspecialidades) === "ESPEC.",
  `obtido: ${getIndicatorAbbreviation(apenasEspecialidades)}`
);

// Tipo rotineiro + especialidades
const rotineiroComEspec: MedicalResponsibility = {
  type: "rotineiro",
  responsibleDoctorName: "Dra. Sônia Pimentel",
  specialties: ["Endocrinologia", "Geriatria"],
};
assert(
  "Rotineiro + especialidades → abreviação 'ROTIN.'",
  getIndicatorAbbreviation(rotineiroComEspec) === "ROTIN.",
);

// Sem nada configurado
const semNada: MedicalResponsibility = { type: null };
assert(
  "Sem tipo e sem especialidades → NÃO renderiza indicador",
  !shouldRenderIndicator(semNada),
);

// ══════════════════════════════════════════════════════════════════
// BLOCO 4 — Texto do botão no EditPatientDialog
// ══════════════════════════════════════════════════════════════════

section("BLOCO 4 — Botão 'Especialidades Envolvidas' no EditPatientDialog");

// Sem configuração → texto padrão
assert(
  "Sem config → 'Definir especialidades envolvidas'",
  getButtonText(undefined) === "Definir especialidades envolvidas",
);

// Paciente: HERNANDO SOUZA PRADO, 60 anos, Enfermaria Cirúrgica
// Apenas tipo (sem especialidades)
const apenasRotineiro: MedicalResponsibility = { type: "rotineiro" };
assert(
  "Apenas tipo rotineiro → 'ROTINEIRO' (sem contador)",
  getButtonText(apenasRotineiro) === "ROTINEIRO",
  `obtido: ${getButtonText(apenasRotineiro)}`
);

// Tipo + 1 especialidade
const rotineiro1Espec: MedicalResponsibility = {
  type: "rotineiro",
  specialties: ["Cardiologia"],
};
assert(
  "Rotineiro + 1 especialidade → 'ROTINEIRO · 1 especialidade(s)'",
  getButtonText(rotineiro1Espec) === "ROTINEIRO · 1 especialidade(s)",
  `obtido: ${getButtonText(rotineiro1Espec)}`
);

// Sem tipo + 3 especialidades
const tresSemTipo: MedicalResponsibility = {
  type: null,
  specialties: ["Neurologia", "Neurocirurgia", "Infectologia"],
};
assert(
  "Sem tipo + 3 especialidades → '3 especialidade(s)'",
  getButtonText(tresSemTipo) === "3 especialidade(s)",
  `obtido: ${getButtonText(tresSemTipo)}`
);

// ══════════════════════════════════════════════════════════════════
// BLOCO 5 — Serialização JSON (persistência JSONB)
// ══════════════════════════════════════════════════════════════════

section("BLOCO 5 — Serialização para o banco (JSONB)");

const responsabilidadeCompleta: MedicalResponsibility = {
  type: "intercorrencista",
  responsibleDoctorName: "Dr. Claudio Mendes",
  responsibleDoctorCrm: "12345-RN",
  specialties: ["Cardiologia", "Medicina Intensiva / UTI"],
};

const json = JSON.stringify(responsabilidadeCompleta);
const parsed = JSON.parse(json) as MedicalResponsibility;

assert(
  "Serializa e desserializa corretamente",
  parsed.type === "intercorrencista" &&
    parsed.specialties?.length === 2 &&
    parsed.responsibleDoctorCrm === "12345-RN",
  `parsed: ${json}`
);
assert(
  "Especialidades preservadas após round-trip JSON",
  parsed.specialties?.[0] === "Cardiologia" &&
    parsed.specialties?.[1] === "Medicina Intensiva / UTI",
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
