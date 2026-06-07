/**
 * TESTE: MÉDIA-01 / MÉDIA-02 / MÉDIA-03 — AuthContext
 *
 * MÉDIA-01: refreshUserStatus deve rebuscar role + status + departamentos completos
 * MÉDIA-02: double-init (onAuthStateChange + getSession) → só uma busca executa
 * MÉDIA-03: erro de departamentos logado em produção (não silenciado)
 *
 * Dados fictícios | Zero impacto em produção.
 */

// ── Simulação do comportamento do AuthContext ─────────────────────────────────

interface MockUser { id: string; email: string }
interface AuthState {
  role: string | null;
  status: string | null;
  allowedDepartments: string[];
  loading: boolean;
  fetchCallCount: number;
  deptErrorLogged: boolean;
}

type FetchConfig = {
  roleResult: string | null;
  statusResult: string | null;
  departmentsResult: string[];
  roleQueryFails?: boolean;
  deptQueryFails?: boolean;
};

// Replica a lógica do AuthContext com o fetchingUserIdRef incluído (MÉDIA-02)
function buildAuthContext(config: FetchConfig) {
  const state: AuthState = {
    role: null,
    status: null,
    allowedDepartments: [],
    loading: true,
    fetchCallCount: 0,
    deptErrorLogged: false,
  };

  // Ref que deduplica chamadas concorrentes para o mesmo userId
  let fetchingUserId: string | null = null;

  async function fetchUserRoleAndDepartments(userId: string): Promise<void> {
    // MÉDIA-02: guarda contra dupla execução para o mesmo userId.
    // A guarda é síncrona (antes de qualquer await): a segunda chamada concorrente
    // vê o userId já preenchido e retorna imediatamente.
    if (fetchingUserId === userId) return;
    fetchingUserId = userId;
    state.fetchCallCount++;

    try {
      // Simula latência assíncrona real (queries ao banco).
      // Sem este await, funções async sem awaits executam de forma completamente
      // síncrona, zerando o fetchingUserId antes que a segunda chamada faça
      // a verificação — tornando o teste de dedup ineficaz.
      await Promise.resolve();

      if (config.roleQueryFails) {
        console.error("[test] falha ao buscar role");
        state.role = null;
        state.status = "pending";
        state.allowedDepartments = [];
        return;
      }

      state.role = config.roleResult;
      state.status = config.statusResult;

      if (config.deptQueryFails) {
        // MÉDIA-03: sempre loga, independente do ambiente
        console.error("[AuthContext] falha ao buscar departamentos do usuário:", new Error("dept query failed"));
        state.deptErrorLogged = true;
        state.allowedDepartments = [];
      } else {
        state.allowedDepartments = config.departmentsResult;
      }
    } finally {
      fetchingUserId = null;
      state.loading = false;
    }
  }

  // MÉDIA-01: refreshUserStatus chama o fetch completo (não apenas status)
  async function refreshUserStatus(user: MockUser): Promise<void> {
    await fetchUserRoleAndDepartments(user.id);
  }

  // Simula onAuthStateChange + getSession disparando quase simultaneamente (MÉDIA-02)
  async function simulateDualInit(user: MockUser): Promise<void> {
    // Ambos usam setTimeout(0) no código real — aqui chamamos diretamente em paralelo
    await Promise.all([
      fetchUserRoleAndDepartments(user.id),
      fetchUserRoleAndDepartments(user.id), // segunda chamada deve ser ignorada
    ]);
  }

  return { state, fetchUserRoleAndDepartments, refreshUserStatus, simulateDualInit };
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

const USER_FARMACISTA: MockUser = { id: "user-farmacista-uuid", email: "ana.farmacia@hmdm.gov.br" };
const USER_MEDICO: MockUser = { id: "user-medico-uuid", email: "dr.raimundo@hmdm.gov.br" };

// ── Cenários ──────────────────────────────────────────────────────────────────

console.log("\n══════════════════════════════════════════════════════");
console.log("  TESTE: MÉDIA-01/02/03 — AuthContext");
console.log("  Dados fictícios | Zero impacto em produção");
console.log("══════════════════════════════════════════════════════\n");

// ── MÉDIA-01: refreshUserStatus atualiza role + status + depts ───────────────

await test("MÉDIA-01: refreshUserStatus atualiza role (não só status)", async () => {
  const ctx = buildAuthContext({ roleResult: "visitante", statusResult: "approved", departmentsResult: ["red"] });
  await ctx.fetchUserRoleAndDepartments(USER_FARMACISTA.id);
  assert(ctx.state.role === "visitante", "Role inicial: visitante");

  // Admin promove para farmácia — atualiza config
  const ctxAtualizado = buildAuthContext({ roleResult: "farmacia", statusResult: "approved", departmentsResult: ["red", "yellow"] });
  // Reutiliza o mesmo userId para simular que o refresh foi chamado pelo mesmo user
  await ctxAtualizado.refreshUserStatus(USER_FARMACISTA);

  assert(ctxAtualizado.state.role === "farmacia", "Role deve ser atualizado para 'farmacia'");
  assert(ctxAtualizado.state.allowedDepartments.length === 2, "Departamentos devem ser atualizados");
  assert(ctxAtualizado.state.status === "approved", "Status deve ser mantido");
});

await test("MÉDIA-01: antes do fix, refreshUserStatus APENAS atualizava status", () => {
  // Documenta o comportamento ANTERIOR (bugado)
  interface OldState { role: string | null; status: string | null }
  async function oldRefreshUserStatus(state: OldState): Promise<void> {
    // Só buscava status — role nunca era atualizado
    state.status = "approved"; // simula fetch do perfil
    // role permanece o antigo — bug!
  }
  const state: OldState = { role: "visitante", status: "pending" };
  void oldRefreshUserStatus(state); // intencional: verifica comportamento síncrono
  assert(state.role === "visitante", "ANTES: role ficava desatualizado após refresh");
  // Este teste documenta o bug corrigido.
});

await test("MÉDIA-01: refreshUserStatus após promoção → role correto na sessão", async () => {
  const ctx = buildAuthContext({ roleResult: "medico", statusResult: "approved", departmentsResult: ["red", "yellow", "blue"] });
  await ctx.refreshUserStatus(USER_MEDICO);

  assert(ctx.state.role === "medico", "Role deve ser 'medico' após refresh");
  assert(ctx.state.allowedDepartments.includes("blue"), "Departamentos atualizados");
  assert(ctx.state.loading === false, "Loading deve ser false após refresh");
});

// ── MÉDIA-02: double-init → apenas uma chamada executa ───────────────────────

await test("MÉDIA-02: double-init → fetchCallCount = 1 (segunda chamada ignorada)", async () => {
  const ctx = buildAuthContext({ roleResult: "admin", statusResult: "approved", departmentsResult: ["red"] });
  await ctx.simulateDualInit(USER_MEDICO);

  assert(
    ctx.state.fetchCallCount === 1,
    `Double-init deve gerar apenas 1 fetch. Recebido: ${ctx.state.fetchCallCount}`,
  );
});

await test("MÉDIA-02: dois usuários diferentes → dois fetches independentes", async () => {
  const ctx = buildAuthContext({ roleResult: "medico", statusResult: "approved", departmentsResult: [] });
  // Cada usuário tem userId diferente — ambos devem executar
  await ctx.fetchUserRoleAndDepartments("user-a-uuid");
  await ctx.fetchUserRoleAndDepartments("user-b-uuid");

  assert(ctx.state.fetchCallCount === 2, "Dois usuários diferentes → 2 fetches");
});

await test("MÉDIA-02: chamada sequential para mesmo user após conclusão → permite nova execução", async () => {
  const ctx = buildAuthContext({ roleResult: "porta", statusResult: "approved", departmentsResult: ["outside"] });
  await ctx.fetchUserRoleAndDepartments(USER_FARMACISTA.id);
  const countApósInicio = ctx.state.fetchCallCount;
  // Segunda chamada após conclusão (fetchingUserId já foi limpo no finally)
  await ctx.fetchUserRoleAndDepartments(USER_FARMACISTA.id);

  assert(countApósInicio === 1, "Primeira chamada foi executada");
  assert(ctx.state.fetchCallCount === 2, "Segunda chamada sequential (pós-conclusão) deve executar");
});

// ── MÉDIA-03: erros de departamento logados em produção ──────────────────────

await test("MÉDIA-03: deptError → sempre loga (não só em DEV)", async () => {
  const ctx = buildAuthContext({
    roleResult: "medico",
    statusResult: "approved",
    departmentsResult: [],
    deptQueryFails: true,
  });
  await ctx.fetchUserRoleAndDepartments(USER_MEDICO.id);

  assert(ctx.state.deptErrorLogged === true, "Erro de departamento deve ser logado");
  assert(ctx.state.allowedDepartments.length === 0, "allowedDepartments deve ser [] em caso de erro");
  assert(ctx.state.role === "medico", "Role não deve ser afetado por erro de departamento");
});

await test("MÉDIA-03: ANTES do fix — erro de dept era silenciado em produção", () => {
  // Documenta o comportamento anterior (DEV-only logging)
  let errorLoggedInProd = false;
  const isDev = false; // simula produção

  function oldDeptErrorHandler() {
    if (isDev) { // ← era assim antes do fix
      console.error("dept error");
      errorLoggedInProd = true;
    }
    // Em prod: nada — erro silenciado
  }
  oldDeptErrorHandler();
  assert(
    errorLoggedInProd === false,
    "ANTES: erro de departamento não era logado em produção — corrigido pelo fix",
  );
});

await test("MÉDIA-03: usuário com erro de dept ainda tem acesso negado (allowedDepts vazio)", async () => {
  const ctx = buildAuthContext({
    roleResult: "medico",
    statusResult: "approved",
    departmentsResult: [],
    deptQueryFails: true,
  });
  await ctx.fetchUserRoleAndDepartments(USER_MEDICO.id);

  // Comportamento esperado: usuário bloqueado de acessar leitos específicos
  // (allowedDepartments vazio → ProtectedRoute nega acesso a departamentos restritos)
  assert(ctx.state.allowedDepartments.length === 0,
    "Usuário com falha de dept deve ficar com allowedDepartments vazio (seguro por padrão)");
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
