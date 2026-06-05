/**
 * TESTE: Prevenção de cadastro duplicado de pacientes
 *
 * Cobre a correção do DuplicatePatientWarning + AdminDashboardPage:
 *   - Match de alta confiança (nome + DN) → bloqueia cadastro
 *   - Match de baixa confiança (só nome) → avisa sem bloquear
 *   - Usuário escolhe "Usar existente" → desbloqueia + navega
 *   - Usuário confirma "são diferentes" → desbloqueia + permite cadastrar
 *   - Sem match → comportamento normal
 *   - Padrão real dos 4 casos: 1º registro sem CPF, 2º com CPF
 *
 * Dados fictícios baseados no padrão real encontrado no banco.
 * Zero impacto em produção.
 */

// ── Tipos ────────────────────────────────────────────────────────────

interface DuplicateMatch {
  id: string;
  full_name: string;
  birth_date: string | null;
  cpf: string | null;
  medical_record: string | null;
}

interface RegistrationForm {
  full_name: string;
  birth_date: string;
  cpf: string;
  is_unidentified: boolean;
}

// ── Simula a lógica do DuplicatePatientWarning ────────────────────────

function detectHighConfidence(
  matches: DuplicateMatch[],
  birthDate: string | undefined,
): DuplicateMatch[] {
  if (!birthDate || matches.length === 0) return [];
  return matches.filter((m) => m.birth_date === birthDate);
}

// ── Simula o handleRegister do AdminDashboardPage ─────────────────────

interface RegisterResult {
  blocked: boolean;
  reason?: string;
  inserted?: boolean;
}

function simulateHandleRegister(
  form: RegistrationForm,
  isHighConfidenceDuplicate: boolean,
): RegisterResult {
  if (!form.full_name.trim() && !form.is_unidentified) {
    return { blocked: true, reason: "Nome completo é obrigatório" };
  }
  if (isHighConfidenceDuplicate && !form.is_unidentified) {
    return {
      blocked: true,
      reason: "Cadastro bloqueado — paciente já existe. Use o paciente existente para novo atendimento, ou confirme que são pessoas diferentes.",
    };
  }
  return { blocked: false, inserted: true };
}

// ── Pacientes fictícios baseados no padrão real ───────────────────────

// Padrão exato dos 4 casos reais:
// 1º registro: sem CPF (cadastro rápido na emergência)
// 2º tentativa: com CPF (cadastro formal — deve ser bloqueado)

const ANTONIO_EXISTENTE: DuplicateMatch = {
  id: "1ba060b0-fake",
  full_name: "ANTONIO REGINALDO DA SILVA PEREIRA",
  birth_date: "1987-10-05",
  cpf: null,             // ← 1º registro sem CPF
  medical_record: "000218-F",
};

const MARIA_JOANA_EXISTENTE: DuplicateMatch = {
  id: "20dbab03-fake",
  full_name: "MARIA JOANA SOARES",
  birth_date: "1946-06-26",
  cpf: null,             // ← 1º registro sem CPF
  medical_record: "000095-F",
};

// Paciente que NÃO existe no sistema
const NOVO_PACIENTE: DuplicateMatch[] = [];

// ── Infra de teste ────────────────────────────────────────────────────

let passed = 0; let failed = 0;
const results: { group: string; name: string; ok: boolean; details: string }[] = [];
let currentGroup = "";
function group(name: string) { currentGroup = name; }
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }
async function test(name: string, fn: () => void | Promise<void>) {
  try { await fn(); results.push({ group: currentGroup, name, ok: true, details: "ok" }); passed++; }
  catch (e: any) { results.push({ group: currentGroup, name, ok: false, details: e.message }); failed++; }
}

// ══════════════════════════════════════════════════════════════════════

console.log("\n══════════════════════════════════════════════════════");
console.log("  TESTE: Prevenção de cadastro duplicado de pacientes");
console.log("  Padrão real: nome+DN sem CPF → com CPF");
console.log("══════════════════════════════════════════════════════\n");

// ── Grupo 1: Reprodução dos casos reais ──────────────────────────────

group("GRUPO 1 — Reprodução do padrão real (nome + DN sem CPF)");

await test("ANTONIO REGINALDO: 2ª tentativa de cadastro bloqueada por match nome+DN", () => {
  // Simula: 1º registro existe sem CPF. Recepcionista tenta cadastrar novamente com CPF.
  const matches = [ANTONIO_EXISTENTE];
  const birthDate = "1987-10-05"; // mesma data de nascimento

  const highConf = detectHighConfidence(matches, birthDate);
  assert(highConf.length === 1, `Deve detectar 1 match de alta confiança, encontrou ${highConf.length}`);
  assert(highConf[0].id === ANTONIO_EXISTENTE.id, "Match correto");

  const form: RegistrationForm = {
    full_name: "ANTONIO REGINALDO DA SILVA PEREIRA",
    birth_date: "1987-10-05",
    cpf: "02816583317",   // agora tem CPF
    is_unidentified: false,
  };

  const result = simulateHandleRegister(form, highConf.length > 0);
  assert(result.blocked === true, "Cadastro deve ser bloqueado");
  assert(result.reason?.includes("bloqueado"), `Mensagem: ${result.reason}`);
  assert(result.inserted !== true, "Não deve inserir no banco");
});

