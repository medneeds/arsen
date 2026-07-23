/**
 * VALIDAÇÃO DOS FLUXOS DE TRANSFERÊNCIA
 * Hospital Municipal Djalma Marques — Socorrão I
 *
 * Cobre os três tipos que devem ser validados manualmente antes do deploy:
 *   1. Lateral (mesmo nível de complexidade)
 *   2. Escalada crítica (→ UTI / UCI 2)
 *   3. Desescalada (UTI → Enfermaria)
 *
 * Importa as funções reais de classificação (sectorComplexity.ts).
 * Dados de pacientes são completamente fictícios.
 */

import {
  classifyTransfer,
  requiresNewAdmission,
  requiresSaps,
  getSectorComplexityLevel,
  type TransferClassification,
} from "../lib/sectorComplexity.ts";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface MockPatient {
  id: string;
  name: string;
  bed_number: string;
  sector: string;
  is_vacant: boolean;
  admission_status: string | null;
  patient_registry_id: string | null;
  medical_record: string | null;
  diagnoses: string | null;
  medical_history: string | null;
  admission_history: string | null;
  clinical_status: string | null;
  admitted_at: string | null;
}

interface TransferResult {
  ok: boolean;
  classification: TransferClassification;
  needsSaps: boolean;
  needsNewAdmission: boolean;
  destinationStatus: string;
  source: MockPatient;
  destination: MockPatient;
  error?: string;
}

// ── Simulação do execute_internal_transfer_atomic ─────────────────────────────

function simulateAtomicTransfer(
  source: MockPatient,
  dest: MockPatient,
  options: { repointFails?: boolean; step3Fails?: boolean } = {}
): TransferResult {
  const classification = classifyTransfer(source.sector, dest.sector);
  const needsSapsFlag = requiresSaps(classification);
  const needsNewAdmissionFlag = requiresNewAdmission(classification);

  // Calcula status de destino (igual à lógica do SQL)
  const destinationStatus = needsSapsFlag
    ? "saps_pendente"
    : needsNewAdmissionFlag
    ? "pre_admitido"
    : (source.admission_status ?? "admitido");

  // Snapshot para rollback
  const sourceSnap = { ...source };
  const destSnap = { ...dest };

  try {
    // PASSO 1: Popula destino
    dest.name = source.name;
    dest.patient_registry_id = source.patient_registry_id;
    dest.medical_record = source.medical_record;
    dest.diagnoses = source.diagnoses;
    dest.medical_history = source.medical_history;
    dest.clinical_status = source.clinical_status;
    dest.admission_status = destinationStatus;
    dest.is_vacant = false;
    // Em escalada: nova admissão → admission_history null; senão preserva
    dest.admission_history = needsNewAdmissionFlag ? null : source.admission_history;
    // Em escalada: admitted_at null até D0; senão preserva
    dest.admitted_at = needsNewAdmissionFlag ? null : source.admitted_at;

    // PASSO 2: Repoint (pode falhar)
    if (options.repointFails) throw new Error("Repoint falhou: clinical_evolutions lock timeout");

    // PASSO 3: Zera origem (pode falhar)
    if (options.step3Fails) throw new Error("Falha ao esvaziar leito de origem");
    source.name = "";
    source.patient_registry_id = null;
    source.medical_record = null;
    source.diagnoses = null;
    source.medical_history = null;
    source.clinical_status = null;
    source.admission_status = null;
    source.admission_history = null;
    source.admitted_at = null;
    source.is_vacant = true;

    return { ok: true, classification, needsSaps: needsSapsFlag, needsNewAdmission: needsNewAdmissionFlag, destinationStatus, source, destination: dest };
  } catch (err: any) {
    // ROLLBACK automático (equivale ao ROLLBACK do PostgreSQL)
    Object.assign(source, sourceSnap);
    Object.assign(dest, destSnap);
    return { ok: false, classification, needsSaps: needsSapsFlag, needsNewAdmission: needsNewAdmissionFlag, destinationStatus, source, destination: dest, error: err.message };
  }
}

// ── Infra de teste ───────────────────────────────────────────────────────────

let passed = 0; let failed = 0;
const results: { group: string; name: string; ok: boolean; details: string }[] = [];
let currentGroup = "";

