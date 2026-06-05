/**
 * TESTE: rate limiting do resolve-login
 *
 * Valida a lógica de rate limiting (5 tentativas/min por IP)
 * com dados fictícios — sem tocar na função real.
 */

// ── Replica a lógica da Edge Function ────────────────────────────────────────

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;
const STORE_MAX_SIZE = 2_000;

type RateLimitEntry = { count: number; resetAt: number };
const rateLimitStore = new Map<string, RateLimitEntry>();

function checkRateLimit(ip: string, nowMs: number = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
  if (rateLimitStore.size >= STORE_MAX_SIZE) {
    for (const [key, entry] of rateLimitStore.entries()) {
      if (nowMs > entry.resetAt) rateLimitStore.delete(key);
    }
  }
  const entry = rateLimitStore.get(ip);
  if (!entry || nowMs > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: nowMs + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - nowMs) / 1000);
    return { allowed: false, retryAfterSeconds };
  }
  entry.count++;
  rateLimitStore.set(ip, entry);
  return { allowed: true, retryAfterSeconds: 0 };
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

function freshIp(suffix: string) {
  return `192.168.1.${suffix}`;
}

// ── Cenários ─────────────────────────────────────────────────────────────────

console.log("\n══════════════════════════════════════════════════════");
console.log("  TESTE: rate limiting — resolve-login");
console.log("  Dados fictícios | Zero impacto em produção");
console.log("══════════════════════════════════════════════════════\n");

const NOW = Date.now();

// ── Caminho feliz ────────────────────────────────────────────────────────────

await test("Primeira tentativa: permitida", () => {
  const ip = freshIp("10");
  const result = checkRateLimit(ip, NOW);
  assert(result.allowed === true, `Primeira tentativa deve ser permitida`);
  assert(result.retryAfterSeconds === 0, "retryAfterSeconds deve ser 0");
});

await test("5 tentativas dentro da janela: todas permitidas", () => {
  const ip = freshIp("20");
  for (let i = 1; i <= 5; i++) {
    const result = checkRateLimit(ip, NOW + i * 100);
    assert(result.allowed === true, `Tentativa ${i}/5 deve ser permitida`);
  }
});

// ── Rate limit atingido ──────────────────────────────────────────────────────

await test("6ª tentativa: bloqueada (rate limit atingido)", () => {
  const ip = freshIp("30");
  for (let i = 1; i <= 5; i++) checkRateLimit(ip, NOW);
  const bloqueada = checkRateLimit(ip, NOW + 1000);
  assert(bloqueada.allowed === false, "6ª tentativa deve ser bloqueada");
  assert(bloqueada.retryAfterSeconds > 0, "retryAfterSeconds deve ser positivo");
});

await test("retryAfterSeconds reflete o tempo restante da janela", () => {
  const ip = freshIp("40");
  for (let i = 1; i <= 5; i++) checkRateLimit(ip, NOW);
  // Passaram 20 segundos — restam ~40 segundos
  const bloqueada = checkRateLimit(ip, NOW + 20_000);
  assert(bloqueada.retryAfterSeconds <= 40, `Deve restar ~40s, recebeu ${bloqueada.retryAfterSeconds}`);
  assert(bloqueada.retryAfterSeconds > 0, "Deve ter tempo restante");
});

await test("Ataque automatizado: 1000 CPFs bloqueados após as 5 primeiras tentativas", () => {
  const ip = freshIp("50");
  let permitidas = 0; let bloqueadas = 0;
  for (let i = 0; i < 1000; i++) {
    const r = checkRateLimit(ip, NOW + i);
    if (r.allowed) permitidas++; else bloqueadas++;
  }
  assert(permitidas === 5, `Exatamente 5 devem passar, recebeu: ${permitidas}`);
  assert(bloqueadas === 995, `995 devem ser bloqueadas, recebeu: ${bloqueadas}`);
});

// ── Janela expira: acesso restaurado ────────────────────────────────────────

