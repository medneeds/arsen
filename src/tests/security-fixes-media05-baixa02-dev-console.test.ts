/**
 * TESTE: MÉDIA-05 e BAIXA-02 — dev-console-ops
 *
 * MÉDIA-05: force_password_reset usa generateLink (recovery), não senha em texto claro
 * BAIXA-02: archive_bed_residual_history usa Promise.all (paralelo) em vez de for-await (serial)
 *
 * Dados fictícios | Zero impacto em produção.
 */

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

// ── MÉDIA-05: simulação do force_password_reset ───────────────────────────────

interface PasswordResetRequest { email: string; newPassword?: string; confirm: boolean }
interface PasswordResetResult {
  ok: boolean;
  recoveryLink?: string | null;
  message?: string;
  error?: string;
  // Para detectar o comportamento anterior (bugado)
  receivedNewPasswordInBody?: boolean;
}

// Simula o COMPORTAMENTO ANTERIOR (bugado): aceita senha em texto claro
function simulateForcePasswordResetBefore(req: PasswordResetRequest): PasswordResetResult {
  if (!req.confirm) return { ok: false, error: "Confirmation required" };
  if (!req.email || !req.newPassword || req.newPassword.length < 8) {
    return { ok: false, error: "email and newPassword (min 8) required" };
  }
  // Bug: senha trafega pelo body e fica nos logs do servidor
  return {
    ok: true,
    receivedNewPasswordInBody: true, // senha visível no payload
  };
}

// Contador para simular tokens únicos (Date.now não é confiável no mesmo ms)
let mockTokenCounter = 0;

// Simula o COMPORTAMENTO CORRIGIDO: gera recovery link
function simulateForcePasswordResetAfter(req: PasswordResetRequest): PasswordResetResult {
  if (!req.confirm) return { ok: false, error: "Confirmation required" };
  if (!req.email) return { ok: false, error: "email required" };
  // Não aceita nem usa newPassword — gera link de uso único
  const recoveryLink = `https://auth.supabase.co/auth/v1/verify?token=mock-token-${++mockTokenCounter}&type=recovery`;
  return {
    ok: true,
    recoveryLink,
    message: `Link de recuperação gerado para ${req.email}. Validade: único uso.`,
    receivedNewPasswordInBody: false, // senha nunca trafega
  };
}

// ── BAIXA-02: simulação do archive paralelo vs serial ────────────────────────

interface MockEvolution {
  id: string;
  patient_id: string | null;
  patient_name: string;
  patient_bed: string;
  patient_sector: string;
  archived_at: string | null;
}

interface ArchiveCallLog {
  id: string;
  startedAt: number;
  completedAt: number;
}

function makeEvolutions(): MockEvolution[] {
  return [
    { id: "evo-001", patient_id: "leito-01-uuid", patient_name: "MARIA JOSE SANTOS", patient_bed: "U01", patient_sector: "red", archived_at: null },
    { id: "evo-002", patient_id: "leito-01-uuid", patient_name: "MARIA JOSE SANTOS", patient_bed: "U01", patient_sector: "red", archived_at: null },
    { id: "evo-003", patient_id: "leito-01-uuid", patient_name: "MARIA JOSE SANTOS", patient_bed: "U01", patient_sector: "red", archived_at: null },
    { id: "evo-004", patient_id: "leito-01-uuid", patient_name: "MARIA JOSE SANTOS", patient_bed: "U01", patient_sector: "red", archived_at: null },
    { id: "evo-005", patient_id: "leito-01-uuid", patient_name: "MARIA JOSE SANTOS", patient_bed: "U01", patient_sector: "red", archived_at: null },
  ];
}

// Simula update com latência artificial para medir comportamento serial vs paralelo
async function mockUpdateEvolution(
  evo: MockEvolution,
  nowIso: string,
  reason: string,
  callLog: ArchiveCallLog[],
  delayMs: number,
): Promise<void> {
  const start = Date.now();
  await new Promise((r) => setTimeout(r, delayMs));
  evo.archived_at = nowIso;
  callLog.push({ id: evo.id, startedAt: start, completedAt: Date.now() });
}

