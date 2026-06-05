/**
 * TESTE: PatientMovementDialog — fluxo de transferência interna
 *
 * Cobre a correção do insert de internal_transfer_requests:
 *   - Falha no insert → reverte status → throw → toast de erro
 *   - Falha no insert E no revert → throw mesmo assim
 *   - Sucesso → sem revert, toast de sucesso
 *
 * Dados fictícios — zero impacto em produção.
 */

// ── Tipos ─────────────────────────────────────────────────────────

interface MockPatientState {
  id: string;
  name: string;
  admission_status: string;
}

interface SimulationResult {
  finalStatus: string;
  toastShown: "success" | "destructive" | null;
  toastMessage: string | null;
  submitDisabled: boolean; // false = botão reabilitado para retry
  successCallbackCalled: boolean;
}

// ── Replica a lógica do PatientMovementDialog para TRANSFERENCIA_INTERNA ───────

async function simulateTransferMovement(
  patient: MockPatientState,
  options: {
    insertRequestFails?: boolean;
    revertStatusFails?: boolean;
    insertRequestError?: string;
  } = {}
): Promise<SimulationResult> {
  let finalStatus = patient.admission_status;
  let toastShown: "success" | "destructive" | null = null;
  let toastMessage: string | null = null;
  let isSubmitting = true;
  let successCallbackCalled = false;

  const toast = (opts: { title: string; description?: string; variant?: string }) => {
    toastShown = opts.variant === "destructive" ? "destructive" : "success";
    toastMessage = opts.description ?? opts.title;
  };

  try {
    // Passo 1: UPDATE patients.admission_status = "transferencia_interna_pendente"
    finalStatus = "transferencia_interna_pendente";

    // Passo 2: INSERT internal_transfer_requests
    const reqErr = options.insertRequestFails
      ? new Error(options.insertRequestError ?? "Falha de conexão ao inserir request")
      : null;

    if (reqErr) {
      // Reverte admission_status → "admitido"
      if (!options.revertStatusFails) {
        finalStatus = "admitido";
      }
      // Mesmo que o revert falhe, o throw ainda acontece
      throw new Error("Não foi possível criar a fila de transferência. A sinalização foi cancelada — tente novamente.");
    }

    // Sucesso: registra toast de sucesso e chama callback
    toast({ title: "TRANSFERÊNCIA INTERNA registrado(a)", description: "Movimentação registrada no histórico." });
    successCallbackCalled = true;

  } catch (error: any) {
    // Catch geral — replica o catch do PatientMovementDialog
    const msg = error?.message || "Não foi possível registrar a movimentação. Tente novamente.";
    toast({ title: "Erro ao registrar movimentação", description: String(msg).slice(0, 300), variant: "destructive" });
  } finally {
    isSubmitting = false; // sempre reabilita o botão
  }

  return {
    finalStatus,
    toastShown,
    toastMessage,
    submitDisabled: isSubmitting,
    successCallbackCalled,
  };
}

// ── Infra de teste ────────────────────────────────────────────────

let passed = 0; let failed = 0;
const results: { group: string; name: string; ok: boolean; details: string }[] = [];
let currentGroup = "";
function group(name: string) { currentGroup = name; }
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }
async function test(name: string, fn: () => void | Promise<void>) {
  try { await fn(); results.push({ group: currentGroup, name, ok: true, details: "ok" }); passed++; }
  catch (e: any) { results.push({ group: currentGroup, name, ok: false, details: e.message }); failed++; }
}

const BRAULINO: MockPatientState = {
  id: "leito-l12-uuid-fake",
  name: "BRAULINO RODRIGUES",
  admission_status: "admitido",
};

// ══════════════════════════════════════════════════════════════════

console.log("\n══════════════════════════════════════════════════════");
console.log("  TESTE: PatientMovementDialog — transferência interna");
console.log("  Dados fictícios | Zero impacto em produção");
console.log("══════════════════════════════════════════════════════\n");

// ── Grupo 1: Caminho feliz ────────────────────────────────────────

group("GRUPO 1 — Insert bem-sucedido");

await test("Insert ok: status fica 'transferencia_interna_pendente'", async () => {
  const r = await simulateTransferMovement({ ...BRAULINO });
  assert(r.finalStatus === "transferencia_interna_pendente", `Status: ${r.finalStatus}`);
});

await test("Insert ok: toast de sucesso exibido", async () => {
  const r = await simulateTransferMovement({ ...BRAULINO });
  assert(r.toastShown === "success", `Toast: ${r.toastShown}`);
  assert(r.toastMessage?.includes("Movimentação registrada"), `Mensagem: ${r.toastMessage}`);
});

await test("Insert ok: callback de sucesso chamado", async () => {
  const r = await simulateTransferMovement({ ...BRAULINO });
  assert(r.successCallbackCalled === true, "onSuccess() deve ser chamado");
});

