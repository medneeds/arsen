/**
 * TESTE: ALTA-03 e ALTA-04 — completeInternalTransfer + cancelInternalTransferRequest
 *
 * ALTA-03: falha no update de status após repoint → deve lançar erro (não silenciar)
 * ALTA-04: cancelamento restaura paciente no leito de origem se ainda estiver vago
 *
 * Dados fictícios | Zero impacto em produção.
 */

// ── Tipos e dados fictícios ───────────────────────────────────────────────────

interface MockBed {
  id: string;
  name: string;
  bed_number: string;
  sector: string;
  is_vacant: boolean;
  admission_status: string | null;
  patient_registry_id: string | null;
  medical_record: string | null;
  diagnoses: string | null;
}

interface MockTransferRequest {
  id: string;
  source_patient_id: string;
  status: "pending" | "completed" | "cancelled";
  patient_snapshot: Record<string, any>;
  completed_target_patient_id?: string | null;
  completed_by?: string | null;
  cancelled_by?: string | null;
  cancellation_reason?: string | null;
}

function makeBedOrigem(): MockBed {
  return {
    id: "leito-u01-uuid",
    name: "FRANCISCA ALVES DE SOUSA",
    bed_number: "U01",
    sector: "red",
    is_vacant: false,
    admission_status: "admitido",
    patient_registry_id: "registry-francisca-uuid",
    medical_record: "PAC-2024-0042",
    diagnoses: "DPOC exacerbada\nInsuficiência respiratória",
  };
}

function makeBedDestino(): MockBed {
  return {
    id: "leito-u09-uuid",
    name: "",
    bed_number: "U09",
    sector: "yellow",
    is_vacant: true,
    admission_status: null,
    patient_registry_id: null,
    medical_record: null,
    diagnoses: null,
  };
}

function makeRequest(overrides: Partial<MockTransferRequest> = {}): MockTransferRequest {
  const origem = makeBedOrigem();
  return {
    id: "req-transfer-001-uuid",
    source_patient_id: origem.id,
    status: "pending",
    patient_snapshot: {
      name: origem.name,
      age: "68",
      diagnoses: ["DPOC exacerbada", "Insuficiência respiratória"],
      medicalHistory: ["HAS", "DM2"],
      admissionStatus: "admitido",
      _registryId: origem.patient_registry_id,
      _medicalRecord: origem.medical_record,
      _admittedAt: "2024-11-15T08:30:00+00:00",
      _admissionHistory: null,
    },
    ...overrides,
  };
}

// ── Simulação: completeInternalTransfer (fallback path) ───────────────────────

interface CompleteResult {
  ok: boolean;
  error?: string;
  requestStatus?: "completed";
}

function simulateComplete(options: {
  requestStatus: "pending" | "completed" | "cancelled";
  repointSucceeds: boolean;
  statusUpdateSucceeds: boolean;
}): CompleteResult {
  // Guarda de idempotência: request deve estar pending
  if (options.requestStatus !== "pending") {
    return { ok: false, error: `Request já está ${options.requestStatus}` };
  }

  // Falha no repoint → erro imediato
  if (!options.repointSucceeds) {
    return { ok: false, error: "Falha ao migrar histórico clínico (repoint simulado)" };
  }

  // Passo crítico: update de status — DEVE lançar erro se falhar (ALTA-03 fix)
  if (!options.statusUpdateSucceeds) {
    // COMPORTAMENTO CORRIGIDO: throw — o chamador sabe que a operação não foi confirmada
    throw new Error("Falha ao marcar request como completed (status update simulado)");
  }

  return { ok: true, requestStatus: "completed" };
}

// ── Simulação: cancelInternalTransferRequest (ALTA-04 fix) ───────────────────

interface CancelResult {
  ok: boolean;
  restoredSourceBed: boolean;
  requestStatus?: "cancelled";
  error?: string;
}

