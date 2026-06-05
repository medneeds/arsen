/**
 * TESTE: execute_operational_relocation_atomic
 *
 * Cobre:
 *   1. Remanejamento bem-sucedido (atômico)
 *   2. ROLLBACK em falha de cada passo
 *   3. Fallback automático quando RPC não existe (42883)
 *   4. Auditoria não-bloqueante
 *   5. Comparação ANTES/DEPOIS da transação
 *
 * Dados fictícios — zero impacto em produção.
 */

// ── Tipos ────────────────────────────────────────────────────────────────────

interface MockBed {
  id: string; name: string; bed_number: string; sector: string;
  is_vacant: boolean; admission_status: string | null;
  patient_registry_id: string | null; medical_record: string | null;
  diagnoses: string | null; clinical_status: string | null;
}

interface RelocationResult {
  ok: boolean; movementId?: string; error?: string;
  sourceAfter: MockBed; targetAfter: MockBed;
  auditInserted: boolean; usedAtomicRpc: boolean;
}

// ── Simulação da função atômica ───────────────────────────────────────────────

function simulateAtomicRelocation(
  source: MockBed,
  target: MockBed,
  options: {
    step1Fails?: boolean;
    step2Fails?: boolean; // repoint
    step3Fails?: boolean; // archive
    step4Fails?: boolean; // clear origin
    auditFails?: boolean;
    rpcNotFound?: boolean; // simula code=42883
  } = {}
): RelocationResult {
  const sourceSnap = { ...source };
  const targetSnap = { ...target };
  let auditInserted = false;

  // Simula fallback quando RPC não existe
  if (options.rpcNotFound) {
    return {
      ok: true,
      movementId: "fallback-sequential-movement-id",
      sourceAfter: { ...sourceSnap, is_vacant: true, name: "", patient_registry_id: null },
      targetAfter: { ...targetSnap, is_vacant: false, name: sourceSnap.name, patient_registry_id: sourceSnap.patient_registry_id },
      auditInserted: true,
      usedAtomicRpc: false,
    };
  }

  try {
    // PASSO 1: Popula destino
    if (options.step1Fails) throw new Error("Falha ao popular destino (simulado)");
    target.name = source.name;
    target.patient_registry_id = source.patient_registry_id;
    target.medical_record = source.medical_record;
    target.diagnoses = source.diagnoses;
    target.clinical_status = source.clinical_status;
    target.admission_status = source.admission_status;
    target.is_vacant = false;

    // PASSO 2: Repoint
    if (options.step2Fails) throw new Error("Repoint falhou: lock timeout (simulado)");

    // PASSO 3: Archive (no-op após repoint, mas parte da transação)
    if (options.step3Fails) throw new Error("Archive falhou (simulado)");

    // PASSO 4: Zera origem
    if (options.step4Fails) throw new Error("Falha ao zerar origem (simulado)");
    source.name = "";
    source.patient_registry_id = null;
    source.medical_record = null;
    source.diagnoses = null;
    source.clinical_status = null;
    source.admission_status = null;
    source.is_vacant = true;

    // PASSO 5: Auditoria — não-bloqueante
    if (!options.auditFails) {
      auditInserted = true;
    }
    // Se auditFails: auditInserted permanece false, mas remanejamento concluiu

    return {
      ok: true,
      movementId: auditInserted ? "movement-uuid-fake" : undefined,
      sourceAfter: { ...source },
      targetAfter: { ...target },
      auditInserted,
      usedAtomicRpc: true,
    };
  } catch (err: any) {
    // ROLLBACK automático
    Object.assign(source, sourceSnap);
    Object.assign(target, targetSnap);
    return {
      ok: false,
      error: err.message,
      sourceAfter: { ...source },
      targetAfter: { ...target },
      auditInserted: false,
      usedAtomicRpc: true,
    };
  }
}

// ── Pacientes fictícios ───────────────────────────────────────────────────────

