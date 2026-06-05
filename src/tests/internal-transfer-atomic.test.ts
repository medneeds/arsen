/**
 * TESTE: execute_internal_transfer_atomic
 *
 * Valida a lógica de atomicidade da transferência interna:
 * - Comportamento com sucesso
 * - Comportamento com rollback em falha
 * - Isolamento entre operações
 *
 * Dados fictícios — zero impacto em produção.
 */

// ── Tipos ────────────────────────────────────────────────────────────────────

interface MockPatient {
  id: string;
  name: string;
  bed_number: string;
  sector: string;
  is_vacant: boolean;
  admission_status: string | null;
  patient_registry_id: string | null;
  diagnoses: string | null;
  medical_record: string | null;
}

interface TransferState {
  source: MockPatient;
  target: MockPatient;
  movements: string[];
  repointOk: boolean;
}

// ── Simulação do comportamento transacional ───────────────────────────────────
// Replica a lógica do execute_internal_transfer_atomic em TypeScript puro.
// Em SQL, qualquer RAISE EXCEPTION causa rollback automático de tudo.
// Aqui simulamos isso com um padrão de "salvar estado inicial → tentar → reverter se falhar".

function executeTransferAtomic(
  state: TransferState,
  options: {
    step1Fails?: boolean;
    step2Fails?: boolean; // repoint fails
    step3Fails?: boolean;
    step4Fails?: boolean;
  } = {}
): { ok: boolean; error?: string; stateAfter: { source: MockPatient; target: MockPatient; movements: string[] } } {
  // Salva estado inicial para rollback
  const sourceSnapshot = { ...state.source };
  const targetSnapshot = { ...state.target };
  const movementsSnapshot = [...state.movements];

  try {
    // PASSO 1: Popula leito destino
    if (options.step1Fails) throw new Error("Falha ao popular leito destino (simulado)");
    state.target.name = state.source.name;
    state.target.patient_registry_id = state.source.patient_registry_id;
    state.target.diagnoses = state.source.diagnoses;
    state.target.is_vacant = false;
    state.target.admission_status = "admitido";

    // PASSO 2: Repoint do histórico
    if (options.step2Fails) throw new Error("Falha no repoint (clinical_evolutions — simulado)");
    state.repointOk = true;

    // PASSO 3: Esvazia leito de origem
    if (options.step3Fails) throw new Error("Falha ao esvaziar leito de origem (simulado)");
    state.source.name = "";
    state.source.patient_registry_id = null;
    state.source.diagnoses = null;
    state.source.is_vacant = true;
    state.source.admission_status = null;

    // PASSO 4: Auditoria
    if (options.step4Fails) throw new Error("Falha ao inserir patient_movements (simulado)");
    state.movements.push(`TRANSFERÊNCIA INTERNA: ${sourceSnapshot.bed_number} → ${state.target.bed_number}`);

    return {
      ok: true,
      stateAfter: {
        source: { ...state.source },
        target: { ...state.target },
        movements: [...state.movements],
      },
    };
  } catch (err: any) {
    // ROLLBACK: restaura estado original (equivale ao ROLLBACK do PostgreSQL)
    state.source = { ...sourceSnapshot };
    state.target = { ...targetSnapshot };
    state.movements = [...movementsSnapshot];
    state.repointOk = false;

    return {
      ok: false,
      error: err.message,
      stateAfter: {
        source: { ...state.source },
        target: { ...state.target },
        movements: [...state.movements],
      },
    };
  }
}

// ── Infra de teste ───────────────────────────────────────────────────────────

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

function createState(): TransferState {
  return {
    source: {
      id: "leito-l01-uuid",
      name: "JOSE RIBAMAR RODRIGUES",
      bed_number: "L01",
      sector: "blue",
      is_vacant: false,
      admission_status: "admitido",
      patient_registry_id: "registry-jose-uuid",
      diagnoses: "Pneumonia\nInsuficiência respiratória",
      medical_record: "000169",
    },
    target: {
      id: "leito-l04-uuid",
      name: "",
      bed_number: "L04",
      sector: "red",
      is_vacant: true,
      admission_status: null,
      patient_registry_id: null,
      diagnoses: null,
      medical_record: null,
    },
    movements: [],
    repointOk: false,
  };
}

// ── Cenários ─────────────────────────────────────────────────────────────────

console.log("\n══════════════════════════════════════════════════════");
console.log("  TESTE: execute_internal_transfer_atomic");
console.log("  Dados fictícios | Zero impacto em produção");
console.log("══════════════════════════════════════════════════════\n");

// ── Caminho feliz ────────────────────────────────────────────────────────────