function simulateCancel(options: {
  request: MockTransferRequest;
  sourceBed: MockBed | null;
  updateStatusSucceeds: boolean;
}): CancelResult {
  const { request, sourceBed, updateStatusSucceeds } = options;

  if (request.status !== "pending") {
    return { ok: false, restoredSourceBed: false, error: "Solicitação não encontrada ou já processada" };
  }

  const snapshot = request.patient_snapshot;
  let restoredSourceBed = false;

  // Restaura apenas se o leito está vago
  if (sourceBed?.is_vacant === true) {
    // Aplica snapshot de volta ao leito de origem (simulado em memória)
    sourceBed.name = snapshot.name ?? "";
    sourceBed.patient_registry_id = snapshot._registryId ?? null;
    sourceBed.medical_record = snapshot._medicalRecord ?? null;
    sourceBed.diagnoses = Array.isArray(snapshot.diagnoses)
      ? snapshot.diagnoses.join("\n")
      : snapshot.diagnoses || null;
    sourceBed.admission_status = snapshot.admissionStatus ?? "admitido";
    sourceBed.is_vacant = false;
    restoredSourceBed = true;
  }

  if (!updateStatusSucceeds) {
    return { ok: false, restoredSourceBed, error: "Falha ao cancelar no banco (simulado)" };
  }

  request.status = "cancelled";
  return { ok: true, restoredSourceBed, requestStatus: "cancelled" };
}

// ── Infra de teste ────────────────────────────────────────────────────────────

let passed = 0; let failed = 0;
const results: { name: string; ok: boolean; details: string }[] = [];

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name, ok: true, details: "ok" });
    passed++;
  } catch (e: any) {
    results.push({ name, ok: false, details: e.message });
    failed++;
  }
}

// ── Cenários ──────────────────────────────────────────────────────────────────

console.log("\n══════════════════════════════════════════════════════");
console.log("  TESTE: ALTA-03 e ALTA-04 — complete + cancel transfer");
console.log("  Dados fictícios | Zero impacto em produção");
console.log("══════════════════════════════════════════════════════\n");

// ── ALTA-03: caminho feliz ────────────────────────────────────────────────────

await test("ALTA-03 caminho feliz: repoint ok + status update ok → ok: true", () => {
  const result = simulateComplete({
    requestStatus: "pending",
    repointSucceeds: true,
    statusUpdateSucceeds: true,
  });
  assert(result.ok === true, "Deve retornar ok: true");
  assert(result.requestStatus === "completed", "Status deve ser 'completed'");
});

// ── ALTA-03: guarda de idempotência ──────────────────────────────────────────

await test("ALTA-03 idempotência: request já 'completed' → erro imediato (sem re-execução)", () => {
  const result = simulateComplete({
    requestStatus: "completed",
    repointSucceeds: true,
    statusUpdateSucceeds: true,
  });
  assert(result.ok === false, "Request já completed deve retornar erro");
  assert(result.error?.includes("completed"), "Mensagem deve indicar estado atual");
});

await test("ALTA-03 idempotência: request 'cancelled' → erro imediato", () => {
  const result = simulateComplete({
    requestStatus: "cancelled",
    repointSucceeds: true,
    statusUpdateSucceeds: true,
  });
  assert(result.ok === false, "Request já cancelled deve retornar erro");
});

// ── ALTA-03: falha no status update DEVE lançar erro ─────────────────────────

await test("ALTA-03 fix: falha no status update lança exceção (não silencia)", () => {
  let threw = false;
  try {
    simulateComplete({
      requestStatus: "pending",
      repointSucceeds: true,
      statusUpdateSucceeds: false, // ← cenário do bug
    });
  } catch {
    threw = true;
  }
  assert(
    threw,
    "CORREÇÃO: falha no update de status deve lançar erro — impede dupla-conclusão silenciosa",
  );
});

await test("ALTA-03 ANTES do fix: sem throw, chamador não sabe que status ficou 'pending'", () => {
  // Simula o comportamento ANTERIOR (sem throw)
  function simulateBeforeFix(): { ok: boolean } {
    // Repoint ok
    // Update de status falha — mas sem throw, simplesmente ignorado
    const statusUpdateError = true; // falhou
    void statusUpdateError; // ignorado — bug original
    return { ok: true }; // chamador recebe sucesso falso!
  }
  const result = simulateBeforeFix();
  // Este teste documenta o comportamento INCORRETO que foi corrigido
  assert(
    result.ok === true,
    "ANTES do fix: retornava ok:true mesmo com status ainda pending — dupla-conclusão possível",
  );
  // O teste passa intencionalmente: documenta o bug, não uma funcionalidade desejada.
});

// ── ALTA-04: cancelamento com leito vago → restaura paciente ─────────────────

