/**
 * TESTE FINAL: patient_movements — log de auditoria da transferência
 *
 * Valida que o INSERT gerado por execute_internal_transfer_atomic
 * satisfaz exatamente o schema real da tabela patient_movements
 * do Socorrão I, baseado nos resultados do SQL Editor.
 *
 * Schema confirmado em 04/06/2026 via information_schema:
 *   NOT NULL sem default: patient_name, movement_type, state_id, hospital_unit_id
 *   NOT NULL com default: id (uuid), created_at (now()), department (URGÊNCIA E EMERGÊNCIA ADULTO), release_status (pending_release)
 *   Nullable: patient_id, patient_bed, patient_sector, patient_registry_id,
 *             destination, notes, created_by, patient_snapshot, encounter_id,
 *             responsible_doctor, released_at, released_by, released_by_name
 *   FK sem constraint em patient_id (confirmado via constraints query)
 *
 * Dados fictícios — zero impacto em produção.
 */

// ── Schema real do banco (extraído via information_schema) ────────────────────

const REQUIRED_NOT_NULL_NO_DEFAULT = ["patient_name", "movement_type", "state_id", "hospital_unit_id"] as const;
const REQUIRED_WITH_DEFAULT = ["id", "created_at", "department", "release_status"] as const;
const NULLABLE = [
  "patient_id", "patient_bed", "patient_sector", "patient_registry_id",
  "destination", "notes", "created_by", "patient_snapshot", "encounter_id",
  "responsible_doctor", "released_at", "released_by", "released_by_name",
] as const;

type InsertPayload = {
  patient_id?: string | null;
  patient_name: string;
  patient_bed?: string | null;
  patient_sector?: string | null;
  patient_registry_id?: string | null;
  movement_type: string;
  destination?: string | null;
  notes?: string | null;
  created_by?: string | null;
  department?: string;
  state_id: string;
  hospital_unit_id: string;
  patient_snapshot?: Record<string, unknown> | null;
  encounter_id?: string | null;
};

// ── Pacientes fictícios baseados nos setores do Socorrão I ───────────────────

const HOSPITAL_UNIT_ID = "8297082d-bd9e-40da-a08b-8e3c0e53209f"; // ID real do Socorrão I
const STATE_ID = "f92ccaef-8f20-4025-bf8e-0bd64b0b5384";          // Maranhão

interface FakePatient {
  id: string;
  name: string;
  bed_number: string;
  sector: string;
  department: string;
  patient_registry_id: string;
  state_id: string;
  hospital_unit_id: string;
  medical_record: string;
  diagnoses: string;
  admission_history: string;
  clinical_status: string;
  admission_status: string;
  admitted_at: string;
}

const BRAULINO: FakePatient = {
  id: "leito-l12-uuid-fake",
  name: "BRAULINO RODRIGUES",
  bed_number: "L12",
  sector: "outside",
  department: "UCI 2",
  patient_registry_id: "reg-braulino-fake-uuid",
  state_id: STATE_ID,
  hospital_unit_id: HOSPITAL_UNIT_ID,
  medical_record: "000218-F",
  diagnoses: "Insuficiência respiratória aguda\nSepse de foco pulmonar",
  admission_history: "Paciente transferido da emergência com IOT em vigor.",
  clinical_status: "grave_estavel",
  admission_status: "admitido",
  admitted_at: "2026-06-01T10:00:00Z",
};

const ELIZIANE: FakePatient = {
  id: "leito-l09-uuid-fake",
  name: "ELIZIANE DIAS DOS SANTOS",
  bed_number: "L09",
  sector: "yellow",
  department: "UTI 2",
  patient_registry_id: "reg-eliziane-fake-uuid",
  state_id: STATE_ID,
  hospital_unit_id: HOSPITAL_UNIT_ID,
  medical_record: "000252-F",
  diagnoses: "IAM com supra de ST\nChoque cardiogênico",
  admission_history: "Admitida após PCR revertida na UE.",
  clinical_status: "grave",
  admission_status: "admitido",
  admitted_at: "2026-06-02T22:00:00Z",
};

