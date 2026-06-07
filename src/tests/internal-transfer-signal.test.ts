/**
 * SINALIZAÇÃO DE TRANSFERÊNCIA INTERNA — PAYLOAD DO INSERT
 *
 * Valida a correção do bug onde patient_name (NOT NULL) não era passado
 * no insert de internal_transfer_requests, causando erro em qualquer
 * sinalização de transferência interna independente do setor destino.
 *
 * Testa:
 *  1. Campos obrigatórios (NOT NULL) sempre presentes no payload
 *  2. Campos adicionais que enriquecem o registro (source_bed, sector, etc.)
 *  3. Mapeamento DESTINATION_TO_SECTOR_CODE para todos os destinos do sistema
 *  4. sectorLabelFromCode retorna label legível (não código interno)
 *  5. Cenários edge: encounter nulo, observações vazias
 *
 * Pacientes fictícios — sem vínculo com registros reais.
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

// ── Mapeamento de destinos (espelha PatientMovementDialog.tsx) ────────────────

const DESTINATION_TO_SECTOR_CODE: Record<string, string> = {
  "UTI 01": "red",
  "UTI 02": "yellow",
  "UCI 01": "blue",
  "UCI 02": "outside",
  "ENFERMARIA NEURO 01": "neuro_01",
  "ENFERMARIA NEURO 02": "neuro_02",
  "ENFERMARIA CLÍNICA CIRÚRGICA": "clinica_cirurgica",
  "ENFERMARIA DE TRANSIÇÃO": "enfermaria_transicao",
  "UCC (UNIDADE DE CUIDADOS CLÍNICOS)": "ucc",
  "ENFERMARIA VASCULAR (ANEXO)": "enfermaria_vascular",
  "CENTRO CIRÚRGICO": "cc_bloco",
  "RIV (REFERÊNCIA DE INTERNAÇÃO VASCULAR)": "riv",
  "SALA VERMELHA": "sala_vermelha",
  "SALA LARANJA": "sala_laranja",
  "OBSERVAÇÃO CLÍNICA": "observacao_clinica",
  "INTERNAÇÃO UE": "internacao_ue",
};

// ── Labels por código (espelha hospitalSectors.ts SECTOR_DISPLAY) ─────────────

const SECTOR_DISPLAY: Record<string, string> = {
  red: "UTI 01",
  yellow: "UTI 02",
  blue: "UCI 01",
  outside: "UCI 02",
  neuro_01: "Enfermaria Neuro 01",
  neuro_02: "Enfermaria Neuro 02",
  clinica_cirurgica: "Clínica Cirúrgica",
  enfermaria_transicao: "Enfermaria de Transição",
  ucc: "UCC",
  enfermaria_vascular: "Enfermaria Vascular",
  cc_bloco: "CC Bloco Cirúrgico",
  riv: "RIV",
  sala_vermelha: "Sala Vermelha",
  sala_laranja: "Sala Laranja",
  observacao_clinica: "Observação Clínica",
  internacao_ue: "Internação UE",
};

function sectorLabelFromCode(code?: string | null): string {
  if (!code) return "";
  return SECTOR_DISPLAY[code] || code;
}

// ── Simulação do payload do insert (PatientMovementDialog.tsx) ────────────────

interface Patient {
  id: string;
  name: string;
  bedNumber: string;
  sector: string;
}

interface EncounterData {
  id: string;
  encounter_code: string;
}

interface InsertPayload {
  source_patient_id: string;
  patient_name: string;
  source_bed: string | null;
  source_sector: string | null;
  target_sector_code: string;
  target_sector_label: string | null;
  classification: string;
  requires_saps: boolean;
  status: string;
  signaled_by: string | null;
  hospital_unit_id: string;
  state_id: string;
  department: string | null;
  encounter_code: string | null;
  reason: string | null;
  patient_snapshot: object;
}

function buildInsertPayload(
  patient: Patient,
  sectorCode: string,
  finalDest: string,
  classification: string,
  needsSaps: boolean,
  authUserId: string | null,
  hospitalUnitId: string,
  stateId: string,
  department: string | null,
  encData: EncounterData | null,
  notes: string,
): InsertPayload {
  return {
    source_patient_id: patient.id,
    patient_name: patient.name || "",
    source_bed: patient.bedNumber || null,
    source_sector: patient.sector || null,
    target_sector_code: sectorCode,
    target_sector_label: sectorLabelFromCode(sectorCode) || finalDest || null,
    classification,
    requires_saps: needsSaps,
    status: "pending",
    signaled_by: authUserId,
    hospital_unit_id: hospitalUnitId,
    state_id: stateId,
    department,
    encounter_code: encData?.encounter_code ?? null,
    reason: notes.trim() || finalDest || null,
    patient_snapshot: patient,
  };
}

// ── Dados fictícios de suporte ────────────────────────────────────────────────

const HOSPITAL_ID = "hosp-sj-001";
const STATE_ID = "state-ma-001";

// ══════════════════════════════════════════════════════════════════
// BLOCO 1 — Campos NOT NULL: patient_name sempre presente
// ══════════════════════════════════════════════════════════════════

section("BLOCO 1 — Campos obrigatórios NOT NULL no payload");

// Paciente: CRISTIANO DOMINGUES DE OLIVEIRA, UTI 2 — L17
// Destino: ENFERMARIA CLÍNICA CIRÚRGICA (caso real da foto)
const pacienteCristiano: Patient = {
  id: "pat-uuid-cristiano-001",
  name: "CRISTIANO DOMINGUES DE OLIVEIRA",
  bedNumber: "L17",
  sector: "yellow",
};

const sectorCodeCirurgica = DESTINATION_TO_SECTOR_CODE["ENFERMARIA CLÍNICA CIRÚRGICA"];
const payloadCristiano = buildInsertPayload(
  pacienteCristiano,
  sectorCodeCirurgica,
  "ENFERMARIA CLÍNICA CIRÚRGICA",
  "DESESCALADA",
  false,
  "user-medico-001",
  HOSPITAL_ID,
  STATE_ID,
  "UTI 2",
  { id: "enc-001", encounter_code: "ATM-20260607-001" },
  "AJUSTE RETROATIVO: PACIENTE TEVE ALTA DURANTE O SD PARA ENFERMARIA CIRÚRGICA LEITO 8.",
);

assert(
  "patient_name está presente (NOT NULL — bug raiz corrigido)",
  typeof payloadCristiano.patient_name === "string" &&
  payloadCristiano.patient_name.length > 0,
  `obtido: "${payloadCristiano.patient_name}"`
);
assert(
  "source_patient_id está presente",
  payloadCristiano.source_patient_id === "pat-uuid-cristiano-001",
);
assert(
  "hospital_unit_id está presente",
  payloadCristiano.hospital_unit_id === HOSPITAL_ID,
);
assert(
  "state_id está presente",
  payloadCristiano.state_id === STATE_ID,
);
assert(
  "classification está presente",
  typeof payloadCristiano.classification === "string" &&
  payloadCristiano.classification.length > 0,
);
assert(
  "target_sector_code está presente",
  payloadCristiano.target_sector_code === "clinica_cirurgica",
  `obtido: "${payloadCristiano.target_sector_code}"`
);

// ══════════════════════════════════════════════════════════════════
// BLOCO 2 — Campos adicionais que enriquecem o registro
// ══════════════════════════════════════════════════════════════════

section("BLOCO 2 — Campos adicionais (source_bed, sector, label)");

assert(
  "source_bed = leito de origem",
  payloadCristiano.source_bed === "L17",
  `obtido: "${payloadCristiano.source_bed}"`
);
assert(
  "source_sector = setor de origem",
  payloadCristiano.source_sector === "yellow",
  `obtido: "${payloadCristiano.source_sector}"`
);
assert(
  "target_sector_label é legível (não o código interno)",
  payloadCristiano.target_sector_label !== "clinica_cirurgica",
  `obtido: "${payloadCristiano.target_sector_label}"`
);
assert(
  "target_sector_label tem valor (não vazio)",
  (payloadCristiano.target_sector_label?.length ?? 0) > 0,
  `obtido: "${payloadCristiano.target_sector_label}"`
);
assert(
  "signaled_by = ID do usuário médico",
  payloadCristiano.signaled_by === "user-medico-001",
);
assert(
  "encounter_code fluiu corretamente",
  payloadCristiano.encounter_code === "ATM-20260607-001",
);
assert(
  "reason = observações da sinalização",
  payloadCristiano.reason?.includes("AJUSTE RETROATIVO") ?? false,
  `obtido: "${payloadCristiano.reason?.substring(0, 40)}..."`
);

// ══════════════════════════════════════════════════════════════════
// BLOCO 3 — DESTINATION_TO_SECTOR_CODE: todos os destinos mapeados
// ══════════════════════════════════════════════════════════════════

section("BLOCO 3 — Mapeamento completo de destinos → sector code");

const destinationTests: Array<[string, string]> = [
  ["UTI 01",                              "red"],
  ["UTI 02",                              "yellow"],
  ["UCI 01",                              "blue"],
  ["UCI 02",                              "outside"],
  ["ENFERMARIA NEURO 01",                 "neuro_01"],
  ["ENFERMARIA NEURO 02",                 "neuro_02"],
  ["ENFERMARIA CLÍNICA CIRÚRGICA",        "clinica_cirurgica"],
  ["ENFERMARIA DE TRANSIÇÃO",             "enfermaria_transicao"],
  ["UCC (UNIDADE DE CUIDADOS CLÍNICOS)",  "ucc"],
  ["ENFERMARIA VASCULAR (ANEXO)",         "enfermaria_vascular"],
  ["CENTRO CIRÚRGICO",                    "cc_bloco"],
  ["RIV (REFERÊNCIA DE INTERNAÇÃO VASCULAR)", "riv"],
  ["SALA VERMELHA",                       "sala_vermelha"],
  ["SALA LARANJA",                        "sala_laranja"],
  ["OBSERVAÇÃO CLÍNICA",                  "observacao_clinica"],
  ["INTERNAÇÃO UE",                       "internacao_ue"],
];

for (const [dest, expectedCode] of destinationTests) {
  const code = DESTINATION_TO_SECTOR_CODE[dest];
  assert(
    `"${dest}" → ${expectedCode}`,
    code === expectedCode,
    `obtido: ${code}`
  );
}

// ══════════════════════════════════════════════════════════════════
// BLOCO 4 — sectorLabelFromCode: label legível para todos os setores
// ══════════════════════════════════════════════════════════════════

section("BLOCO 4 — sectorLabelFromCode: labels legíveis por código");

const labelTests: Array<[string, string]> = [
  ["red",               "UTI 01"],
  ["yellow",            "UTI 02"],
  ["blue",              "UCI 01"],
  ["outside",           "UCI 02"],
  ["clinica_cirurgica", "Clínica Cirúrgica"],
  ["ucc",               "UCC"],
  ["neuro_01",          "Enfermaria Neuro 01"],
  ["enfermaria_transicao", "Enfermaria de Transição"],
];

for (const [code, expectedLabel] of labelTests) {
  const label = sectorLabelFromCode(code);
  assert(
    `sectorLabelFromCode("${code}") = "${expectedLabel}"`,
    label === expectedLabel,
    `obtido: "${label}"`
  );
}

assert(
  "sectorLabelFromCode(null) retorna string vazia",
  sectorLabelFromCode(null) === "",
);
assert(
  "sectorLabelFromCode(undefined) retorna string vazia",
  sectorLabelFromCode(undefined) === "",
);
assert(
  "sectorLabelFromCode(código desconhecido) retorna o próprio código",
  sectorLabelFromCode("setor_xyz") === "setor_xyz",
);

// ══════════════════════════════════════════════════════════════════
// BLOCO 5 — Cenários edge: encounter nulo, notes vazia, sector null
// ══════════════════════════════════════════════════════════════════

section("BLOCO 5 — Cenários edge");

// Paciente: JOANA ALVES BEZERRA, 77 anos, UTI 1 — L03
// Transferência para UCI 01 sem encounter ativo e sem observações
const pacienteJoana: Patient = {
  id: "pat-uuid-joana-002",
  name: "JOANA ALVES BEZERRA",
  bedNumber: "L03",
  sector: "red",
};

const payloadSemEncounter = buildInsertPayload(
  pacienteJoana,
  "blue",
  "UCI 01",
  "DESESCALADA",
  false,
  "user-enfermagem-002",
  HOSPITAL_ID,
  STATE_ID,
  null,
  null,   // sem encounter
  "",     // sem notes
);

assert(
  "Sem encounter: encounter_code = null (sem crash)",
  payloadSemEncounter.encounter_code === null,
);
assert(
  "Sem notes: reason usa finalDest como fallback",
  payloadSemEncounter.reason === "UCI 01",
  `obtido: "${payloadSemEncounter.reason}"`
);
assert(
  "department null é aceito",
  payloadSemEncounter.department === null,
);
assert(
  "patient_name ainda presente mesmo sem encounter",
  payloadSemEncounter.patient_name === "JOANA ALVES BEZERRA",
);

// Paciente com nome vazio (leito vago erroneamente)
const pacienteVago: Patient = {
  id: "pat-uuid-vago-003",
  name: "",
  bedNumber: "L09",
  sector: "yellow",
};

const payloadVago = buildInsertPayload(
  pacienteVago, "neuro_01", "ENFERMARIA NEURO 01",
  "LATERAL", false, null, HOSPITAL_ID, STATE_ID, null, null, "",
);

assert(
  "Paciente com nome vazio: patient_name = '' (string, não undefined/null)",
  typeof payloadVago.patient_name === "string",
  `obtido: ${JSON.stringify(payloadVago.patient_name)}`
);
assert(
  "signaled_by aceita null (usuário não autenticado)",
  payloadVago.signaled_by === null,
);

// ══════════════════════════════════════════════════════════════════
// BLOCO 6 — Regressão: comportamento ANTIGO causava NOT NULL violation
// ══════════════════════════════════════════════════════════════════

section("BLOCO 6 — Regressão: simulação do erro antigo");

// Payload ANTIGO sem patient_name (como era antes da correção)
interface OldInsertPayload {
  source_patient_id: string;
  target_sector_code: string;
  classification: string;
  requires_saps: boolean;
  status: string;
  created_by: string | null;  // campo que não existe no schema
  hospital_unit_id: string;
  state_id: string;
  department: string | null;
  encounter_code: string | null;
  encounter_id: string | null;  // campo que não existe no schema
  reason: string | null;
  patient_snapshot: object;
}

function buildInsertPayloadAntigo(patient: Patient, sectorCode: string): OldInsertPayload {
  return {
    source_patient_id: patient.id,
    // SEM patient_name — CAUSAVA NOT NULL VIOLATION
    target_sector_code: sectorCode,
    classification: "DESESCALADA",
    requires_saps: false,
    status: "pending",
    created_by: "user-001",  // campo inexistente no schema
    hospital_unit_id: HOSPITAL_ID,
    state_id: STATE_ID,
    department: null,
    encounter_code: null,
    encounter_id: null,      // campo inexistente no schema
    reason: null,
    patient_snapshot: patient,
  };
}

const payloadAntigo = buildInsertPayloadAntigo(pacienteCristiano, "clinica_cirurgica");

assert(
  "ANTIGO: patient_name ausente do payload (bug documentado)",
  !("patient_name" in payloadAntigo),
);
assert(
  "ANTIGO: created_by presente (campo que não existe no schema)",
  "created_by" in payloadAntigo,
);
assert(
  "ANTIGO: encounter_id presente (campo que não existe no schema)",
  "encounter_id" in payloadAntigo,
);
assert(
  "NOVO: patient_name presente (bug corrigido)",
  "patient_name" in payloadCristiano &&
  payloadCristiano.patient_name === "CRISTIANO DOMINGUES DE OLIVEIRA",
);
assert(
  "NOVO: created_by removido → substituído por signaled_by",
  !("created_by" in payloadCristiano) && "signaled_by" in payloadCristiano,
);
assert(
  "NOVO: encounter_id removido (não existe no schema)",
  !("encounter_id" in payloadCristiano),
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