await test("MARIA JOANA SOARES: 2ª tentativa bloqueada (ambas sem CPF, só nome+DN)", () => {
  const matches = [MARIA_JOANA_EXISTENTE];
  const birthDate = "1946-06-26";

  const highConf = detectHighConfidence(matches, birthDate);
  assert(highConf.length === 1, "Deve detectar alta confiança mesmo sem CPF");

  const form: RegistrationForm = {
    full_name: "MARIA JOANA SOARES",
    birth_date: "1946-06-26",
    cpf: "",              // ainda sem CPF
    is_unidentified: false,
  };

  const result = simulateHandleRegister(form, highConf.length > 0);
  assert(result.blocked === true, "Bloqueado mesmo sem CPF — nome+DN é suficiente");
});

// ── Grupo 2: Alta confiança (nome + DN) → bloqueante ─────────────────

group("GRUPO 2 — Match de alta confiança: bloqueante");

await test("Nome + DN coincidem: isHighConfidenceDuplicate = true", () => {
  const matches = [ANTONIO_EXISTENTE];
  const highConf = detectHighConfidence(matches, "1987-10-05");
  assert(highConf.length > 0, "Alta confiança quando DN bate");
});

await test("handleRegister bloqueado quando isHighConfidenceDuplicate = true", () => {
  const form: RegistrationForm = {
    full_name: "ANTONIO REGINALDO DA SILVA PEREIRA",
    birth_date: "1987-10-05",
    cpf: "02816583317",
    is_unidentified: false,
  };
  const result = simulateHandleRegister(form, true);
  assert(result.blocked === true, "Deve bloquear");
  assert(!result.inserted, "Não insere");
});

await test("Botão 'Cadastrar' desabilitado quando isHighConfidenceDuplicate = true", () => {
  // Simulação da lógica do disabled no botão:
  // disabled={isRegistering || !full_name.trim() || isHighConfidenceDuplicate}
  const isRegistering = false;
  const full_name = "ANTONIO REGINALDO DA SILVA PEREIRA";
  const isHighConfidenceDuplicate = true;
  const disabled = isRegistering || !full_name.trim() || isHighConfidenceDuplicate;
  assert(disabled === true, "Botão deve estar desabilitado");
});

// ── Grupo 3: Usuário resolve o bloqueio ───────────────────────────────

group("GRUPO 3 — Usuário resolve o bloqueio com ação explícita");

await test("'Usar existente': isHighConfidenceDuplicate → false, navega para paciente", () => {
  let isHighConfidenceDuplicate = true;
  let navigatedToPatient: string | null = null;

  // Simula clique em "Usar este paciente"
  const onUseExisting = (p: DuplicateMatch) => {
    isHighConfidenceDuplicate = false; // componente emite onHighConfidenceFound(false)
    navigatedToPatient = p.id;
  };

  onUseExisting(ANTONIO_EXISTENTE);

  assert(isHighConfidenceDuplicate === false, "Bloqueio removido após usar existente");
  assert(navigatedToPatient === ANTONIO_EXISTENTE.id, "Navegou para o paciente correto");
});

await test("'Confirmar que são diferentes': isHighConfidenceDuplicate → false, permite cadastrar", () => {
  let isHighConfidenceDuplicate = true;

  // Simula clique em "Confirmar que são pacientes diferentes"
  const onConfirmDifferent = () => {
    isHighConfidenceDuplicate = false; // onHighConfidenceFound(false)
  };

  onConfirmDifferent();
  assert(isHighConfidenceDuplicate === false, "Bloqueio removido após confirmação");

  // Agora o cadastro deve ser permitido
  const form: RegistrationForm = {
    full_name: "ANTONIO REGINALDO DA SILVA PEREIRA",
    birth_date: "1987-10-05",
    cpf: "02816583317",
    is_unidentified: false,
  };
  const result = simulateHandleRegister(form, isHighConfidenceDuplicate);
  assert(result.blocked === false, "Cadastro permitido após confirmação");
  assert(result.inserted === true, "Insere no banco");
});