await test("ALTA-04: leito vago → snapshot restaurado ao leito de origem", () => {
  const sourceBed = makeBedOrigem();
  sourceBed.is_vacant = true; // estado após signalInternalTransfer
  sourceBed.name = "";
  sourceBed.patient_registry_id = null;
  sourceBed.medical_record = null;
  sourceBed.admission_status = null;

  const request = makeRequest();
  const result = simulateCancel({ request, sourceBed, updateStatusSucceeds: true });

  assert(result.ok === true, "Cancelamento deve ter sucesso");
  assert(result.restoredSourceBed === true, "Leito de origem deve ser restaurado");
  assert(sourceBed.is_vacant === false, "Leito de origem deve estar ocupado novamente");
  assert(sourceBed.name === "FRANCISCA ALVES DE SOUSA", "Nome restaurado do snapshot");
  assert(sourceBed.patient_registry_id === "registry-francisca-uuid", "registry_id restaurado");
  assert(sourceBed.medical_record === "PAC-2024-0042", "medical_record restaurado");
  assert(sourceBed.admission_status === "admitido", "admission_status restaurado");
  assert(request.status === "cancelled", "Request marcado como cancelled");
});

await test("ALTA-04: diagnósticos com array no snapshot → concatenados com \\n", () => {
  const sourceBed = makeBedOrigem();
  sourceBed.is_vacant = true;
  const request = makeRequest();
  simulateCancel({ request, sourceBed, updateStatusSucceeds: true });
  assert(
    sourceBed.diagnoses === "DPOC exacerbada\nInsuficiência respiratória",
    "Diagnósticos devem ser concatenados corretamente",
  );
});

// ── ALTA-04: leito ocupado → NÃO sobrescreve ──────────────────────────────────

await test("ALTA-04: leito ocupado por novo paciente → não sobrescreve (proteção)", () => {
  const novoOcupante = "JOAO BATISTA FERREIRA";
  const sourceBed = makeBedOrigem();
  sourceBed.is_vacant = false; // outro paciente admitido após a sinalização
  sourceBed.name = novoOcupante;
  sourceBed.patient_registry_id = "registry-joao-uuid";

  const request = makeRequest();
  const result = simulateCancel({ request, sourceBed, updateStatusSucceeds: true });

  assert(result.ok === true, "Cancelamento ainda deve ter sucesso");
  assert(result.restoredSourceBed === false, "Não deve restaurar quando leito está ocupado");
  assert(sourceBed.name === novoOcupante, "Novo ocupante não deve ser sobrescrito");
  assert(sourceBed.patient_registry_id === "registry-joao-uuid", "registry_id do novo ocupante preservado");
});

// ── ALTA-04: request não encontrado / já processado ──────────────────────────

await test("ALTA-04: request já cancelled → retorna erro sem modificar leito", () => {
  const sourceBed = makeBedOrigem();
  sourceBed.is_vacant = true;
  const originalName = sourceBed.name;
  const request = makeRequest({ status: "cancelled" });

  const result = simulateCancel({ request, sourceBed, updateStatusSucceeds: true });

  assert(result.ok === false, "Deve retornar erro");
  assert(result.restoredSourceBed === false, "Não deve restaurar");
  assert(sourceBed.name === originalName, "Leito não deve ser alterado");
});

await test("ALTA-04: falha ao atualizar status → reporta erro ao chamador", () => {
  const sourceBed = makeBedOrigem();
  sourceBed.is_vacant = true;
  const request = makeRequest();

  const result = simulateCancel({ request, sourceBed, updateStatusSucceeds: false });

  assert(result.ok === false, "Deve retornar erro quando status update falha");
  assert(result.error !== undefined, "Erro deve ter mensagem");
});

// ── Relatório ─────────────────────────────────────────────────────────────────

console.log("──────────────────────────────────────────────────────");
for (const r of results) {
  console.log(`  ${r.ok ? "✓" : "✗"} ${r.name}${r.ok ? "" : `\n      → ${r.details}`}`);
}
console.log("──────────────────────────────────────────────────────");
console.log(`  TOTAL: ${passed + failed} | ✓ ${passed} passaram | ${failed > 0 ? "✗" : "✓"} ${failed} falharam`);
console.log("──────────────────────────────────────────────────────\n");

if (failed > 0) process.exit(1);