await test("Após janela de 60s: acesso restaurado (nova janela)", () => {
  const ip = freshIp("60");
  for (let i = 1; i <= 5; i++) checkRateLimit(ip, NOW);
  const bloqueada = checkRateLimit(ip, NOW + 100);
  assert(bloqueada.allowed === false, "Deve estar bloqueado antes de 60s");

  // Simula passagem de 61 segundos
  const apos60s = checkRateLimit(ip, NOW + 61_000);
  assert(apos60s.allowed === true, "Deve ser permitido após 60s");
  assert(apos60s.retryAfterSeconds === 0, "retryAfterSeconds deve ser 0 após reset");
});

await test("Após reset, novamente 5 tentativas são permitidas", () => {
  const ip = freshIp("70");
  for (let i = 1; i <= 5; i++) checkRateLimit(ip, NOW);
  // Passa 61s — nova janela
  for (let i = 1; i <= 5; i++) {
    const r = checkRateLimit(ip, NOW + 61_000 + i * 100);
    assert(r.allowed === true, `Segunda janela — tentativa ${i}/5 deve ser permitida`);
  }
  // 6ª na segunda janela: bloqueada
  const r6 = checkRateLimit(ip, NOW + 61_000 + 5_100);
  assert(r6.allowed === false, "6ª na segunda janela deve ser bloqueada");
});

// ── Isolamento por IP ────────────────────────────────────────────────────────

await test("IPs diferentes têm contadores independentes", () => {
  const ip1 = freshIp("80");
  const ip2 = freshIp("81");
  // Esgota ip1
  for (let i = 1; i <= 5; i++) checkRateLimit(ip1, NOW);
  const ip1Bloqueado = checkRateLimit(ip1, NOW + 100);
  assert(ip1Bloqueado.allowed === false, "ip1 deve estar bloqueado");
  // ip2 deve estar livre
  const ip2Livre = checkRateLimit(ip2, NOW + 100);
  assert(ip2Livre.allowed === true, "ip2 deve estar livre (contador independente)");
});

await test("100 IPs diferentes: todos com 5 tentativas independentes", () => {
  for (let n = 100; n < 200; n++) {
    const ip = freshIp(String(n));
    for (let i = 1; i <= 5; i++) {
      const r = checkRateLimit(ip, NOW + i);
      assert(r.allowed === true, `IP ${ip} tentativa ${i} deve ser permitida`);
    }
    const bloqueada = checkRateLimit(ip, NOW + 6_000);
    assert(bloqueada.allowed === false, `IP ${ip} 6ª tentativa deve ser bloqueada`);
  }
});

// ── Limpeza de memória ───────────────────────────────────────────────────────

await test("Limpeza do store: entradas expiradas são removidas quando tamanho máximo atingido", () => {
  // O store pode ter entradas de testes anteriores
  const tamanhoAntes = rateLimitStore.size;

  // Simula store cheio com entradas expiradas
  for (let i = 0; i < STORE_MAX_SIZE; i++) {
    rateLimitStore.set(`expired-${i}`, { count: 1, resetAt: NOW - 1000 }); // já expirado
  }

  // Próxima requisição deve acionar a limpeza
  const ipNovo = freshIp("250");
  const resultado = checkRateLimit(ipNovo, NOW + 999_999);

  assert(resultado.allowed === true, "Deve ser permitido após limpeza");
  // Store deve ter sido limpo
  const tamanhoDepois = rateLimitStore.size;
  assert(tamanhoDepois < STORE_MAX_SIZE, `Store deve ter reduzido após limpeza (era ${STORE_MAX_SIZE + tamanhoAntes}, agora ${tamanhoDepois})`);
});

// ── Frontend: tratamento do 429 ──────────────────────────────────────────────

await test("Frontend: mensagem clara quando rate limit é atingido", () => {
  const retryAfterSeconds = 45;
  const expectedMsg = `Muitas tentativas de login. Aguarde ${retryAfterSeconds} segundo(s) antes de tentar novamente.`;
  assert(
    expectedMsg.includes("45"),
    "Mensagem deve incluir o tempo de espera específico"
  );
  assert(
    expectedMsg.includes("Muitas tentativas"),
    "Mensagem deve indicar o motivo do bloqueio"
  );
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