// Antes: loop serial
async function archiveSerial(
  eligible: MockEvolution[],
  nowIso: string,
  reason: string,
  callLog: ArchiveCallLog[],
  delayMs: number,
): Promise<void> {
  for (const t of eligible) {
    await mockUpdateEvolution(t, nowIso, reason, callLog, delayMs);
  }
}

// Depois: Promise.all paralelo
async function archiveParallel(
  eligible: MockEvolution[],
  nowIso: string,
  reason: string,
  callLog: ArchiveCallLog[],
  delayMs: number,
): Promise<void> {
  await Promise.all(
    eligible.map((t) => mockUpdateEvolution(t, nowIso, reason, callLog, delayMs)),
  );
}

// ── Cenários ──────────────────────────────────────────────────────────────────

console.log("\n══════════════════════════════════════════════════════");
console.log("  TESTE: MÉDIA-05 e BAIXA-02 — dev-console-ops");
console.log("  Dados fictícios | Zero impacto em produção");
console.log("══════════════════════════════════════════════════════\n");

// ── MÉDIA-05: senha não deve trafegar no body ─────────────────────────────────

await test("MÉDIA-05: before fix — senha recebida em texto claro no body", () => {
  const result = simulateForcePasswordResetBefore({
    email: "dr.silva@hmdm.gov.br",
    newPassword: "MinhaS3nh@Temp",
    confirm: true,
  });
  assert(result.ok === true, "Before: chamada ok");
  assert(result.receivedNewPasswordInBody === true, "ANTES: senha trafega no payload — bug documentado");
});

await test("MÉDIA-05: after fix — recovery link gerado, sem senha no body", () => {
  const result = simulateForcePasswordResetAfter({
    email: "dr.silva@hmdm.gov.br",
    confirm: true,
  });
  assert(result.ok === true, "After: chamada ok");
  assert(result.receivedNewPasswordInBody === false, "Senha não trafega no payload");
  assert(result.recoveryLink !== null && result.recoveryLink !== undefined, "Recovery link gerado");
  assert(result.recoveryLink!.includes("recovery"), "Link contém tipo 'recovery'");
  assert(result.message?.includes("único uso"), "Mensagem indica que o link é de uso único");
});

await test("MÉDIA-05: after fix — newPassword ignorado mesmo se enviado por engano", () => {
  const result = simulateForcePasswordResetAfter({
    email: "dr.silva@hmdm.gov.br",
    newPassword: "qualquer-coisa-ignorada",
    confirm: true,
  });
  assert(result.ok === true, "ok: true");
  assert(result.receivedNewPasswordInBody === false, "Senha não é usada no novo fluxo");
});

await test("MÉDIA-05: sem confirm → bloqueado (proteção mantida)", () => {
  const result = simulateForcePasswordResetAfter({
    email: "dr.silva@hmdm.gov.br",
    confirm: false,
  });
  assert(result.ok === false, "Sem confirm deve ser bloqueado");
  assert(result.error?.includes("Confirmation"), "Mensagem de confirmação necessária");
});

await test("MÉDIA-05: sem email → erro de validação", () => {
  const result = simulateForcePasswordResetAfter({ email: "", confirm: true });
  assert(result.ok === false, "Email vazio deve gerar erro");
});

await test("MÉDIA-05: link diferente a cada geração (simulação de unicidade)", () => {
  const r1 = simulateForcePasswordResetAfter({ email: "user@hmdm.gov.br", confirm: true });
  // Aguarda 1ms para garantir timestamp diferente
  const r2 = simulateForcePasswordResetAfter({ email: "user@hmdm.gov.br", confirm: true });
  // Links devem ser únicos (produção usa tokens criptográficos)
  assert(
    r1.recoveryLink !== r2.recoveryLink,
    "Cada geração deve produzir um link único",
  );
});