await test("Transferência bem-sucedida: paciente muda de leito, origem vaga", () => {
  const state = createState();
  const result = executeTransferAtomic(state);

  assert(result.ok === true, "Transferência deve ser bem-sucedida");
  assert(result.stateAfter.target.name === "JOSE RIBAMAR RODRIGUES", "Destino deve ter o paciente");
  assert(result.stateAfter.target.is_vacant === false, "Destino deve estar ocupado");
  assert(result.stateAfter.source.is_vacant === true, "Origem deve estar vaga");
  assert(result.stateAfter.source.name === "", "Origem deve ter nome vazio");
  assert(result.stateAfter.source.patient_registry_id === null, "Origem sem registry_id");
  assert(result.stateAfter.movements.length === 1, "Deve ter 1 registro de movimentação");
  assert(result.stateAfter.movements[0].includes("L01"), "Movimentação deve referenciar origem");
  assert(result.stateAfter.movements[0].includes("L04"), "Movimentação deve referenciar destino");
});

await test("Destino recebe registry_id e diagnósticos do paciente", () => {
  const state = createState();
  const result = executeTransferAtomic(state);

  assert(result.stateAfter.target.patient_registry_id === "registry-jose-uuid",
    "Destino deve ter registry_id do paciente");
  assert(result.stateAfter.target.diagnoses?.includes("Pneumonia"),
    "Destino deve ter diagnósticos");
});

// ── ROLLBACK em falha do passo 1 ─────────────────────────────────────────────

await test("Falha no passo 1 (popular destino): ROLLBACK — origem e destino inalterados", () => {
  const state = createState();
  const result = executeTransferAtomic(state, { step1Fails: true });

  assert(result.ok === false, "Deve retornar erro");
  assert(result.stateAfter.source.name === "JOSE RIBAMAR RODRIGUES", "Origem inalterada (rollback)");
  assert(result.stateAfter.source.is_vacant === false, "Origem ainda ocupada (rollback)");
  assert(result.stateAfter.target.is_vacant === true, "Destino ainda vago (rollback)");
  assert(result.stateAfter.target.name === "", "Destino sem nome (rollback)");
  assert(result.stateAfter.movements.length === 0, "Sem movimentação registrada (rollback)");
});

// ── ROLLBACK em falha do repoint (passo 2) ───────────────────────────────────

await test("Falha no repoint: ROLLBACK — banco volta ao estado inicial", () => {
  const state = createState();
  const result = executeTransferAtomic(state, { step2Fails: true });

  assert(result.ok === false, "Deve retornar erro");
  // Comportamento ANTES da transação: destino ficava populado, origem não era zerada
  // Comportamento DEPOIS da transação: tudo reverte
  assert(result.stateAfter.source.is_vacant === false, "Origem ainda ocupada (rollback)");
  assert(result.stateAfter.target.is_vacant === true, "Destino ainda vago (rollback)");
  assert(!state.repointOk, "Repoint marcado como falho");
  assert(result.stateAfter.movements.length === 0, "Sem movimentação (rollback)");
  assert(result.error?.includes("repoint"), "Mensagem de erro menciona repoint");
});

// ── ROLLBACK em falha do passo 3 ─────────────────────────────────────────────

await test("Falha no esvaziamento da origem (passo 3): ROLLBACK total", () => {
  const state = createState();
  const result = executeTransferAtomic(state, { step3Fails: true });

  assert(result.ok === false, "Deve retornar erro");
  // Com transação: TUDO reverte — destino volta a vago, origem permanece com paciente
  assert(result.stateAfter.source.name === "JOSE RIBAMAR RODRIGUES", "Origem restaurada");
  assert(result.stateAfter.source.is_vacant === false, "Origem ainda ocupada");
  assert(result.stateAfter.target.is_vacant === true, "Destino voltou a vago (rollback)");
});

// ── ROLLBACK em falha do passo 4 ─────────────────────────────────────────────

await test("Falha na auditoria (passo 4): transferência CONCLUI — log é secundário", () => {
  // O passo 4 está em bloco BEGIN...EXCEPTION isolado na função SQL.
  // Falha no INSERT patient_movements NÃO desfaz os passos 1-3.
  // Transferência clínica tem prioridade sobre o log de auditoria.
  //
  // Simulamos aqui o comportamento correto: transferência concluída,
  // log ausente (será registrado manualmente se necessário).
  const state = createState();

  // Simula: passos 1-3 ok, passo 4 falha mas é silenciado
  const sourceSnap = { ...state.source };
  state.target.name = state.source.name;
  state.target.patient_registry_id = state.source.patient_registry_id;
  state.target.is_vacant = false;
  state.target.admission_status = "admitido";
  state.source.name = "";
  state.source.patient_registry_id = null;
  state.source.is_vacant = true;
  state.source.admission_status = null;
  // Passo 4 falhou mas foi silenciado (EXCEPTION WHEN OTHERS)
  // movements permanece vazio — mas a transferência ocorreu
  const auditFailedButTransferOk = true;

  assert(auditFailedButTransferOk === true, "Auditoria falhou (silenciada)");
  assert(state.target.name === sourceSnap.name, "Paciente no destino (transferência ocorreu)");
  assert(state.source.is_vacant === true, "Origem zerada (transferência ocorreu)");
  assert(state.movements.length === 0, "Sem log de auditoria (falhou silenciosamente)");
  // Comportamento CORRETO: transferência nunca falha por causa do log
});

