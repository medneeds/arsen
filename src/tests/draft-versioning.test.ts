/**
 * TESTE: Versionamento de rascunhos no localStorage
 *
 * Cobre a correção do AntimicrobialGuideDialog:
 *   - Draft com versão correta → restaurado normalmente
 *   - Draft com versão antiga → descartado + toast
 *   - Draft sem versão (formato legado, array direto) → descartado silenciosamente
 *   - Sem draft → inicia limpo
 *   - Save grava com wrapper de versão corretamente
 *   - Chaves legadas são limpas na abertura
 *
 * AdmissionDialog usa key-based versioning (admission_draft:v1:patientId)
 * que é adequado — documentado aqui como teste de conceito.
 *
 * Dados fictícios — zero impacto em produção.
 */

// ── Tipos ────────────────────────────────────────────────────────────

interface AntimicrobialEntry {
  id: string;
  medication: string;
  presentation: string;
  dose: string;
  route: string;
  posology: string;
  startDate: string;
  plannedDuration: string;
  justification: string;
  infectionSite: string;
  cultureCollected: "sim" | "nao" | "pendente";
  cultureResult: string;
  previousAntibiotic: string;
  ccihApproval: "pendente" | "aprovado" | "restrito" | "negado";
  ccihNotes: string;
}

// ── Constantes replicadas do componente ──────────────────────────────

const DRAFT_V = 1;
const PATIENT_ID = "leito-l04-uuid-fake";

const draftKey     = `atb-draft-v${DRAFT_V}-${PATIENT_ID}`;
const autosaveKey  = `${draftKey}-prescribe`;
const legacyKey    = `atb-draft-${PATIENT_ID}`;
const legacyReview = `${legacyKey}-review`;

// ── Mock do localStorage ──────────────────────────────────────────────

const storage: Record<string, string> = {};
const mockLocalStorage = {
  getItem:    (k: string) => storage[k] ?? null,
  setItem:    (k: string, v: string) => { storage[k] = v; },
  removeItem: (k: string) => { delete storage[k]; },
  clear:      () => { Object.keys(storage).forEach(k => delete storage[k]); },
};

// ── Simula readVersionedDraft do componente ───────────────────────────

interface ToastCall { type: "warning" | "success" | "error"; message: string }
const toastCalls: ToastCall[] = [];

function readVersionedDraft(key: string): AntimicrobialEntry[] | null {
  try {
    const raw = mockLocalStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    if (parsed && typeof parsed === "object" && "v" in parsed) {
      if (parsed.v !== DRAFT_V) {
        mockLocalStorage.removeItem(key);
        toastCalls.push({ type: "warning", message: "Rascunho descartado — versão anterior" });
        return null;
      }
      const entries = parsed.entries as AntimicrobialEntry[];
      return Array.isArray(entries) && entries.length > 0 ? entries : null;
    }
    // Formato legado (array direto sem versão)
    mockLocalStorage.removeItem(key);
    return null;
  } catch {
    return null;
  }
}

function saveDraft(key: string, entries: AntimicrobialEntry[]) {
  const versioned = JSON.stringify({ v: DRAFT_V, entries });
  mockLocalStorage.setItem(key, versioned);
}

function clearLegacyKeys() {
  mockLocalStorage.removeItem(legacyKey);
  mockLocalStorage.removeItem(legacyReview);
}

// ── Dado fictício ─────────────────────────────────────────────────────

function entryMeropenem(): AntimicrobialEntry {
  return {
    id: "entry-meropenem-fake",
    medication: "Meropenem",
    presentation: "500mg pó para solução injetável",
    dose: "1g",
    route: "IV",
    posology: "8/8h",
    startDate: "2026-06-04",
    plannedDuration: "7 dias",
    justification: "Sepse de foco abdominal com culturas pendentes",
    infectionSite: "Abdominal",
    cultureCollected: "pendente",
    cultureResult: "",
    previousAntibiotic: "",
    ccihApproval: "pendente",
    ccihNotes: "",
  };
}

function entryVancomicina(): AntimicrobialEntry {
  return {
    id: "entry-vancomicina-fake",
    medication: "Vancomicina",
    presentation: "500mg pó para solução injetável",
    dose: "25mg/kg/dia",
    route: "IV",
    posology: "6/6h",
    startDate: "2026-06-04",
    plannedDuration: "14 dias",
    justification: "MRSA confirmado por hemoculturas",
    infectionSite: "Corrente sanguínea",
    cultureCollected: "sim",
    cultureResult: "MRSA resistente à oxacilina",
    previousAntibiotic: "Oxacilina",
    ccihApproval: "aprovado",
    ccihNotes: "CCIH aprovou via call de 14/06. Ajuste de dose conforme peso.",
  };
}

// ── Infra de teste ────────────────────────────────────────────────────

let passed = 0; let failed = 0;
const results: { group: string; name: string; ok: boolean; details: string }[] = [];
let currentGroup = "";
function group(name: string) { currentGroup = name; }
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }
async function test(name: string, fn: () => void | Promise<void>) {
  mockLocalStorage.clear();
  toastCalls.length = 0;
  try { await fn(); results.push({ group: currentGroup, name, ok: true, details: "ok" }); passed++; }
  catch (e: any) { results.push({ group: currentGroup, name, ok: false, details: e.message }); failed++; }
}

