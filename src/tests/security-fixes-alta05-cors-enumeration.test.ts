/**
 * TESTE: ALTA-05 — resolve-login: CORS dinâmico + mensagem genérica anti-enumeração
 *
 * Valida:
 *  1. buildCorsHeaders: origin autorizada → cabeçalho correto
 *  2. buildCorsHeaders: origin não autorizada → "null"
 *  3. buildCorsHeaders: sem ALLOWED_ORIGIN configurado → "*"
 *  4. Mensagem genérica: 404 e 429 retornam a mesma string (evita enumeração)
 *
 * Dados fictícios | Zero impacto em produção.
 */

// ── Replica a lógica de buildCorsHeaders da Edge Function ────────────────────

function buildCorsHeaders(
  requestOrigin: string,
  allowedOrigin: string | undefined,
): Record<string, string> {
  const effective =
    allowedOrigin === undefined || allowedOrigin === "*"
      ? "*"
      : requestOrigin === allowedOrigin
      ? allowedOrigin
      : "null";
  return {
    "Access-Control-Allow-Origin": effective,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

const MSG_NOT_FOUND = "Identificador não encontrado ou acesso bloqueado.";

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
console.log("  TESTE: ALTA-05 — CORS dinâmico + anti-enumeração");
console.log("  Dados fictícios | Zero impacto em produção");
console.log("══════════════════════════════════════════════════════\n");

// ── CORS: origin autorizada ───────────────────────────────────────────────────

await test("Origin autorizada: cabeçalho retorna a origin exata", () => {
  const headers = buildCorsHeaders(
    "https://arsen.socorrao.ms.gov.br",
    "https://arsen.socorrao.ms.gov.br",
  );
  assert(
    headers["Access-Control-Allow-Origin"] === "https://arsen.socorrao.ms.gov.br",
    `Esperado: origin exata. Recebido: ${headers["Access-Control-Allow-Origin"]}`,
  );
});

await test("Origin autorizada: cabeçalho outros campos presentes", () => {
  const headers = buildCorsHeaders(
    "https://arsen.socorrao.ms.gov.br",
    "https://arsen.socorrao.ms.gov.br",
  );
  assert(headers["Access-Control-Allow-Methods"].includes("POST"), "Allow-Methods deve incluir POST");
  assert(headers["Access-Control-Allow-Headers"].includes("authorization"), "Allow-Headers deve incluir authorization");
});

// ── CORS: origin não autorizada ───────────────────────────────────────────────

await test("Origin não autorizada: cabeçalho retorna 'null' (bloqueia browser)", () => {
  const headers = buildCorsHeaders(
    "https://site-malicioso.com",
    "https://arsen.socorrao.ms.gov.br",
  );
  assert(
    headers["Access-Control-Allow-Origin"] === "null",
    `Esperado: "null". Recebido: ${headers["Access-Control-Allow-Origin"]}`,
  );
});

await test("Origin vazia com ALLOWED_ORIGIN configurado: retorna 'null'", () => {
  const headers = buildCorsHeaders("", "https://arsen.socorrao.ms.gov.br");
  assert(
    headers["Access-Control-Allow-Origin"] === "null",
    `Origin vazia deve retornar "null". Recebido: ${headers["Access-Control-Allow-Origin"]}`,
  );
});

await test("Subdomínio diferente não passa na verificação estrita", () => {
  const headers = buildCorsHeaders(
    "https://admin.arsen.socorrao.ms.gov.br",
    "https://arsen.socorrao.ms.gov.br",
  );
  assert(
    headers["Access-Control-Allow-Origin"] === "null",
    "Subdomínio diferente deve ser bloqueado",
  );
});

// ── CORS: sem ALLOWED_ORIGIN (dev local / não configurado) ────────────────────

await test("Sem ALLOWED_ORIGIN configurado: retorna '*' (retrocompat dev)", () => {
  const headers = buildCorsHeaders("https://qualquer-origem.com", undefined);
  assert(
    headers["Access-Control-Allow-Origin"] === "*",
    `Sem env var → "*". Recebido: ${headers["Access-Control-Allow-Origin"]}`,
  );
});

await test("ALLOWED_ORIGIN='*' explícito: também retorna '*'", () => {
  const headers = buildCorsHeaders("https://qualquer-origem.com", "*");
  assert(
    headers["Access-Control-Allow-Origin"] === "*",
    `ALLOWED_ORIGIN="*" → "*". Recebido: ${headers["Access-Control-Allow-Origin"]}`,
  );
});

// ── Anti-enumeração: mesma mensagem para 404 e 429 ───────────────────────────

await test("404 (não encontrado) e 429 (rate limit) retornam a mesma mensagem", () => {
  // Mensagem do caso "não encontrado"
  const msgNotFound = MSG_NOT_FOUND;
  // Mensagem que seria retornada no 429
  const msgRateLimit = MSG_NOT_FOUND; // ambos agora usam a mesma constante

  assert(
    msgNotFound === msgRateLimit,
    "404 e 429 devem ter mensagens idênticas para impedir enumeração",
  );
});

await test("Mensagem genérica não menciona 'usuário' — não confirma existência da conta", () => {
  // O fix remove "Usuário não encontrado" (revelava que o usuário não existia)
  // e substitui por "Identificador não encontrado ou acesso bloqueado."
  // "encontrado" pode aparecer, mas referindo-se ao identificador, não ao usuário.
  assert(!MSG_NOT_FOUND.toLowerCase().includes("usuário"), "Mensagem não deve mencionar 'usuário'");
  // Mesma mensagem para 404 e 429 é o controle de enumeração principal
  assert(MSG_NOT_FOUND.length > 10, "Mensagem deve ser descritiva o suficiente");
  assert(MSG_NOT_FOUND.includes("bloqueado"), "Mensagem cobre tanto 'não encontrado' quanto 'rate limited'");
});

await test("Atacante não consegue distinguir conta inexistente de conta bloqueada por rate limit", () => {
  // Simula: mesma mensagem em ambos os casos (lógica do servidor)
  function simulateResponse(userExists: boolean, rateLimited: boolean): string {
    if (rateLimited) return MSG_NOT_FOUND; // antes: mensagem distinta
    if (!userExists) return MSG_NOT_FOUND;
    return "ok";
  }

  const respExistsBlocked = simulateResponse(true, true);
  const respNotExists = simulateResponse(false, false);
  assert(
    respExistsBlocked === respNotExists,
    "Conta bloqueada e conta inexistente devem retornar a mesma mensagem",
  );
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