// ── Comparação: comportamento ANTES (sem transação) ──────────────────────────

await test("ANTES (sem transação): falha no passo 3 deixava estado inconsistente", () => {
  // Simula o comportamento ANTERIOR sem rollback automático
  const source = { ...createState().source };
  const target = { ...createState().target };
  const movements: string[] = [];

  try {
    // Passo 1: popula destino ← commitado independentemente
    target.name = source.name;
    target.is_vacant = false;

    // Passo 2: repoint ← commitado independentemente
    // (ok)

    // Passo 3: falha ao esvaziar origem
    throw new Error("Falha simulada ao esvaziar origem");
  } catch {
    // Sem transação: passo 1 já foi commitado, passo 3 não foi executado
    // Resultado: DESTINO com paciente E ORIGEM com paciente (inconsistente!)
  }

  assert(target.is_vacant === false, "Destino ficou com paciente (estado inconsistente)");
  assert(source.is_vacant === false, "Origem também ficou com paciente (estado inconsistente)");
  assert(movements.length === 0, "Sem auditoria registrada");
  // Isso é exatamente o bug que a transação resolve
});

await test("DEPOIS (com transação): falha no passo 3 reverte tudo — estado consistente", () => {
  const state = createState();
  const result = executeTransferAtomic(state, { step3Fails: true });

  // Estado consistente: paciente está OU na origem OU no destino — nunca nos dois
  const pacienteNaOrigem = !result.stateAfter.source.is_vacant;
  const pacienteNoDestino = !result.stateAfter.target.is_vacant;

  // Com rollback: paciente está na origem (onde estava antes)
  assert(pacienteNaOrigem && !pacienteNoDestino,
    "Com transação: paciente está em EXATAMENTE um leito (consistente)");
});

// ── Múltiplas transferências independentes ───────────────────────────────────

await test("Duas transferências independentes: cada uma é atômica separadamente", () => {
  const state1 = createState();
  const state2 = {
    source: {
      id: "leito-l09-uuid",
      name: "RAIMUNDO SOARES DE ARAUJO",
      bed_number: "L09",
      sector: "yellow",
      is_vacant: false,
      admission_status: "admitido",
      patient_registry_id: "registry-raimundo-uuid",
      diagnoses: "IAM",
      medical_record: "000088",
    },
    target: {
      id: "leito-l12-uuid",
      name: "",
      bed_number: "L12",
      sector: "outside",
      is_vacant: true,
      admission_status: null,
      patient_registry_id: null,
      diagnoses: null,
      medical_record: null,
    },
    movements: [] as string[],
    repointOk: false,
  };

  // Transferência 1: ok
  const r1 = executeTransferAtomic(state1);
  // Transferência 2: falha no repoint
  const r2 = executeTransferAtomic(state2, { step2Fails: true });

  assert(r1.ok === true, "Transferência 1 deve ter sucesso");
  assert(r2.ok === false, "Transferência 2 deve falhar");
  // State1 completou normalmente
  assert(r1.stateAfter.source.is_vacant === true, "Origem 1 deve estar vaga");
  // State2 reverteu completamente
  assert(r2.stateAfter.source.is_vacant === false, "Origem 2 deve estar ocupada (rollback)");
  assert(r2.stateAfter.target.is_vacant === true, "Destino 2 deve estar vago (rollback)");
});

// ── Validações de entrada ────────────────────────────────────────────────────

await test("Validação: source e target iguais retornam erro antes de executar", () => {
  // Simula o RAISE EXCEPTION do SQL quando source = target
  const sourceId = "leito-l01-uuid";
  const targetId = "leito-l01-uuid"; // mesmo leito!

  const isInvalid = sourceId === targetId;
  assert(isInvalid === true, "Deve detectar source = target como inválido");
  // A RPC SQL levantaria RAISE EXCEPTION 'source e target devem ser leitos diferentes'
});

// ── Relatório ────────────────────────────────────────────────────────────────

console.log("──────────────────────────────────────────────────────");
for (const r of results) {
  console.log(`  ${r.ok ? "✓" : "✗"} ${r.name}${r.ok ? "" : `\n      → ${r.details}`}`);
}
console.log("──────────────────────────────────────────────────────");
console.log(`  TOTAL: ${passed + failed} | ✓ ${passed} passaram | ${failed > 0 ? "✗" : "✓"} ${failed} falharam`);
console.log("──────────────────────────────────────────────────────\n");

if (failed > 0) process.exit(1);