// ══════════════════════════════════════════════════════════════════════

console.log("\n══════════════════════════════════════════════════════");
console.log("  TESTE: Versionamento de rascunhos (localStorage)");
console.log("  Dados fictícios | Zero impacto em produção");
console.log("══════════════════════════════════════════════════════\n");

// ── Grupo 1: AntimicrobialGuideDialog — versão correta ──────────────

group("GRUPO 1 — Draft com versão correta (v=1): restaurado");

await test("Draft v=1 com uma entrada: restaurado normalmente", () => {
  const entries = [entryMeropenem()];
  saveDraft(autosaveKey, entries);
  const restored = readVersionedDraft(autosaveKey);
  assert(restored !== null, "Draft v=1 deve ser restaurado");
  assert(restored!.length === 1, "Deve ter 1 entrada");
  assert(restored![0].medication === "Meropenem", `Medicamento: ${restored![0].medication}`);
  assert(toastCalls.length === 0, "Não deve mostrar toast de aviso");
});

await test("Draft v=1 com duas entradas: todas restauradas", () => {
  const entries = [entryMeropenem(), entryVancomicina()];
  saveDraft(draftKey, entries);
  const restored = readVersionedDraft(draftKey);
  assert(restored !== null, "Draft deve ser restaurado");
  assert(restored!.length === 2, `Deve ter 2 entradas, tem ${restored!.length}`);
  assert(restored![1].medication === "Vancomicina", `Segunda entrada: ${restored![1].medication}`);
});

await test("Draft v=1 com campos de auditoria: ccihApproval e ccihNotes preservados", () => {
  const entries = [entryVancomicina()];
  saveDraft(autosaveKey, entries);
  const restored = readVersionedDraft(autosaveKey);
  assert(restored![0].ccihApproval === "aprovado", "ccihApproval preservado");
  assert(restored![0].ccihNotes.includes("CCIH aprovou"), "ccihNotes preservado");
});

// ── Grupo 2: Versão incompatível → descartado com toast ─────────────

group("GRUPO 2 — Draft com versão antiga (v≠1): descartado + toast");

await test("Draft v=0 (versão anterior): descartado com toast de aviso", () => {
  const oldFormatted = JSON.stringify({ v: 0, entries: [entryMeropenem()] });
  mockLocalStorage.setItem(autosaveKey, oldFormatted);
  const restored = readVersionedDraft(autosaveKey);
  assert(restored === null, "Draft v=0 deve ser descartado");
  assert(toastCalls.length === 1, "Deve mostrar 1 toast de aviso");
  assert(toastCalls[0].type === "warning", "Toast deve ser de aviso (warning)");
});

await test("Draft v=2 (versão futura em ambiente antigo): descartado com toast", () => {
  const futureFormat = JSON.stringify({ v: 2, entries: [entryMeropenem()] });
  mockLocalStorage.setItem(autosaveKey, futureFormat);
  const restored = readVersionedDraft(autosaveKey);
  assert(restored === null, "Draft v=2 em ambiente v=1 deve ser descartado");
  assert(toastCalls.length === 1, "Deve mostrar toast de aviso");
});

await test("Draft descartado é removido do localStorage (não persiste)", () => {
  const oldFormatted = JSON.stringify({ v: 0, entries: [entryMeropenem()] });
  mockLocalStorage.setItem(autosaveKey, oldFormatted);
  readVersionedDraft(autosaveKey);
  // Após descarte, chave deve ter sido removida
  assert(mockLocalStorage.getItem(autosaveKey) === null, "Chave deve ser removida após descarte");
});

// ── Grupo 3: Formato legado (array direto sem versão) ────────────────

group("GRUPO 3 — Draft sem versão (formato legado): descartado silenciosamente");

await test("Array direto (formato legado): descartado sem toast", () => {
  // Formato antigo: entries salvas como array direto sem wrapper
  const legacyFormat = JSON.stringify([entryMeropenem()]);
  mockLocalStorage.setItem(autosaveKey, legacyFormat);
  const restored = readVersionedDraft(autosaveKey);
  assert(restored === null, "Formato legado deve ser descartado");
  assert(toastCalls.length === 0, "Formato legado descarta silenciosamente (sem toast)");
});

await test("Array legado é removido do localStorage", () => {
  mockLocalStorage.setItem(draftKey, JSON.stringify([entryVancomicina()]));
  readVersionedDraft(draftKey);
  assert(mockLocalStorage.getItem(draftKey) === null, "Chave legada removida após descarte");
});

// ── Grupo 4: Sem draft → inicia limpo ────────────────────────────────

group("GRUPO 4 — Sem draft no localStorage: retorna null");

await test("Sem draft: readVersionedDraft retorna null", () => {
  const result = readVersionedDraft(autosaveKey);
  assert(result === null, "Sem draft deve retornar null");
  assert(toastCalls.length === 0, "Sem toast quando não há draft");
});