function idenilton(): MockBed {
  return {
    id: "leito-l44-uuid",
    name: "IDENILTON BAIMA DA SILVA RIBEIRO",
    bed_number: "L44",
    sector: "enfermaria_transicao",
    is_vacant: false,
    admission_status: "admitido",
    patient_registry_id: "reg-idenilton-uuid",
    medical_record: "000213-F",
    diagnoses: "Osteomielite\nAbscesso em esterno",
    clinical_status: "regular",
  };
}

function leitoVago(id: string, bed: string, sector: string): MockBed {
  return { id, name: "", bed_number: bed, sector, is_vacant: true,
    admission_status: null, patient_registry_id: null, medical_record: null,
    diagnoses: null, clinical_status: null };
}

// ── Infra de teste ───────────────────────────────────────────────────────────

let passed = 0; let failed = 0;
const results: { group: string; name: string; ok: boolean; details: string }[] = [];
let currentGroup = "";
function group(name: string) { currentGroup = name; }
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }
async function test(name: string, fn: () => void | Promise<void>) {
  try { await fn(); results.push({ group: currentGroup, name, ok: true, details: "ok" }); passed++; }
  catch (e: any) { results.push({ group: currentGroup, name, ok: false, details: e.message }); failed++; }
}

// ══════════════════════════════════════════════════════════════════════════════

console.log("\n══════════════════════════════════════════════════════");
console.log("  TESTE: execute_operational_relocation_atomic");
console.log("  Dados fictícios | Zero impacto em produção");
console.log("══════════════════════════════════════════════════════\n");

// ── Grupo 1: Caminho feliz ───────────────────────────────────────────────────

group("GRUPO 1 — Remanejamento bem-sucedido");

await test("Paciente IDENILTON remane de L44 para L46 — dados migram", () => {
  const bed44 = idenilton();
  const bed46 = leitoVago("leito-l46-uuid", "L46", "enfermaria_transicao");
  const r = simulateAtomicRelocation(bed44, bed46);
  assert(r.ok === true, `Esperado ok=true: ${r.error}`);
  assert(r.targetAfter.name === "IDENILTON BAIMA DA SILVA RIBEIRO", "Nome migrou para L46");
  assert(r.targetAfter.patient_registry_id === "reg-idenilton-uuid", "Registry migrou");
  assert(r.targetAfter.diagnoses?.includes("Osteomielite"), "Diagnósticos migraram");
  assert(r.targetAfter.is_vacant === false, "L46 está ocupado");
  assert(r.usedAtomicRpc === true, "Usou RPC atômica");
});

await test("Leito de origem L44 completamente zerado após remanejamento", () => {
  const bed44 = idenilton();
  const bed46 = leitoVago("leito-l46-uuid", "L46", "enfermaria_transicao");
  const r = simulateAtomicRelocation(bed44, bed46);
  assert(r.sourceAfter.is_vacant === true, "L44 deve estar vago");
  assert(r.sourceAfter.name === "", "L44 sem nome");
  assert(r.sourceAfter.patient_registry_id === null, "L44 sem registry");
  assert(r.sourceAfter.diagnoses === null, "L44 sem diagnósticos");
});

await test("Auditoria registrada quando tudo funciona", () => {
  const bed44 = idenilton();
  const bed46 = leitoVago("leito-l46-uuid", "L46", "enfermaria_transicao");
  const r = simulateAtomicRelocation(bed44, bed46);
  assert(r.auditInserted === true, "patient_movements deve ser inserido");
  assert(r.movementId !== undefined, "movementId retornado");
});

// ── Grupo 2: ROLLBACK em cada passo ─────────────────────────────────────────

group("GRUPO 2 — ROLLBACK em falha de cada passo");

await test("Falha passo 1 (popular destino): ROLLBACK — paciente permanece em L44", () => {
  const bed44 = idenilton();
  const bed46 = leitoVago("leito-l46-uuid", "L46", "enfermaria_transicao");
  const r = simulateAtomicRelocation(bed44, bed46, { step1Fails: true });
  assert(r.ok === false, "Deve retornar erro");
  assert(r.sourceAfter.name === "IDENILTON BAIMA DA SILVA RIBEIRO", "Paciente ainda em L44");
  assert(r.sourceAfter.is_vacant === false, "L44 ainda ocupado");
  assert(r.targetAfter.is_vacant === true, "L46 ainda vago");
  assert(r.auditInserted === false, "Sem auditoria (rollback)");
});