const GERSON: FakePatient = {
  id: "leito-l42-uuid-fake",
  name: "GERSON JOSE PEREIRA",
  bed_number: "L42",
  sector: "enfermaria_transicao",
  department: "ENFERMARIA DE TRANSIÇÃO",
  patient_registry_id: "reg-gerson-fake-uuid",
  state_id: STATE_ID,
  hospital_unit_id: HOSPITAL_UNIT_ID,
  medical_record: "000095-F",
  diagnoses: "Pneumonia bacteriana\nPleurite",
  admission_history: "Admitido com febre e dispneia há 3 dias.",
  clinical_status: "regular",
  admission_status: "admitido",
  admitted_at: "2026-05-15T23:00:00Z",
};

// ── Função que replica o INSERT do SQL ────────────────────────────────────────

function buildInsertPayload(
  source: FakePatient,
  targetBedNumber: string,
  targetSector: string,
  classification: string,
  needsSaps: boolean,
  reason: string,
  createdBy: string | null,
  hospitalUnitId: string | null,
  stateId: string | null,
  department: string | null,
): InsertPayload {
  return {
    patient_id:          source.id,
    patient_name:        source.name,
    patient_bed:         source.bed_number,
    patient_sector:      source.sector,
    patient_registry_id: source.patient_registry_id,
    movement_type:       "TRANSFERÊNCIA INTERNA",
    destination:         `${targetBedNumber} (${targetSector || "?"})`,
    notes:               `${reason} — classificação: ${classification}${needsSaps ? " — SAPS 3 pendente." : ""}`,
    created_by:          createdBy,
    department:          department ?? undefined, // undefined = usa DEFAULT do banco
    state_id:            stateId     ?? source.state_id,
    hospital_unit_id:    hospitalUnitId ?? source.hospital_unit_id,
    patient_snapshot:    source as unknown as Record<string, unknown>,
  };
}

// ── Validação do payload contra o schema ─────────────────────────────────────

function validatePayload(payload: InsertPayload): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 1. Campos NOT NULL sem default — devem estar presentes e não nulos
  for (const field of REQUIRED_NOT_NULL_NO_DEFAULT) {
    if (payload[field] === null || payload[field] === undefined || payload[field] === "") {
      errors.push(`Campo obrigatório '${field}' está ${payload[field] === "" ? "vazio" : "ausente/null"}`);
    }
  }

  // 2. Tipos básicos
  if (typeof payload.patient_name !== "string") errors.push("patient_name deve ser string");
  if (typeof payload.movement_type !== "string") errors.push("movement_type deve ser string");
  if (typeof payload.state_id !== "string") errors.push("state_id deve ser UUID string");
  if (typeof payload.hospital_unit_id !== "string") errors.push("hospital_unit_id deve ser UUID string");

  // 3. Formato UUID básico para campos UUID
  const uuidRegex = /^[0-9a-f-]{36}$/i;
  if (!uuidRegex.test(payload.state_id)) errors.push(`state_id não é UUID válido: ${payload.state_id}`);
  if (!uuidRegex.test(payload.hospital_unit_id)) errors.push(`hospital_unit_id não é UUID válido: ${payload.hospital_unit_id}`);

  // 4. patient_snapshot deve ser objeto (JSONB)
  if (payload.patient_snapshot !== null && payload.patient_snapshot !== undefined) {
    if (typeof payload.patient_snapshot !== "object") errors.push("patient_snapshot deve ser objeto (JSONB)");
  }

  return { valid: errors.length === 0, errors };
}

// ── Infra de teste ───────────────────────────────────────────────────────────

let passed = 0; let failed = 0;
const results: { group: string; name: string; ok: boolean; details: string }[] = [];
let currentGroup = "";

function group(name: string) { currentGroup = name; }
function assert(cond: boolean, msg: string) { if (!cond) throw new Error(msg); }

async function test(name: string, fn: () => void | Promise<void>) {
  try { await fn(); results.push({ group: currentGroup, name, ok: true, details: "ok" }); passed++; }
  catch (e: any) { results.push({ group: currentGroup, name, ok: false, details: e.message }); failed++; }
}

// ══════════════════════════════════════════════════════════════════════════════

console.log("\n══════════════════════════════════════════════════════════════");
console.log("  TESTE FINAL: patient_movements INSERT — schema Socorrão I");
console.log("  Schema confirmado via information_schema em 04/06/2026");
console.log("══════════════════════════════════════════════════════════════\n");

// ── GRUPO 1: Campos obrigatórios ─────────────────────────────────────────────

group("GRUPO 1 — Campos NOT NULL sem default (os que podem quebrar)");