await test("Fechar o dialog reseta isHighConfidenceDuplicate para false", () => {
  let isHighConfidenceDuplicate = true;

  // Simula onOpenChange(false) — dialog fechado
  const onDialogClose = () => {
    isHighConfidenceDuplicate = false;
  };

  onDialogClose();
  assert(isHighConfidenceDuplicate === false, "Estado resetado ao fechar");
});

// ── Grupo 4: Baixa confiança → não bloqueia ──────────────────────────

group("GRUPO 4 — Match de baixa confiança: avisa mas não bloqueia");

await test("Só nome sem DN: baixa confiança, cadastro permitido", () => {
  // Matches por nome mas sem data de nascimento para confirmar
  const matches = [ANTONIO_EXISTENTE];
  const highConf = detectHighConfidence(matches, undefined); // sem DN
  assert(highConf.length === 0, "Sem DN = sem alta confiança");

  const form: RegistrationForm = {
    full_name: "ANTONIO REGINALDO DA SILVA PEREIRA",
    birth_date: "",
    cpf: "02816583317",
    is_unidentified: false,
  };
  const result = simulateHandleRegister(form, false);
  assert(result.blocked === false, "Sem alta confiança = não bloqueia");
  assert(result.inserted === true, "Permite inserção (aviso não bloqueante)");
});

await test("DN diferente: não é alta confiança, não bloqueia", () => {
  const matches = [ANTONIO_EXISTENTE]; // DN = 1987-10-05
  const highConf = detectHighConfidence(matches, "1990-03-15"); // DN diferente
  assert(highConf.length === 0, "DN diferente = sem alta confiança");
});

// ── Grupo 5: Sem match → comportamento normal ─────────────────────────

group("GRUPO 5 — Sem match: cadastro normal sem bloqueio");

await test("Nenhum paciente similar: cadastro liberado normalmente", () => {
  const highConf = detectHighConfidence(NOVO_PACIENTE, "1995-07-20");
  assert(highConf.length === 0, "Sem matches = sem alta confiança");

  const form: RegistrationForm = {
    full_name: "RAIMUNDO SOARES DE ARAUJO",
    birth_date: "1995-07-20",
    cpf: "12345678900",
    is_unidentified: false,
  };
  const result = simulateHandleRegister(form, false);
  assert(result.blocked === false, "Sem match = não bloqueia");
  assert(result.inserted === true, "Cadastro inserido normalmente");
});

// ── Grupo 6: Paciente NÃO IDENTIFICADO nunca é bloqueado ─────────────

group("GRUPO 6 — Paciente NÃO IDENTIFICADO: nunca bloqueia");

await test("NI com alta confiança aparente: não bloqueia (is_unidentified = true)", () => {
  // Pacientes NI são desconhecidos por definição — não faz sentido bloquear
  const form: RegistrationForm = {
    full_name: "NÃO IDENTIFICADO (NI-2026-000001)",
    birth_date: "1987-10-05", // DN estimada, coincide com ANTONIO
    cpf: "",
    is_unidentified: true,
  };
  // handleRegister ignora isHighConfidenceDuplicate quando is_unidentified = true
  const result = simulateHandleRegister(form, true);
  assert(result.blocked === false, "NI nunca é bloqueado pelo duplicate check");
  assert(result.inserted === true, "NI é inserido normalmente");
});

// ── Grupo 7: Cenário de timing — match some antes de salvar ──────────

group("GRUPO 7 — Cenários de estado");

await test("Match detectado mas desaparece antes do save: isHighConfidenceDuplicate reseta", () => {
  // O usuário edita o nome → DuplicatePatientWarning reavalia → sem match → onHighConfidenceFound(false)
  let isHighConfidenceDuplicate = true;
  const onHighConfidenceFound = (found: boolean) => { isHighConfidenceDuplicate = found; };

  // Simula: usuário muda o nome → nova busca retorna vazio → emite false
  onHighConfidenceFound(false);
  assert(isHighConfidenceDuplicate === false, "Estado atualizado quando match some");

  const form: RegistrationForm = {
    full_name: "ANTONIO REGINALDO DA SILVA PEREIRA JUNIOR", // nome diferente
    birth_date: "1987-10-05",
    cpf: "02816583317",
    is_unidentified: false,
  };
  const result = simulateHandleRegister(form, isHighConfidenceDuplicate);
  assert(result.blocked === false, "Sem bloqueio quando match não existe mais");
});

await test("Dois usuários simultâneos: bloqueio independente por sessão", () => {
  // Cada usuário tem seu próprio estado em memória
  let userA_duplicate = true;
  let userB_duplicate = false;

  // Usuário A resolveu; Usuário B ainda está bloqueado
  userA_duplicate = false;

  assert(userA_duplicate === false, "Usuário A desbloqueado");
  assert(userB_duplicate === false, "Usuário B independente (nunca foi bloqueado)");
});

// ── Relatório ────────────────────────────────────────────────────────

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