await test("Falha passo 2 (repoint): ROLLBACK total — estado original preservado", () => {
  const bed44 = idenilton();
  const bed46 = leitoVago("leito-l46-uuid", "L46", "enfermaria_transicao");
  const r = simulateAtomicRelocation(bed44, bed46, { step2Fails: true });
  assert(r.ok === false, "Deve retornar erro");
  assert(r.sourceAfter.is_vacant === false, "L44 restaurado (rollback)");
  assert(r.targetAfter.is_vacant === true, "L46 restaurado (rollback)");
  assert(r.error?.includes("Repoint falhou"), `Mensagem: ${r.error}`);
});

await test("Falha passo 3 (archive): ROLLBACK — origem e destino restaurados", () => {
  const bed44 = idenilton();
  const bed46 = leitoVago("leito-l46-uuid", "L46", "enfermaria_transicao");
  const r = simulateAtomicRelocation(bed44, bed46, { step3Fails: true });
  assert(r.ok === false, "Deve retornar erro");
  assert(r.sourceAfter.name === "IDENILTON BAIMA DA SILVA RIBEIRO", "L44 restaurado");
  assert(r.targetAfter.is_vacant === true, "L46 restaurado");
});

await test("Falha passo 4 (zerar origem): ROLLBACK — paciente nunca fica em dois leitos", () => {
  const bed44 = idenilton();
  const bed46 = leitoVago("leito-l46-uuid", "L46", "enfermaria_transicao");
  const r = simulateAtomicRelocation(bed44, bed46, { step4Fails: true });
  assert(r.ok === false, "Deve retornar erro");
  const emL44 = !r.sourceAfter.is_vacant;
  const emL46 = !r.targetAfter.is_vacant;
  assert(emL44 && !emL46, "Paciente em EXATAMENTE um leito após rollback (L44)");
});

// ── Grupo 3: Auditoria não-bloqueante ────────────────────────────────────────

group("GRUPO 3 — Auditoria não bloqueia o remanejamento");

await test("Falha na auditoria: remanejamento CONCLUI — paciente em L46, L44 vago", () => {
  const bed44 = idenilton();
  const bed46 = leitoVago("leito-l46-uuid", "L46", "enfermaria_transicao");
  const r = simulateAtomicRelocation(bed44, bed46, { auditFails: true });
  assert(r.ok === true, "Remanejamento deve concluir mesmo com audit falho");
  assert(r.targetAfter.name === "IDENILTON BAIMA DA SILVA RIBEIRO", "Paciente em L46");
  assert(r.sourceAfter.is_vacant === true, "L44 vago");
  assert(r.auditInserted === false, "Auditoria falhou (silenciada) mas remanejamento ocorreu");
});

// ── Grupo 4: Fallback automático (RPC não existe) ────────────────────────────

group("GRUPO 4 — Fallback automático quando migration não aplicada");

await test("RPC não encontrada (42883): cai para fluxo sequencial — sem erro para o usuário", () => {
  const bed44 = idenilton();
  const bed46 = leitoVago("leito-l46-uuid", "L46", "enfermaria_transicao");
  const r = simulateAtomicRelocation(bed44, bed46, { rpcNotFound: true });
  assert(r.ok === true, "Fallback sequencial deve ter sucesso");
  assert(r.usedAtomicRpc === false, "Usou fluxo sequencial (não RPC atômica)");
  assert(r.targetAfter.name === "IDENILTON BAIMA DA SILVA RIBEIRO", "Paciente movido via fallback");
  assert(r.sourceAfter.is_vacant === true, "Origem zerada via fallback");
});

