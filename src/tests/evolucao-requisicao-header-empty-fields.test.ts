/**
 * TESTE: Evolução e Requisições — cabeçalho impresso não pode ficar vazio
 * para paciente real
 *
 * Continuação da investigação de 07/08/2026 (ver
 * prescription-header-sex-and-ready-gate.test.ts para o caso da Prescrição).
 * Ao investigar Evolução e Requisições, o padrão do bug era DIFERENTE do
 * de Prescrição — não uma corrida entre fetch e impressão, mas uma falha
 * de conexão de dados:
 *
 * EVOLUÇÃO (bug estrutural, não intermitente):
 *   O objeto `patient` (useMemo no topo de EvolucaoPage.tsx) só populava
 *   sexo/nascimento/idade/admissão/alergias/peso/prontuário para os
 *   pacientes DEMO (leitos L09/L10/L11). Para paciente REAL, esses campos
 *   ficavam SEMPRE vazios no cabeçalho impresso — não dependia de timing,
 *   simplesmente nunca eram preenchidos a partir de nenhuma fonte real
 *   (usePatientIdentifiers, usePatientLive). Peso, em especial, não tinha
 *   NENHUMA fonte de dado real — nem busca dedicada existia (diferente de
 *   PrescricaoPage.tsx, que já sincronizava uti_weight_kg).
 *   Correção: merge com ids.registry (sexo/nascimento/alergias),
 *   livePatient (idade/admissão/alergias) e busca dedicada nova de
 *   uti_weight_kg — mesma fonte que a Prescrição já usa.
 *
 * REQUISIÇÕES (PrintableRequisitionGuide.tsx):
 *   A impressão REAL (`printRequisitionGuide`) já era segura — faz
 *   `await fetchPatientIdentifiers` antes de montar qualquer HTML. O risco
 *   era só na PRÉ-VISUALIZAÇÃO (componente React): campos apareciam como
 *   "—" (sem dado) enquanto na verdade o fetch ainda não tinha voltado —
 *   confundindo "não existe" com "ainda carregando".
 *   Correção: sinal `identifiersResolving` diferencia os dois casos na
 *   tela, mostrando "carregando…" em vez de "—" durante o fetch.
 *
 * Dados fictícios | Zero impacto em produção.
 */

// ── Réplica da lógica de merge de EvolucaoPage.tsx ──────────────────────

interface PatientHeaderLike {
  sex: string;
  birthDate: string;
  age: string;
  admissionDate: string;
  allergies: string;
  record: string;
  weight: string;
}

interface RegistryLike {
  sex: string | null;
  birthDate: string | null;
  allergies: string | null;
}

interface LivePatientLike {
  age: string | null;
  admissionDate: string | null;
  utiAllergies: string[];
}

function mergeEvolutionHeader(
  patient: PatientHeaderLike,
  registry: RegistryLike | null,
  livePatient: LivePatientLike | null,
  prontuarioFromIds: string | null,
  utiWeightKg: string,
) {
  return {
    sex: patient.sex || registry?.sex || "",
    birthDate: patient.birthDate || registry?.birthDate || "",
    age: patient.age || livePatient?.age || "",
    admissionDate: patient.admissionDate || livePatient?.admissionDate || "",
    allergies:
      patient.allergies ||
      (livePatient?.utiAllergies?.length ? livePatient.utiAllergies.join(", ") : "") ||
      registry?.allergies ||
      "",
    record: patient.record || prontuarioFromIds || "",
    weight: patient.weight || utiWeightKg || "",
  };
}

// ── Réplica do sinal identifiersResolving de PrintableRequisitionGuide.tsx ──

function isIdentifiersResolving(
  hasBirthDate: boolean,
  hasMedicalRecord: boolean,
  hasEncounterCode: boolean,
): boolean {
  return !(hasBirthDate && hasMedicalRecord && hasEncounterCode);
}

// ── Runner mínimo ────────────────────────────────────────────────────────

let total = 0;
let falhas = 0;
function check(label: string, cond: boolean, detail?: string) {
  total++;
  if (cond) {
    console.log(`  OK  ${label}`);
  } else {
    falhas++;
    console.error(`FALHA  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("=== Evolução: paciente REAL não fica com cabeçalho vazio ===");
{
  const patientEmpty: PatientHeaderLike = {
    sex: "", birthDate: "", age: "", admissionDate: "", allergies: "", record: "", weight: "",
  };
  const registry: RegistryLike = { sex: "M", birthDate: "1987-07-12", allergies: "Dipirona" };
  const livePatient: LivePatientLike = { age: "39 anos", admissionDate: "2026-07-28", utiAllergies: ["Dipirona"] };

  const merged = mergeEvolutionHeader(patientEmpty, registry, livePatient, "187915-1", "80");

  check("sexo vem do registry quando patient.sex está vazio", merged.sex === "M");
  check("nascimento vem do registry quando patient.birthDate está vazio", merged.birthDate === "1987-07-12");
  check("idade vem do livePatient quando patient.age está vazio", merged.age === "39 anos");
  check("admissão vem do livePatient quando patient.admissionDate está vazio", merged.admissionDate === "2026-07-28");
  check("alergias vem do livePatient quando patient.allergies está vazio", merged.allergies === "Dipirona");
  check("prontuário vem de ids.prontuario quando patient.record está vazio", merged.record === "187915-1");
  check("peso vem da busca dedicada uti_weight_kg quando patient.weight está vazio", merged.weight === "80");
  check(
    "nenhum campo essencial fica vazio quando as fontes reais têm dado",
    Object.values(merged).every((v) => v !== ""),
  );

  const patientDemo: PatientHeaderLike = {
    sex: "Masculino", birthDate: "1953-07-14", age: "72 anos", admissionDate: "2026-03-15",
    allergies: "Dipirona, Sulfa", record: "PRN-2024-08451", weight: "78",
  };
  const mergedDemo = mergeEvolutionHeader(patientDemo, null, null, null, "");
  check(
    "paciente DEMO (patient já populado) não é sobrescrito por fontes ausentes",
    mergedDemo.sex === "Masculino" && mergedDemo.weight === "78",
  );
}

console.log("\n=== Requisições: distingue 'ainda carregando' de 'sem dado' ===");
{
  check(
    "nenhum campo resolvido ainda -> está resolvendo (mostra 'carregando…', não '—')",
    isIdentifiersResolving(false, false, false) === true,
  );
  check(
    "só nascimento resolvido -> ainda resolvendo (faltam prontuário/atendimento)",
    isIdentifiersResolving(true, false, false) === true,
  );
  check(
    "todos os 3 campos já vieram no request -> NÃO está resolvendo, pode confiar no '—'",
    isIdentifiersResolving(true, true, true) === false,
  );
}

console.log(`\n───────────────────────────────────────────`);
console.log(`${total - falhas}/${total} verificações passaram`);
if (falhas > 0) {
  console.error(`${falhas} FALHA(S)`);
  process.exit(1);
}
console.log("Todos os casos passaram.\n");