function group(name: string) { currentGroup = name; }

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ group: currentGroup, name, ok: true, details: "ok" });
    passed++;
  } catch (e: any) {
    results.push({ group: currentGroup, name, ok: false, details: e.message });
    failed++;
  }
}

// ── Pacientes fictícios ───────────────────────────────────────────────────────

function pacienteBraulino(): MockPatient {
  return {
    id: "leito-l12-uuid",
    name: "BRAULINO RODRIGUES",
    bed_number: "L12",
    sector: "outside",          // UCI 2 — Nível 2
    is_vacant: false,
    admission_status: "admitido",
    patient_registry_id: "reg-braulino-uuid",
    medical_record: "000218",
    diagnoses: "Insuficiência respiratória aguda\nSepse de foco pulmonar",
    medical_history: "HAS\nDM2\nEx-tabagista",
    admission_history: "Paciente transferido da emergência com IOT em vigor.",
    clinical_status: "grave_estavel",
    admitted_at: "2026-06-01T10:00:00Z",
  };
}

function pacienteEliziane(): MockPatient {
  return {
    id: "leito-l09-uuid",
    name: "ELIZIANE DIAS DOS SANTOS",
    bed_number: "L09",
    sector: "yellow",           // UTI 2 — Nível 1
    is_vacant: false,
    admission_status: "admitido",
    patient_registry_id: "reg-eliziane-uuid",
    medical_record: "000252",
    diagnoses: "IAM com supra de ST\nChoque cardiogênico",
    medical_history: "Cardiopatia isquêmica\nHipertensão",
    admission_history: "Paciente admitida após PCR revertida na UE.",
    clinical_status: "grave",
    admitted_at: "2026-06-02T22:00:00Z",
  };
}

function pacienteGerson(): MockPatient {
  return {
    id: "leito-l42-uuid",
    name: "GERSON JOSE PEREIRA",
    bed_number: "L42",
    sector: "enfermaria_transicao",  // Enfermaria — Nível 4
    is_vacant: false,
    admission_status: "admitido",
    patient_registry_id: "reg-gerson-uuid",
    medical_record: "000095",
    diagnoses: "Pneumonia bacteriana\nPleurite",
    medical_history: "DPOC\nTabagista ativo",
    admission_history: "Paciente admitido com febre e dispneia há 3 dias.",
    clinical_status: "regular",
    admitted_at: "2026-05-15T23:00:00Z",
  };
}