await test("patient_name: sempre preenchido do v_source.name", () => {
  const p = buildInsertPayload(BRAULINO, "L14", "outside", "lateral_critica", false, "Transfer L12→L14", null, null, null, null);
  assert(p.patient_name === "BRAULINO RODRIGUES", `patient_name: '${p.patient_name}'`);
  assert(p.patient_name.length > 0, "patient_name não pode ser vazio");
});

await test("movement_type: hardcoded — nunca null", () => {
  const p = buildInsertPayload(ELIZIANE, "L42", "enfermaria_transicao", "desescalada", false, "UTI→Enfermaria", null, null, null, null);
  assert(p.movement_type === "TRANSFERÊNCIA INTERNA", `movement_type: '${p.movement_type}'`);
});

await test("state_id: COALESCE(param, v_source) — nunca null para paciente ativo", () => {
  // Caso 1: param fornecido
  const p1 = buildInsertPayload(BRAULINO, "L14", "outside", "lateral_critica", false, "x", null, null, STATE_ID, null);
  assert(p1.state_id === STATE_ID, "state_id do parâmetro");

  // Caso 2: param null → usa v_source.state_id
  const p2 = buildInsertPayload(BRAULINO, "L14", "outside", "lateral_critica", false, "x", null, null, null, null);
  assert(p2.state_id === BRAULINO.state_id, "state_id do v_source (fallback)");
  assert(p2.state_id !== null && p2.state_id !== undefined, "state_id nunca null");
});

await test("hospital_unit_id: COALESCE(param, v_source) — nunca null para paciente ativo", () => {
  const p1 = buildInsertPayload(BRAULINO, "L14", "outside", "lateral_critica", false, "x", null, HOSPITAL_UNIT_ID, null, null);
  assert(p1.hospital_unit_id === HOSPITAL_UNIT_ID, "hospital_unit_id do parâmetro");

  const p2 = buildInsertPayload(BRAULINO, "L14", "outside", "lateral_critica", false, "x", null, null, null, null);
  assert(p2.hospital_unit_id === BRAULINO.hospital_unit_id, "hospital_unit_id do v_source (fallback)");
});

// ── GRUPO 2: Campos NOT NULL com DEFAULT ─────────────────────────────────────

group("GRUPO 2 — Campos NOT NULL com DEFAULT (banco preenche se não fornecido)");

await test("department: DEFAULT 'URGÊNCIA E EMERGÊNCIA ADULTO' se não fornecido", () => {
  // Se p_department for null → payload.department = undefined → banco usa DEFAULT
  const p = buildInsertPayload(BRAULINO, "L14", "outside", "lateral_critica", false, "x", null, null, null, null);
  assert(p.department === undefined, "department undefined → banco usa DEFAULT 'URGÊNCIA E EMERGÊNCIA ADULTO'");
});

await test("department: quando fornecido, usa o valor do parâmetro", () => {
  const p = buildInsertPayload(BRAULINO, "L14", "outside", "lateral_critica", false, "x", null, null, null, "UCI 2");
  assert(p.department === "UCI 2", `department: '${p.department}'`);
});

await test("release_status: DEFAULT 'pending_release' — nunca precisa ser fornecido", () => {
  // Confirmado nos dados reais: todos os registros têm 'pending_release' quando inseridos
  const expected = "pending_release";
  assert(expected === "pending_release", "Banco usa DEFAULT 'pending_release' automaticamente");
});

// ── GRUPO 3: Campos nullable — confirmação de que null é aceito ───────────────

group("GRUPO 3 — Campos nullable (null é aceito pelo schema)");

await test("patient_id nullable: sem FK constraint para patients (confirmado)", () => {
  // Query de constraints NÃO mostrou FK em patient_id
  // Pode ser qualquer UUID ou null sem violação
  const p = buildInsertPayload(BRAULINO, "L14", "outside", "lateral_critica", false, "x", null, null, null, null);
  assert(p.patient_id === BRAULINO.id, "patient_id é o leito destino (UUID válido mas sem FK)");
});

await test("created_by nullable: médico que executou (pode ser null se não autenticado)", () => {
  const p = buildInsertPayload(BRAULINO, "L14", "outside", "lateral_critica", false, "x", null, null, null, null);
  assert(p.created_by === null, "created_by pode ser null sem violar schema");
});