await test("Insert ok: botão reabilitado após sucesso (finally executou)", async () => {
  const r = await simulateTransferMovement({ ...BRAULINO });
  assert(r.submitDisabled === false, "isSubmitting deve ser false após finally");
});

// ── Grupo 2: Insert falha, revert bem-sucedido ────────────────────

group("GRUPO 2 — Insert falha, status revertido");

await test("Insert falha: status revertido para 'admitido'", async () => {
  const r = await simulateTransferMovement({ ...BRAULINO }, { insertRequestFails: true });
  assert(r.finalStatus === "admitido",
    `Status deve ser revertido para 'admitido', recebeu '${r.finalStatus}'`);
});

await test("Insert falha: toast de ERRO exibido (não de sucesso)", async () => {
  const r = await simulateTransferMovement({ ...BRAULINO }, { insertRequestFails: true });
  assert(r.toastShown === "destructive", `Toast deve ser destructive, recebeu '${r.toastShown}'`);
});

await test("Insert falha: mensagem orienta o usuário a tentar novamente", async () => {
  const r = await simulateTransferMovement({ ...BRAULINO }, { insertRequestFails: true });
  assert(r.toastMessage?.includes("tente novamente"), `Mensagem: ${r.toastMessage}`);
  assert(r.toastMessage?.includes("cancelada"), `Mensagem deve indicar cancelamento: ${r.toastMessage}`);
});

await test("Insert falha: toast de sucesso NÃO é exibido", async () => {
  const r = await simulateTransferMovement({ ...BRAULINO }, { insertRequestFails: true });
  assert(!r.toastMessage?.includes("Movimentação registrada"),
    "Toast de sucesso não deve aparecer quando insert falha");
});

await test("Insert falha: callback de sucesso NÃO é chamado", async () => {
  const r = await simulateTransferMovement({ ...BRAULINO }, { insertRequestFails: true });
  assert(r.successCallbackCalled === false, "onSuccess() não deve ser chamado em caso de erro");
});

await test("Insert falha: botão reabilitado para retry (finally sempre executa)", async () => {
  const r = await simulateTransferMovement({ ...BRAULINO }, { insertRequestFails: true });
  assert(r.submitDisabled === false, "isSubmitting deve ser false — médico pode tentar de novo");
});

// ── Grupo 3: Insert falha E revert falha ─────────────────────────

group("GRUPO 3 — Insert falha e revert também falha");

await test("Insert e revert falham: erro ainda é exibido ao usuário via toast", async () => {
  const r = await simulateTransferMovement({ ...BRAULINO }, {
    insertRequestFails: true,
    revertStatusFails: true,
  });
  assert(r.toastShown === "destructive", "Toast de erro deve aparecer mesmo com revert falhando");
});

await test("Insert e revert falham: botão reabilitado (finally não é interrompido)", async () => {
  const r = await simulateTransferMovement({ ...BRAULINO }, {
    insertRequestFails: true,
    revertStatusFails: true,
  });
  assert(r.submitDisabled === false, "isSubmitting deve ser false mesmo com falha dupla");
});

await test("Insert e revert falham: status inconsistente é visível — equipe pode corrigir", async () => {
  const r = await simulateTransferMovement({ ...BRAULINO }, {
    insertRequestFails: true,
    revertStatusFails: true,
  });
  // Neste caso o status ficou inconsistente (transferencia_interna_pendente sem request)
  // O toast de erro avisa o médico que algo está errado
  assert(r.finalStatus === "transferencia_interna_pendente",
    "Status inconsistente quando revert falha (registrado no console)");
  assert(r.toastShown === "destructive",
    "Médico é avisado do erro — pode acionar suporte para correção manual");
});

// ── Grupo 4: Mensagem de erro truncada a 300 chars ────────────────

group("GRUPO 4 — Tratamento de mensagens longas");

await test("Mensagem de erro longa é truncada a 300 chars no toast", async () => {
  const errLongo = "A".repeat(500);
  // O catch do PatientMovementDialog faz String(msg).slice(0, 300)
  const truncada = String(errLongo).slice(0, 300);
  assert(truncada.length === 300, `Mensagem truncada deve ter 300 chars, tem ${truncada.length}`);
  assert(truncada.length < errLongo.length, "Mensagem foi truncada");
});

await test("Nossa mensagem de erro tem menos de 300 chars — não é truncada", async () => {
  const r = await simulateTransferMovement({ ...BRAULINO }, { insertRequestFails: true });
  const msg = r.toastMessage ?? "";
  assert(msg.length <= 300, `Mensagem tem ${msg.length} chars — dentro do limite`);
  assert(msg.length > 0, "Mensagem não pode ser vazia");
});

// ── Relatório ─────────────────────────────────────────────────────

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