function leitoVago(id: string, bed_number: string, sector: string): MockPatient {
  return {
    id, name: "", bed_number, sector,
    is_vacant: true, admission_status: null,
    patient_registry_id: null, medical_record: null,
    diagnoses: null, medical_history: null,
    admission_history: null, clinical_status: null, admitted_at: null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// TIPO 1: LATERAL (mesmo nível de complexidade)
// Exemplo: UCI 2 (outside/nível 2) → UCI 2 (outside/nível 2)
// ══════════════════════════════════════════════════════════════════════════════

console.log("\n══════════════════════════════════════════════════════");
console.log("  VALIDAÇÃO DE FLUXOS DE TRANSFERÊNCIA — Socorrão I");
console.log("  Dados fictícios | Zero impacto em produção");
console.log("══════════════════════════════════════════════════════\n");

group("TIPO 1 — Lateral: UCI 2 (L12) → UCI 2 (L14)");

await test("Classificação: lateral_critica entre setores de mesmo nível crítico", () => {
  const c = classifyTransfer("outside", "outside");
  assert(c === "lateral_critica", `Esperado 'lateral_critica', recebeu '${c}'`);
  assert(!requiresNewAdmission(c), "Lateral não requer nova admissão");
  assert(!requiresSaps(c), "Lateral não requer SAPS");
});

await test("Lateral: paciente BRAULINO migra de L12 para L14 com histórico preservado", () => {
  const braulino = pacienteBraulino();
  const l14 = leitoVago("leito-l14-uuid", "L14", "outside");

  const result = simulateAtomicTransfer(braulino, l14);

  assert(result.ok === true, "Transferência lateral deve ter sucesso");
  assert(result.classification === "lateral_critica", `Classificação: ${result.classification}`);
  assert(!result.needsSaps, "Lateral não exige SAPS");
  assert(!result.needsNewAdmission, "Lateral não exige nova admissão");
  assert(result.destinationStatus === "admitido", `Status destino deve ser 'admitido', recebeu '${result.destinationStatus}'`);
});

await test("Lateral: admission_history preservada no destino (mesma internação)", () => {
  const braulino = pacienteBraulino();
  // Salva valores ANTES da chamada — o objeto source é mutado (zerado) pela função
  const admissionHistoryOriginal = braulino.admission_history;
  const admittedAtOriginal = braulino.admitted_at;
  const l14 = leitoVago("leito-l14-uuid", "L14", "outside");

  const result = simulateAtomicTransfer(braulino, l14);

  assert(result.destination.admission_history === admissionHistoryOriginal,
    "admission_history deve ser preservada em transferência lateral");
  assert(result.destination.admitted_at === admittedAtOriginal,
    "admitted_at deve ser preservado em lateral");
});

await test("Lateral: diagnósticos, histórico clínico e registry migram para destino", () => {
  const braulino = pacienteBraulino();
  const l14 = leitoVago("leito-l14-uuid", "L14", "outside");

  const result = simulateAtomicTransfer(braulino, l14);

  assert(result.destination.name === "BRAULINO RODRIGUES", "Nome preservado");
  assert(result.destination.patient_registry_id === "reg-braulino-uuid", "Registry preservado");
  assert(result.destination.diagnoses?.includes("Insuficiência respiratória"), "Diagnósticos preservados");
  assert(result.destination.clinical_status === "grave_estavel", "Status clínico preservado");
});

await test("Lateral: leito de origem completamente zerado", () => {
  const braulino = pacienteBraulino();
  const l14 = leitoVago("leito-l14-uuid", "L14", "outside");

  const result = simulateAtomicTransfer(braulino, l14);

  assert(result.source.name === "", "Nome do leito origem deve estar vazio");
  assert(result.source.is_vacant === true, "Leito origem deve estar vago");
  assert(result.source.patient_registry_id === null, "Registry do origem deve ser null");
  assert(result.source.diagnoses === null, "Diagnósticos da origem devem ser null");
});

await test("Lateral: ROLLBACK se repoint falhar — paciente permanece na origem", () => {
  const braulino = pacienteBraulino();
  const l14 = leitoVago("leito-l14-uuid", "L14", "outside");

  const result = simulateAtomicTransfer(braulino, l14, { repointFails: true });

  assert(result.ok === false, "Deve retornar erro");
  assert(result.source.name === "BRAULINO RODRIGUES", "Origem restaurada após rollback");
  assert(result.source.is_vacant === false, "Origem ainda ocupada");
  assert(result.destination.is_vacant === true, "Destino voltou a vago");
});

// ══════════════════════════════════════════════════════════════════════════════
// TIPO 2: ESCALADA CRÍTICA (Enfermaria → UTI)
// Exemplo: Enfermaria de Transição (nível 4) → UTI 2/yellow (nível 1)
// ══════════════════════════════════════════════════════════════════════════════

group("TIPO 2 — Escalada crítica: Enfermaria L42 → UTI 2 L09");

await test("Classificação: escalada_critica de nível 4 para nível 1", () => {
  const c = classifyTransfer("enfermaria_transicao", "yellow");
  assert(c === "escalada_critica", `Esperado 'escalada_critica', recebeu '${c}'`);
  assert(requiresNewAdmission(c), "Escalada crítica REQUER nova admissão");
  assert(requiresSaps(c), "Escalada crítica REQUER SAPS 3");
});

await test("Escalada crítica: paciente GERSON admitido na UTI com saps_pendente", () => {
  const gerson = pacienteGerson();
  const l09uti = leitoVago("leito-l09-uuid", "L09", "yellow");

  const result = simulateAtomicTransfer(gerson, l09uti);

  assert(result.ok === true, "Escalada crítica deve ter sucesso");
  assert(result.classification === "escalada_critica", `Classificação: ${result.classification}`);
  assert(result.needsSaps === true, "Deve exigir SAPS 3");
  assert(result.needsNewAdmission === true, "Deve exigir nova admissão");
  assert(result.destinationStatus === "saps_pendente",
    `Status destino deve ser 'saps_pendente', recebeu '${result.destinationStatus}'`);
});

await test("Escalada crítica: admission_history NULA no destino (nova admissão clínica)", () => {
  const gerson = pacienteGerson();
  const l09uti = leitoVago("leito-l09-uuid", "L09", "yellow");

  const result = simulateAtomicTransfer(gerson, l09uti);

  assert(result.destination.admission_history === null,
    "Em escalada: admission_history deve ser null no destino (médico preenche D0 na UTI)");
  assert(result.destination.admitted_at === null,
    "admitted_at deve ser null (aguarda conclusão da admissão clínica na UTI)");
});

await test("Escalada crítica: dados clínicos do paciente migram para UTI", () => {
  const gerson = pacienteGerson();
  const l09uti = leitoVago("leito-l09-uuid", "L09", "yellow");

  const result = simulateAtomicTransfer(gerson, l09uti);

  assert(result.destination.name === "GERSON JOSE PEREIRA", "Nome migrou");
  assert(result.destination.patient_registry_id === "reg-gerson-uuid", "Registry migrou");
  assert(result.destination.diagnoses?.includes("Pneumonia"), "Diagnósticos migraram");
  assert(result.destination.medical_record === "000095", "Prontuário migrou");
});

await test("Escalada crítica: origem zerada — leito da enfermaria fica vago", () => {
  const gerson = pacienteGerson();
  const l09uti = leitoVago("leito-l09-uuid", "L09", "yellow");

  const result = simulateAtomicTransfer(gerson, l09uti);

  assert(result.source.is_vacant === true, "Leito da enfermaria deve estar vago após escalada");
  assert(result.source.name === "", "Nome da enfermaria deve estar vazio");
  assert(result.source.admission_status === null, "Status da enfermaria deve ser null");
});

await test("Escalada crítica: ROLLBACK se origem não puder ser zerada", () => {
  const gerson = pacienteGerson();
  const l09uti = leitoVago("leito-l09-uuid", "L09", "yellow");

  const result = simulateAtomicTransfer(gerson, l09uti, { step3Fails: true });

  assert(result.ok === false, "Deve retornar erro");
  // Paciente deve estar na enfermaria (origem) — não deixa duplicado
  assert(result.source.name === "GERSON JOSE PEREIRA", "Origem restaurada");
  assert(result.source.is_vacant === false, "Enfermaria ainda ocupada");
  assert(result.destination.is_vacant === true, "UTI volta a ficar vaga");
  assert(result.destination.admission_status === null, "UTI sem status de admissão");
});

await test("Escalada crítica: complexidade correta — nível 4 → nível 1", () => {
  const nivelOrigem = getSectorComplexityLevel("enfermaria_transicao");
  const nivelDestino = getSectorComplexityLevel("yellow");
  assert(nivelOrigem === 4, `Enfermaria deve ser nível 4, é ${nivelOrigem}`);
  assert(nivelDestino === 1, `UTI 2 deve ser nível 1, é ${nivelDestino}`);
  assert(nivelOrigem > nivelDestino, "Destino mais crítico = escalada");
});

// ══════════════════════════════════════════════════════════════════════════════
// TIPO 3: DESESCALADA (UTI → Enfermaria)
// Exemplo: UTI 2/yellow (nível 1) → Enfermaria de Transição (nível 4)
// ══════════════════════════════════════════════════════════════════════════════

group("TIPO 3 — Desescalada: UTI 2 L09 → Enfermaria L42");

await test("Classificação: desescalada de nível 1 para nível 4", () => {
  const c = classifyTransfer("yellow", "enfermaria_transicao");
  assert(c === "desescalada", `Esperado 'desescalada', recebeu '${c}'`);
  assert(!requiresNewAdmission(c), "Desescalada NÃO requer nova admissão");
  assert(!requiresSaps(c), "Desescalada NÃO requer SAPS");
});

await test("Desescalada: paciente ELIZIANE vai para enfermaria com continuidade", () => {
  const eliziane = pacienteEliziane();
  const l42enf = leitoVago("leito-l42-uuid", "L42", "enfermaria_transicao");

  const result = simulateAtomicTransfer(eliziane, l42enf);

  assert(result.ok === true, "Desescalada deve ter sucesso");
  assert(result.classification === "desescalada", `Classificação: ${result.classification}`);
  assert(!result.needsSaps, "Desescalada não exige SAPS");
  assert(!result.needsNewAdmission, "Desescalada não exige nova admissão");
  assert(result.destinationStatus === "admitido",
    `Status destino deve ser 'admitido', recebeu '${result.destinationStatus}'`);
});

await test("Desescalada: admission_history PRESERVADA — mesma internação continua", () => {
  const eliziane = pacienteEliziane();
  // Salva valores ANTES da chamada — o objeto source é mutado (zerado) pela função
  const admissionHistoryOriginal = eliziane.admission_history;
  const admittedAtOriginal = eliziane.admitted_at;
  const l42enf = leitoVago("leito-l42-uuid", "L42", "enfermaria_transicao");

  const result = simulateAtomicTransfer(eliziane, l42enf);

  assert(result.destination.admission_history === admissionHistoryOriginal,
    "admission_history deve ser preservada na desescalada");
  assert(result.destination.admitted_at === admittedAtOriginal,
    "admitted_at original deve ser preservado (mesma internação)");
});

await test("Desescalada: histórico clínico completo migra para enfermaria", () => {
  const eliziane = pacienteEliziane();
  const l42enf = leitoVago("leito-l42-uuid", "L42", "enfermaria_transicao");

  const result = simulateAtomicTransfer(eliziane, l42enf);

  assert(result.destination.name === "ELIZIANE DIAS DOS SANTOS", "Nome migrou");
  assert(result.destination.diagnoses?.includes("IAM com supra"), "Diagnósticos migraram");
  assert(result.destination.medical_history?.includes("Cardiopatia"), "Histórico médico migrou");
  assert(result.destination.patient_registry_id === "reg-eliziane-uuid", "Registry migrou");
});

await test("Desescalada: leito da UTI completamente zerado", () => {
  const eliziane = pacienteEliziane();
  const l42enf = leitoVago("leito-l42-uuid", "L42", "enfermaria_transicao");

  const result = simulateAtomicTransfer(eliziane, l42enf);

  assert(result.source.is_vacant === true, "UTI deve estar vaga após desescalada");
  assert(result.source.name === "", "Nome da UTI deve estar vazio");
  assert(result.source.clinical_status === null, "Status clínico zerado na UTI");
});

await test("Desescalada: ROLLBACK se repoint falhar", () => {
  const eliziane = pacienteEliziane();
  const l42enf = leitoVago("leito-l42-uuid", "L42", "enfermaria_transicao");

  const result = simulateAtomicTransfer(eliziane, l42enf, { repointFails: true });

  assert(result.ok === false, "Deve retornar erro");
  assert(result.source.name === "ELIZIANE DIAS DOS SANTOS", "Eliziane volta para a UTI (rollback)");
  assert(result.source.is_vacant === false, "UTI ainda ocupada");
  assert(result.destination.is_vacant === true, "Enfermaria vaga (rollback)");
});

// ══════════════════════════════════════════════════════════════════════════════
// TESTES CRUZADOS — Verificações de consistência entre tipos
// ══════════════════════════════════════════════════════════════════════════════

group("CRUZADOS — Consistência entre os três tipos");

await test("Cada tipo tem admission_status correto no destino", () => {
  const lateral   = simulateAtomicTransfer(pacienteBraulino(), leitoVago("x", "L14", "outside"));
  const escalada  = simulateAtomicTransfer(pacienteGerson(), leitoVago("y", "L09", "yellow"));
  const descalada = simulateAtomicTransfer(pacienteEliziane(), leitoVago("z", "L42", "enfermaria_transicao"));

  assert(lateral.destinationStatus === "admitido",
    `Lateral → admitido (recebeu '${lateral.destinationStatus}')`);
  assert(escalada.destinationStatus === "saps_pendente",
    `Escalada crítica → saps_pendente (recebeu '${escalada.destinationStatus}')`);
  assert(descalada.destinationStatus === "admitido",
    `Desescalada → admitido (recebeu '${descalada.destinationStatus}')`);
});

await test("Apenas escalada crítica exige SAPS 3 — lateral e desescalada não", () => {
  const lateralC = classifyTransfer("outside", "outside");
  const escaladaC = classifyTransfer("enfermaria_transicao", "yellow");
  const desescC = classifyTransfer("yellow", "enfermaria_transicao");

  assert(!requiresSaps(lateralC), "Lateral NÃO exige SAPS");
  assert(requiresSaps(escaladaC), "Escalada crítica EXIGE SAPS");
  assert(!requiresSaps(desescC), "Desescalada NÃO exige SAPS");
});

await test("admission_history: null só na escalada, preservada nos outros dois tipos", () => {
  const lateral   = simulateAtomicTransfer(pacienteBraulino(), leitoVago("x", "L14", "outside"));
  const escalada  = simulateAtomicTransfer(pacienteGerson(), leitoVago("y", "L09", "yellow"));
  const descalada = simulateAtomicTransfer(pacienteEliziane(), leitoVago("z", "L42", "enfermaria_transicao"));

  assert(lateral.destination.admission_history !== null,
    "Lateral: admission_history preservada");
  assert(escalada.destination.admission_history === null,
    "Escalada: admission_history null (nova admissão)");
  assert(descalada.destination.admission_history !== null,
    "Desescalada: admission_history preservada");
});

await test("Todos os tipos: leito de origem sempre zerado em caso de sucesso", () => {
  const lateral   = simulateAtomicTransfer(pacienteBraulino(), leitoVago("x", "L14", "outside"));
  const escalada  = simulateAtomicTransfer(pacienteGerson(), leitoVago("y", "L09", "yellow"));
  const descalada = simulateAtomicTransfer(pacienteEliziane(), leitoVago("z", "L42", "enfermaria_transicao"));

  for (const [tipo, r] of [["lateral", lateral], ["escalada", escalada], ["desescalada", descalada]] as const) {
    assert((r as TransferResult).source.is_vacant === true, `${tipo}: origem deve estar vaga`);
    assert((r as TransferResult).source.name === "", `${tipo}: nome da origem deve ser vazio`);
    assert((r as TransferResult).source.patient_registry_id === null, `${tipo}: registry da origem deve ser null`);
  }
});

await test("Todos os tipos: ROLLBACK mantém paciente em EXATAMENTE um leito", () => {
  const cenarios = [
    { tipo: "lateral (repoint falha)",   source: pacienteBraulino(), dest: leitoVago("x", "L14", "outside"),               opts: { repointFails: true } },
    { tipo: "escalada (origem não zera)", source: pacienteGerson(),  dest: leitoVago("y", "L09", "yellow"),               opts: { step3Fails: true } },
    { tipo: "desescalada (repoint falha)", source: pacienteEliziane(), dest: leitoVago("z", "L42", "enfermaria_transicao"), opts: { repointFails: true } },
  ];

  for (const c of cenarios) {
    const r = simulateAtomicTransfer(c.source, c.dest, c.opts);
    const pacienteNaOrigem = !r.source.is_vacant;
    const pacienteNoDestino = !r.destination.is_vacant;
    // Com transação: EXATAMENTE um dos dois deve ter o paciente (o original)
    assert(pacienteNaOrigem && !pacienteNoDestino,
      `${c.tipo}: após rollback, paciente deve estar só na origem`);
  }
});

// ── Relatório ────────────────────────────────────────────────────────────────

const groups = [...new Set(results.map(r => r.group))];
console.log("──────────────────────────────────────────────────────────────");
for (const g of groups) {
  const groupResults = results.filter(r => r.group === g);
  const allOk = groupResults.every(r => r.ok);
  console.log(`\n  ${allOk ? "✓" : "✗"} ${g}`);
  for (const r of groupResults) {
    console.log(`    ${r.ok ? "✓" : "✗"} ${r.name}${r.ok ? "" : `\n        → ${r.details}`}`);
  }
}
console.log("\n──────────────────────────────────────────────────────────────");
console.log(`  TOTAL: ${passed + failed} | ✓ ${passed} passaram | ${failed > 0 ? "✗" : "✓"} ${failed} falharam`);
console.log("──────────────────────────────────────────────────────────────\n");

if (failed > 0) process.exit(1);