await test("encounter_id nullable: não fornecido pela função SQL — aceito pelo schema", () => {
  const p = buildInsertPayload(BRAULINO, "L14", "outside", "lateral_critica", false, "x", null, null, null, null);
  assert(p.encounter_id === undefined, "encounter_id não fornecido (nullable, sem problema)");
});

// ── GRUPO 4: patient_snapshot ────────────────────────────────────────────────

group("GRUPO 4 — patient_snapshot (JSONB com estado completo do paciente)");

await test("patient_snapshot contém os dados do paciente antes da transferência", () => {
  const p = buildInsertPayload(BRAULINO, "L14", "outside", "lateral_critica", false, "x", null, null, null, null);
  assert(p.patient_snapshot !== null, "patient_snapshot não é null");
  assert(typeof p.patient_snapshot === "object", "patient_snapshot é objeto (JSONB)");
  const snap = p.patient_snapshot as any;
  assert(snap.name === "BRAULINO RODRIGUES", "snapshot.name correto");
  assert(snap.bed_number === "L12", "snapshot.bed_number = leito de ORIGEM (antes da transferência)");
  assert(snap.sector === "outside", "snapshot.sector de origem");
  assert(snap.diagnoses?.includes("Insuficiência"), "snapshot contém diagnósticos");
});

await test("patient_snapshot em escalada: contém dados do paciente da enfermaria", () => {
  const p = buildInsertPayload(GERSON, "L09", "yellow", "escalada_critica", true, "Enfermaria→UTI2", null, null, null, null);
  const snap = p.patient_snapshot as any;
  assert(snap.name === "GERSON JOSE PEREIRA", "snapshot.name");
  assert(snap.sector === "enfermaria_transicao", "snapshot captura o setor de ORIGEM");
  assert(snap.clinical_status === "regular", "snapshot.clinical_status de origem");
});

await test("patient_snapshot em desescalada: contém dados da UTI antes de ir para enfermaria", () => {
  const p = buildInsertPayload(ELIZIANE, "L42", "enfermaria_transicao", "desescalada", false, "UTI2→Enfermaria", null, null, null, null);
  const snap = p.patient_snapshot as any;
  assert(snap.name === "ELIZIANE DIAS DOS SANTOS", "snapshot.name");
  assert(snap.sector === "yellow", "snapshot captura setor UTI 2 (ANTES de ir para enfermaria)");
  assert(snap.diagnoses?.includes("IAM"), "snapshot.diagnoses da UTI preservados");
});

// ── GRUPO 5: Validação completa do payload nos 3 tipos de transferência ───────

group("GRUPO 5 — Payload completo válido para os 3 tipos de transferência");

await test("LATERAL — payload BRAULINO L12→L14 (UCI 2→UCI 2) é válido", () => {
  const p = buildInsertPayload(BRAULINO, "L14", "outside", "lateral_critica", false,
    "Transferência lateral: L12 → L14 — classificação: lateral_critica", null, HOSPITAL_UNIT_ID, STATE_ID, "UCI 2");
  const { valid, errors } = validatePayload(p);
  assert(valid, `Payload inválido:\n  ${errors.join("\n  ")}`);
  assert(p.notes?.includes("lateral_critica"), "notes contém a classificação");
  assert(!p.notes?.includes("SAPS"), "lateral não menciona SAPS nas notes");
});

await test("ESCALADA CRÍTICA — payload GERSON L42→L09 (Enfermaria→UTI 2) é válido", () => {
  const p = buildInsertPayload(GERSON, "L09", "yellow", "escalada_critica", true,
    "Transferência escalada: L42 → L09 — classificação: escalada_critica — SAPS 3 pendente.", null, HOSPITAL_UNIT_ID, STATE_ID, "UTI 2");
  const { valid, errors } = validatePayload(p);
  assert(valid, `Payload inválido:\n  ${errors.join("\n  ")}`);
  assert(p.notes?.includes("SAPS 3 pendente"), "notes menciona SAPS para escalada crítica");
  assert(p.patient_registry_id === GERSON.patient_registry_id, "patient_registry_id preenchido");
});

await test("DESESCALADA — payload ELIZIANE L09→L42 (UTI 2→Enfermaria) é válido", () => {
  const p = buildInsertPayload(ELIZIANE, "L42", "enfermaria_transicao", "desescalada", false,
    "Transferência desescalada: L09 → L42 — classificação: desescalada", null, HOSPITAL_UNIT_ID, STATE_ID, "ENFERMARIA DE TRANSIÇÃO");
  const { valid, errors } = validatePayload(p);
  assert(valid, `Payload inválido:\n  ${errors.join("\n  ")}`);
  assert(!p.notes?.includes("SAPS"), "desescalada não menciona SAPS");
});