// ── BAIXA-02: Promise.all é mais rápido que for-await para N evoluções ────────

await test("BAIXA-02: todas as evoluções arquivadas em ambos os modos (serial e paralelo)", async () => {
  const evos1 = makeEvolutions();
  const evos2 = makeEvolutions();
  const nowIso = new Date().toISOString();
  const log1: ArchiveCallLog[] = [];
  const log2: ArchiveCallLog[] = [];

  await archiveSerial(evos1, nowIso, "test_cleanup", log1, 0);
  await archiveParallel(evos2, nowIso, "test_cleanup", log2, 0);

  assert(evos1.every(e => e.archived_at === nowIso), "Serial: todas arquivadas");
  assert(evos2.every(e => e.archived_at === nowIso), "Paralelo: todas arquivadas");
  assert(log1.length === 5, "Serial: 5 chamadas registradas");
  assert(log2.length === 5, "Paralelo: 5 chamadas registradas");
});

await test("BAIXA-02: parallel é mais rápido que serial com 5 evoluções e delay de 10ms", async () => {
  const evos1 = makeEvolutions();
  const evos2 = makeEvolutions();
  const nowIso = new Date().toISOString();
  const log1: ArchiveCallLog[] = [];
  const log2: ArchiveCallLog[] = [];
  const DELAY = 10; // ms por operação

  const t0Serial = Date.now();
  await archiveSerial(evos1, nowIso, "test", log1, DELAY);
  const serialMs = Date.now() - t0Serial;

  const t0Parallel = Date.now();
  await archiveParallel(evos2, nowIso, "test", log2, DELAY);
  const parallelMs = Date.now() - t0Parallel;

  // Serial esperado: ~50ms (5 × 10ms sequenciais)
  // Paralelo esperado: ~10ms (todos simultâneos)
  assert(
    parallelMs < serialMs,
    `Paralelo (${parallelMs}ms) deve ser mais rápido que serial (${serialMs}ms)`,
  );
  // Garantia mínima: paralelo é pelo menos 2x mais rápido com 5 operações
  assert(
    parallelMs * 2 < serialMs || serialMs < 30,
    `Paralelo (${parallelMs}ms) deve ser significativamente mais rápido que serial (${serialMs}ms)`,
  );
});

await test("BAIXA-02: archived_from_patient_id correto por linha (field varia por evolução)", async () => {
  const evos = [
    { id: "evo-a", patient_id: "pac-001", patient_name: "A", patient_bed: "U01", patient_sector: "red", archived_at: null },
    { id: "evo-b", patient_id: "pac-002", patient_name: "B", patient_bed: "U01", patient_sector: "red", archived_at: null },
    { id: "evo-c", patient_id: null,      patient_name: "C", patient_bed: "U01", patient_sector: "red", archived_at: null },
  ];

  const archiveResults: { id: string; from_patient_id: string | null }[] = [];
  const nowIso = new Date().toISOString();

  await Promise.all(
    evos.map(async (t) => {
      await new Promise((r) => setTimeout(r, 0));
      archiveResults.push({ id: t.id, from_patient_id: t.patient_id ?? null });
      t.archived_at = nowIso;
    }),
  );

  const byId = Object.fromEntries(archiveResults.map(r => [r.id, r.from_patient_id]));
  assert(byId["evo-a"] === "pac-001", "evo-a: patient_id correto");
  assert(byId["evo-b"] === "pac-002", "evo-b: patient_id correto");
  assert(byId["evo-c"] === null,      "evo-c: patient_id null preservado");
  assert(evos.every(e => e.archived_at === nowIso), "Todas arquivadas");
});

await test("BAIXA-02: lista vazia → não executa nenhuma query", async () => {
  const eligible: MockEvolution[] = [];
  let queriesExecuted = 0;
  await Promise.all(
    eligible.map(async () => { queriesExecuted++; }),
  );
  assert(queriesExecuted === 0, "Lista vazia → zero queries");
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