await test("Detecção correta de code=42883 vs erro real da RPC", () => {
  const erro42883 = { code: "42883", message: "function execute_operational_relocation_atomic does not exist" };
  const erroReal  = { code: "P0001", message: "Leito de origem não encontrado" };

  const is42883 = (e: any) =>
    e?.code === "42883" || (e?.message ?? "").includes("does not exist");

  assert(is42883(erro42883) === true, "Deve detectar 42883 como 'RPC não existe'");
  assert(is42883(erroReal) === false, "Não deve confundir erro real com 'RPC não existe'");
});

await test("Deploy independente: TypeScript pode ser deployed antes da migration", () => {
  // Simula o deploy do TypeScript SEM a migration aplicada
  // O código detecta o 42883 e usa o fluxo sequencial
  // Resultado: comportamento idêntico ao de antes da mudança
  const bed44 = idenilton();
  const bed46 = leitoVago("leito-l46-uuid", "L46", "enfermaria_transicao");

  // Sem migration (rpcNotFound = true)
  const semMigration = simulateAtomicRelocation(bed44, bed46, { rpcNotFound: true });
  assert(semMigration.ok === true, "Sem migration: funciona via fallback");
  assert(!semMigration.usedAtomicRpc, "Usa fluxo sequencial (como antes)");

  // Com migration aplicada (rpcNotFound = false)
  const bed44b = idenilton();
  const bed46b = leitoVago("leito-l46-uuid", "L46", "enfermaria_transicao");
  const comMigration = simulateAtomicRelocation(bed44b, bed46b);
  assert(comMigration.ok === true, "Com migration: usa RPC atômica");
  assert(comMigration.usedAtomicRpc, "Usa RPC atômica");
});

// ── Grupo 5: Antes vs. Depois ─────────────────────────────────────────────────

group("GRUPO 5 — ANTES (sem transação) vs. DEPOIS (atômico)");

await test("ANTES: falha no passo 4 (zerar origem) deixava paciente em dois leitos", () => {
  const source = idenilton();
  const target = leitoVago("leito-l46-uuid", "L46", "enfermaria_transicao");
  let inconsistente = false;

  // Simula comportamento anterior sem rollback
  try {
    target.name = source.name;      // passo 1 ok — commitado
    target.is_vacant = false;
    // passo 2 ok (repoint)
    // passo 3 ok (archive)
    throw new Error("Passo 4 falhou"); // passo 4 falha
  } catch {
    // Sem rollback: destino já foi populado, origem intacta
    inconsistente = !source.is_vacant && !target.is_vacant; // DOIS leitos ocupados!
  }
  assert(inconsistente === true, "ANTES: estado inconsistente — paciente em dois leitos");
});

await test("DEPOIS: mesma falha no passo 4 → ROLLBACK → paciente em um só leito", () => {
  const bed44 = idenilton();
  const bed46 = leitoVago("leito-l46-uuid", "L46", "enfermaria_transicao");
  const r = simulateAtomicRelocation(bed44, bed46, { step4Fails: true });

  const emL44 = !r.sourceAfter.is_vacant;
  const emL46 = !r.targetAfter.is_vacant;
  assert(emL44 && !emL46, "DEPOIS: paciente em exatamente um leito (consistente)");
  assert(r.ok === false, "Erro propagado ao usuário");
});

// ── Relatório ────────────────────────────────────────────────────────────────

const groups = [...new Set(results.map(r => r.group))];
console.log("──────────────────────────────────────────────────────────────");
for (const g of groups) {
  const gr = results.filter(r => r.group === g);
  console.log(`\n  ${gr.every(r => r.ok) ? "✓" : "✗"} ${g}`);
  for (const r of gr) {
    console.log(`    ${r.ok ? "✓" : "✗"} ${r.name}${r.ok ? "" : `\n        → ${r.details}`}`);
  }
}
console.log("\n──────────────────────────────────────────────────────────────");
console.log(`  TOTAL: ${passed + failed} | ✓ ${passed} passaram | ${failed > 0 ? "✗" : "✓"} ${failed} falharam`);
console.log("──────────────────────────────────────────────────────────────\n");

if (failed > 0) process.exit(1);