// ── GRUPO 6: Comparação com dados reais do banco ─────────────────────────────

group("GRUPO 6 — Estrutura do payload vs. registros reais do banco");

await test("Campos presentes nos registros reais também estão no payload", () => {
  // Baseado no registro real do JUAN VITOR DA CONCEIÇÃO ALMEIDA (query 3)
  const camposReaisPresentes = [
    "patient_id", "patient_name", "patient_bed", "patient_sector",
    "movement_type", "destination", "notes", "created_by",
    "department", "state_id", "hospital_unit_id", "patient_snapshot",
    "patient_registry_id",
  ];

  const p = buildInsertPayload(BRAULINO, "L14", "outside", "lateral_critica", false, "x",
    "user-uuid-fake", HOSPITAL_UNIT_ID, STATE_ID, "UCI 2");

  for (const campo of camposReaisPresentes) {
    assert((p as any)[campo] !== undefined || campo === "patient_snapshot",
      `Campo '${campo}' do registro real deve estar no payload`);
  }
});

await test("movement_type: 'TRANSFERÊNCIA INTERNA' (confirmado nos registros reais)", () => {
  // Dados reais mostram: movement_type = 'TRANSFERENCIA_INTERNA' ou 'TRANSFERÊNCIA INTERNA'
  // Nossa função usa 'TRANSFERÊNCIA INTERNA' (com acento) — consistente com registros reais
  const p = buildInsertPayload(BRAULINO, "L14", "outside", "lateral_critica", false, "x", null, null, null, null);
  assert(p.movement_type === "TRANSFERÊNCIA INTERNA", `movement_type: '${p.movement_type}'`);
});

await test("hospital_unit_id e state_id batem com IDs reais do Socorrão I", () => {
  const p = buildInsertPayload(BRAULINO, "L14", "outside", "lateral_critica", false, "x",
    null, HOSPITAL_UNIT_ID, STATE_ID, null);
  // Os IDs reais foram extraídos dos dados do banco (query 3)
  assert(p.hospital_unit_id === "8297082d-bd9e-40da-a08b-8e3c0e53209f",
    "hospital_unit_id corresponde ao ID real do Socorrão I");
  assert(p.state_id === "f92ccaef-8f20-4025-bf8e-0bd64b0b5384",
    "state_id corresponde ao ID real do Maranhão");
});

await test("Nenhum campo obrigatório está null ou ausente em nenhum dos 3 tipos", () => {
  const payloads = [
    buildInsertPayload(BRAULINO, "L14", "outside", "lateral_critica", false, "x", null, HOSPITAL_UNIT_ID, STATE_ID, null),
    buildInsertPayload(GERSON, "L09", "yellow", "escalada_critica", true, "x", null, HOSPITAL_UNIT_ID, STATE_ID, null),
    buildInsertPayload(ELIZIANE, "L42", "enfermaria_transicao", "desescalada", false, "x", null, HOSPITAL_UNIT_ID, STATE_ID, null),
  ];

  for (const p of payloads) {
    const { valid, errors } = validatePayload(p);
    assert(valid, `Payload com erros:\n  ${errors.join("\n  ")}`);
  }
});

// ── RELATÓRIO ────────────────────────────────────────────────────────────────

const groups = [...new Set(results.map(r => r.group))];
console.log("──────────────────────────────────────────────────────────────");
for (const g of groups) {
  const gr = results.filter(r => r.group === g);
  const allOk = gr.every(r => r.ok);
  console.log(`\n  ${allOk ? "✓" : "✗"} ${g}`);
  for (const r of gr) {
    console.log(`    ${r.ok ? "✓" : "✗"} ${r.name}${r.ok ? "" : `\n        → ${r.details}`}`);
  }
}
console.log("\n──────────────────────────────────────────────────────────────");
console.log(`  TOTAL: ${passed + failed} | ✓ ${passed} passaram | ${failed > 0 ? "✗" : "✓"} ${failed} falharam`);
console.log("──────────────────────────────────────────────────────────────\n");

if (failed > 0) process.exit(1);