await test("Draft com JSON inválido: retorna null sem crash", () => {
  mockLocalStorage.setItem(autosaveKey, "{ invalid json {{");
  const result = readVersionedDraft(autosaveKey);
  assert(result === null, "JSON inválido deve retornar null sem crash");
});

await test("Draft com entries vazias: retorna null", () => {
  mockLocalStorage.setItem(autosaveKey, JSON.stringify({ v: DRAFT_V, entries: [] }));
  const result = readVersionedDraft(autosaveKey);
  assert(result === null, "Entries vazio deve retornar null (não restaura)");
});

// ── Grupo 5: Save grava com versão correta ────────────────────────────

group("GRUPO 5 — Save grava wrapper de versão corretamente");

await test("saveDraft grava { v: 1, entries: [...] } no localStorage", () => {
  const entries = [entryMeropenem()];
  saveDraft(autosaveKey, entries);
  const raw = mockLocalStorage.getItem(autosaveKey);
  assert(raw !== null, "Draft deve estar salvo");
  const parsed = JSON.parse(raw!);
  assert(parsed.v === DRAFT_V, `Versão deve ser ${DRAFT_V}, está ${parsed.v}`);
  assert(Array.isArray(parsed.entries), "entries deve ser array");
  assert(parsed.entries.length === 1, "Deve ter 1 entrada");
  assert(parsed.entries[0].medication === "Meropenem", "Medicamento correto");
});

await test("Dado salvo pode ser restaurado pelo readVersionedDraft", () => {
  const entries = [entryMeropenem(), entryVancomicina()];
  saveDraft(draftKey, entries);
  const restored = readVersionedDraft(draftKey);
  assert(restored !== null, "Deve restaurar o que foi salvo");
  assert(restored!.length === 2, "Deve ter 2 entradas");
  assert(restored![0].medication === "Meropenem", "Primeira entrada correta");
  assert(restored![1].ccihApproval === "aprovado", "Segunda entrada correta");
});

// ── Grupo 6: Limpeza de chaves legadas ───────────────────────────────

group("GRUPO 6 — Chaves legadas removidas na abertura do dialog");

await test("clearLegacyKeys remove atb-draft-{id} e atb-draft-{id}-review", () => {
  mockLocalStorage.setItem(legacyKey,    JSON.stringify([entryMeropenem()]));
  mockLocalStorage.setItem(legacyReview, JSON.stringify([entryVancomicina()]));
  clearLegacyKeys();
  assert(mockLocalStorage.getItem(legacyKey) === null,    "Chave legada principal removida");
  assert(mockLocalStorage.getItem(legacyReview) === null, "Chave legada review removida");
});

await test("clearLegacyKeys não afeta chaves versionadas", () => {
  saveDraft(draftKey, [entryMeropenem()]);
  clearLegacyKeys();
  assert(mockLocalStorage.getItem(draftKey) !== null, "Chave versionada não deve ser removida");
});

// ── Grupo 7: AdmissionDialog — key-based versioning ──────────────────

group("GRUPO 7 — AdmissionDialog: key-based versioning (documentação)");

await test("Chave admission_draft:v1: isola drafts por versão do schema", () => {
  const key_v1 = `admission_draft:v1:${PATIENT_ID}`;
  const key_v2 = `admission_draft:v2:${PATIENT_ID}`;

  // Salva um draft v1
  mockLocalStorage.setItem(key_v1, JSON.stringify({ hda: "Paciente admitido com dispneia" }));

  // v2 não existe — carregamento de v2 retorna null (draft antigo ignorado automaticamente)
  const rawV2 = mockLocalStorage.getItem(key_v2);
  assert(rawV2 === null, "Draft v1 não é visível para quem busca v2 (chaves diferentes)");

  // v1 ainda carrega normalmente
  const rawV1 = mockLocalStorage.getItem(key_v1);
  assert(rawV1 !== null, "Draft v1 ainda é acessível via sua própria chave");
  const parsed = JSON.parse(rawV1!);
  assert(parsed.hda === "Paciente admitido com dispneia", "Conteúdo do draft v1 preservado");
});

await test("Bump de versão da chave descarta draft automaticamente (usuário começa com form limpo)", () => {
  // Simula: schema mudou, versão vai de v1 para v2
  const OLD_KEY = `admission_draft:v1:${PATIENT_ID}`;
  const NEW_KEY = `admission_draft:v2:${PATIENT_ID}`;

  // Usuário tinha draft v1
  mockLocalStorage.setItem(OLD_KEY, JSON.stringify({ hda: "Dados da versão antiga" }));

  // Sistema atualizado busca v2 → não encontra → form limpo
  const rawV2 = mockLocalStorage.getItem(NEW_KEY);
  assert(rawV2 === null, "Draft v1 não polui o carregamento de v2");

  // O draft v1 permanece no browser (pode ser limpo explicitamente, não causa dano)
  const rawV1 = mockLocalStorage.getItem(OLD_KEY);
  assert(rawV1 !== null, "Draft v1 ainda existe no storage mas é inerte");
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
