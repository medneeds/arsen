/**
 * TESTE: BAIXA-01 — repointPatientHistory: verificação pós-migração
 *
 * Valida que:
 *  1. Sucesso completo (RPC ok + verificações ok) → ok: true, sem warning
 *  2. Falha na verificação 1 (query indisponível) → ok: true + verificationWarning
 *  3. Falha na verificação 2 (query indisponível) → ok: true + verificationWarning
 *  4. Ambas falham → ok: true + verificationWarning concatenado
 *  5. Evoluções ainda na origem (count > 0) → ok: false (blocante)
 *  6. Evoluções sem vínculo (nullCount > 0)  → ok: false (blocante)
 *
 * Dados fictícios | Zero impacto em produção.
 */

// ── Replica a lógica do repointPatientHistory ─────────────────────────────────

interface RepointResult {
  ok: boolean;
  counts?: Record<string, number>;
  error?: string;
  verificationWarning?: string;
}

interface MockCheckConfig {
  rpcSucceeds: boolean;
  rpcCounts?: Record<string, number>;
  // Verificação 1
  v1QueryFails?: boolean;
  v1Count?: number;
  // Verificação 2
  registryId?: string | null;
  v2QueryFails?: boolean;
  v2NullCount?: number;
}

async function simulateRepoint(
  sourceId: string,
  targetId: string,
  config: MockCheckConfig,
): Promise<RepointResult> {
  if (!sourceId || !targetId) return { ok: false, error: "source/target ausente" };
  if (sourceId === targetId) return { ok: true, counts: {} };

  // RPC
  if (!config.rpcSucceeds) throw new Error("RPC repoint_patient_history falhou");

  let verificationWarning: string | undefined;

  // Verificação 1: evoluções com patient_id explícito ainda na origem
  if (config.v1QueryFails) {
    const msg = `verificação 1 indisponível: network timeout simulado`;
    console.warn("[repointPatientHistory]", msg);
    verificationWarning = msg;
  } else if ((config.v1Count ?? 0) > 0) {
    const count = config.v1Count!;
    return {
      ok: false,
      error: `Histórico clínico não migrado completamente: ${count} evolução(ões) ainda no leito de origem. Tente a transferência novamente.`,
    };
  }

  // Verificação 2: evoluções com patient_id = null mas registry correto
  if (config.registryId) {
    if (config.v2QueryFails) {
      const msg2 = `verificação 2 indisponível: network timeout simulado`;
      console.warn("[repointPatientHistory]", msg2);
      verificationWarning = verificationWarning
        ? `${verificationWarning}; ${msg2}`
        : msg2;
    } else if ((config.v2NullCount ?? 0) > 0) {
      const nullCount = config.v2NullCount!;
      return {
        ok: false,
        error: `Histórico clínico não migrado completamente: ${nullCount} registro(s) sem vínculo de leito. Tente a transferência novamente.`,
      };
    }
  }

  return {
    ok: true,
    counts: config.rpcCounts ?? {},
    ...(verificationWarning ? { verificationWarning } : {}),
  };
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

const SOURCE = "leito-c04-uuid";
const TARGET = "leito-d02-uuid";
const REGISTRY = "registry-paciente-uuid";

// ── Cenários ──────────────────────────────────────────────────────────────────

console.log("\n══════════════════════════════════════════════════════");
console.log("  TESTE: BAIXA-01 — repointPatientHistory verificações");
console.log("  Dados fictícios | Zero impacto em produção");
console.log("══════════════════════════════════════════════════════\n");

// ── Caminho feliz ─────────────────────────────────────────────────────────────

await test("Sucesso total: ok: true, sem verificationWarning", async () => {
  const result = await simulateRepoint(SOURCE, TARGET, {
    rpcSucceeds: true,
    rpcCounts: { clinical_evolutions: 12, prescriptions: 3 },
    v1Count: 0,
    registryId: REGISTRY,
    v2NullCount: 0,
  });
  assert(result.ok === true, "Deve retornar ok: true");
  assert(result.verificationWarning === undefined, "Não deve ter warning quando tudo ok");
  assert(result.counts?.clinical_evolutions === 12, "Counts corretos do RPC");
});

await test("Source = target: retorna ok: true imediatamente sem executar RPC", async () => {
  const result = await simulateRepoint("mesmo-id", "mesmo-id", { rpcSucceeds: true });
  assert(result.ok === true, "Source = target → ok sem executar nada");
  assert(Object.keys(result.counts ?? {}).length === 0, "Counts vazio");
});

// ── Verificação 1 falha: não bloqueia, mas avisa ──────────────────────────────

await test("V1 query indisponível → ok: true + verificationWarning preenchido", async () => {
  const result = await simulateRepoint(SOURCE, TARGET, {
    rpcSucceeds: true,
    v1QueryFails: true,
    registryId: REGISTRY,
    v2NullCount: 0,
  });
  assert(result.ok === true, "Indisponibilidade da verificação não deve bloquear");
  assert(result.verificationWarning !== undefined, "verificationWarning deve ser preenchido");
  assert(result.verificationWarning!.includes("verificação 1"), "Warning menciona verificação 1");
});

await test("V1 indisponível: warning não é um erro — transferência segue em frente", async () => {
  const result = await simulateRepoint(SOURCE, TARGET, {
    rpcSucceeds: true,
    v1QueryFails: true,
    registryId: null, // sem registry → pula verificação 2
  });
  assert(result.ok === true, "ok mesmo com warning");
  assert(result.error === undefined, "Não deve ter error quando só a verificação falhou");
});

// ── Verificação 2 falha: não bloqueia, mas avisa ──────────────────────────────

await test("V2 query indisponível → ok: true + verificationWarning preenchido", async () => {
  const result = await simulateRepoint(SOURCE, TARGET, {
    rpcSucceeds: true,
    v1Count: 0,
    registryId: REGISTRY,
    v2QueryFails: true,
  });
  assert(result.ok === true, "Indisponibilidade da verificação 2 não bloqueia");
  assert(result.verificationWarning !== undefined, "verificationWarning deve ser preenchido");
  assert(result.verificationWarning!.includes("verificação 2"), "Warning menciona verificação 2");
});

// ── Ambas as verificações falham: warning concatenado ────────────────────────

await test("V1 + V2 indisponíveis → warning concatenado com '; '", async () => {
  const result = await simulateRepoint(SOURCE, TARGET, {
    rpcSucceeds: true,
    v1QueryFails: true,
    registryId: REGISTRY,
    v2QueryFails: true,
  });
  assert(result.ok === true, "ok mesmo com ambas indisponíveis");
  assert(result.verificationWarning!.includes("verificação 1"), "Warning menciona v1");
  assert(result.verificationWarning!.includes("verificação 2"), "Warning menciona v2");
  assert(result.verificationWarning!.includes(";"), "Warnings concatenados com '; '");
});

// ── Verificações blocantes (comportamento existente mantido) ──────────────────

await test("V1: evoluções ainda na origem (count > 0) → ok: false (blocante)", async () => {
  const result = await simulateRepoint(SOURCE, TARGET, {
    rpcSucceeds: true,
    v1Count: 3, // 3 evoluções ainda no leito de origem
    registryId: REGISTRY,
  });
  assert(result.ok === false, "Deve bloquear quando evoluções ainda estão na origem");
  assert(result.error?.includes("3 evolução(ões)"), "Erro menciona quantidade");
  assert(result.error?.includes("leito de origem"), "Erro identifica o problema");
});

await test("V2: evoluções sem vínculo (nullCount > 0) → ok: false (blocante)", async () => {
  const result = await simulateRepoint(SOURCE, TARGET, {
    rpcSucceeds: true,
    v1Count: 0,
    registryId: REGISTRY,
    v2NullCount: 2,
  });
  assert(result.ok === false, "Deve bloquear quando evoluções sem vínculo existem");
  assert(result.error?.includes("2 registro(s)"), "Erro menciona quantidade");
  assert(result.error?.includes("sem vínculo"), "Erro identifica o problema");
});

await test("V1 blocante tem prioridade — não chega à V2", async () => {
  const result = await simulateRepoint(SOURCE, TARGET, {
    rpcSucceeds: true,
    v1Count: 5, // falha blocante na V1
    registryId: REGISTRY,
    v2NullCount: 3, // jamais deveria ser verificado
  });
  assert(result.ok === false, "ok: false pela V1");
  assert(result.error?.includes("leito de origem"), "Erro da V1 — não da V2");
});

// ── Impacto no chamador: completeInternalTransfer usa verificationWarning ─────

await test("Chamador pode detectar verificação incerta via verificationWarning", async () => {
  const result = await simulateRepoint(SOURCE, TARGET, {
    rpcSucceeds: true,
    v1QueryFails: true,
    registryId: null,
  });

  // Comportamento esperado do chamador:
  if (result.verificationWarning) {
    // Registra nos logs de auditoria ou exibe toast de atenção
    console.warn("[completeInternalTransfer] repoint concluído mas verificação incerta:", result.verificationWarning);
  }

  assert(result.ok === true, "Transferência não foi bloqueada");
  assert(result.verificationWarning !== undefined, "Chamador recebeu o aviso");
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
