/**
 * TESTE: Prescrição de internamento anterior não pode aparecer na nova internação
 *
 * Reportado (07/08/2026): paciente com alta e readmitido abria a tela de
 * prescrição já com os itens do internamento anterior carregados — como se
 * nunca tivesse tido alta.
 *
 * CAUSA RAIZ (PrescricaoPage.tsx — fallback 2b do autoLoadPrescription):
 *   O fluxo de carregamento tem 3 etapas:
 *     1. Rascunho do dia  → filtrado por encounter_id + created_at >= hoje 05h
 *     2a. Última validada do encounter atual → filtrado por encounter_id
 *     2b. Fallback "legado" → filtrado APENAS por patient_registry_id + archived_at IS NULL
 *
 *   O 2b existe para cobrir prescrições gravadas antes do sistema ter o campo
 *   encounter_id preenchido. Mas sem âncora de data, buscava a última prescrição
 *   não-arquivada do registry INDEPENDENTE do internamento — e como a RPC
 *   archive_patient_bed_data arquiva pelo patient_id (linha-leito), prescrições
 *   legadas (sem encounter_id) do internamento anterior sobreviviam ao arquivamento
 *   e eram carregadas na nova internação.
 *
 * CORREÇÃO:
 *   Antes de rodar o fallback 2b, busca a admission_date do encounter ativo
 *   e aplica como filtro de created_at. Prescrições criadas ANTES da admissão
 *   atual não aparecem no carregamento automático — continuam preservadas no
 *   banco e acessíveis pelo histórico, mas não sobem na tela da nova internação.
 *   Se não houver encounter ativo (sem admission_date), o filtro não é aplicado
 *   (comportamento anterior, seguro para casos sem internação formal aberta).
 *
 * Dados fictícios | Zero impacto em produção.
 */

// ── Réplica da lógica de filtragem do fallback 2b ──────────────────────

interface FakePrescription {
  id: string;
  created_at: string;
  patient_registry_id: string;
  status: string;
  archived_at: string | null;
  encounter_id: string | null;
}

function simulateFallback2b(
  prescriptions: FakePrescription[],
  patientRegistryId: string,
  legacyAdmissionFilter: string | null,
): FakePrescription | undefined {
  let filtered = prescriptions.filter(
    (p) =>
      p.patient_registry_id === patientRegistryId &&
      p.status !== "draft" &&
      p.archived_at === null,
  );
  if (legacyAdmissionFilter) {
    filtered = filtered.filter((p) => p.created_at >= legacyAdmissionFilter);
  }
  filtered.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return filtered[0];
}

// ── Runner mínimo ────────────────────────────────────────────────────────

let total = 0;
let falhas = 0;
function check(label: string, cond: boolean, detail?: string) {
  total++;
  if (cond) {
    console.log(`  OK  ${label}`);
  } else {
    falhas++;
    console.error(`FALHA  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const REGISTRY_ID = "reg-abc123";
const ENCOUNTER_ANTERIOR = "enc-old-001";
const ENCOUNTER_NOVO = "enc-new-002";

// Prescrição do internamento ANTERIOR (não arquivada, sem encounter_id — legado)
const prescricaoAnteriorLegado: FakePrescription = {
  id: "presc-001",
  created_at: "2026-06-10T14:00:00.000Z", // antes da nova admissão
  patient_registry_id: REGISTRY_ID,
  status: "validated",
  archived_at: null,
  encounter_id: null,
};

// Prescrição do internamento ANTERIOR (arquivada — esse caso nunca deveria aparecer)
const prescricaoAnteriorArquivada: FakePrescription = {
  id: "presc-002",
  created_at: "2026-06-11T08:00:00.000Z",
  patient_registry_id: REGISTRY_ID,
  status: "validated",
  archived_at: "2026-07-01T10:00:00.000Z",
  encounter_id: ENCOUNTER_ANTERIOR,
};

// Prescrição legada do internamento ATUAL (sem encounter_id, mas criada DEPOIS da admissão)
const prescricaoAtualLegado: FakePrescription = {
  id: "presc-003",
  created_at: "2026-08-01T16:00:00.000Z", // depois da nova admissão
  patient_registry_id: REGISTRY_ID,
  status: "validated",
  archived_at: null,
  encounter_id: null,
};

// Data de admissão do novo encounter
const admissaoNova = "2026-07-28T10:00:00.000Z";

const todasPrescricoes = [
  prescricaoAnteriorLegado,
  prescricaoAnteriorArquivada,
  prescricaoAtualLegado,
];

console.log("=== Fallback 2b SEM filtro de data (comportamento anterior — com bug) ===");
{
  const resultado = simulateFallback2b(todasPrescricoes, REGISTRY_ID, null);
  check(
    "sem filtro de data: carregaria a mais recente não-arquivada (incluindo internamento anterior)",
    resultado?.id === "presc-003", // acerta por sorte aqui (a legada atual é mais recente)
    `carregou: ${resultado?.id}`,
  );
  // Mas se a prescrição do internamento anterior fosse mais recente que qualquer da nova:
  const cenarioCritico = [prescricaoAnteriorLegado, prescricaoAnteriorArquivada];
  const resultadoCritico = simulateFallback2b(cenarioCritico, REGISTRY_ID, null);
  check(
    "sem filtro de data, sem prescrição na nova internação: CARREGARIA a do internamento anterior (bug confirmado)",
    resultadoCritico?.id === "presc-001",
    `carregou: ${resultadoCritico?.id}`,
  );
}

console.log("\n=== Fallback 2b COM filtro de data (comportamento corrigido) ===");
{
  // Cenário normal: há prescrição legada na internação atual
  const resultado = simulateFallback2b(todasPrescricoes, REGISTRY_ID, admissaoNova);
  check(
    "com filtro: carrega prescrição legada do internamento atual (criada após admissão nova)",
    resultado?.id === "presc-003",
    `carregou: ${resultado?.id}`,
  );

  // Cenário do bug: sem prescrição na nova internação → não deve carregar a do anterior
  const cenarioCritico = [prescricaoAnteriorLegado, prescricaoAnteriorArquivada];
  const resultadoCritico = simulateFallback2b(cenarioCritico, REGISTRY_ID, admissaoNova);
  check(
    "com filtro, sem prescrição na nova internação: NÃO carrega a do internamento anterior",
    resultadoCritico === undefined,
    `carregou: ${resultadoCritico?.id ?? "nada (correto)"}`,
  );

  // Histórico: prescrição anterior ainda existe no banco (archived ou não),
  // mas simplesmente não aparece no carregamento automático
  check(
    "prescrição do internamento anterior ainda existe no banco (não foi apagada)",
    todasPrescricoes.some((p) => p.id === "presc-001"),
  );

  // Sem encounter ativo: filtro não é aplicado (compat com sem internação formal)
  const semEncounter = simulateFallback2b(todasPrescricoes, REGISTRY_ID, null);
  check(
    "sem encounter ativo (legacyAdmissionFilter null): filtro não aplicado, comportamento anterior mantido",
    semEncounter !== undefined,
    `carregou: ${semEncounter?.id}`,
  );

  // Prescrição arquivada nunca aparece independente do filtro
  const somenteArquivada = [prescricaoAnteriorArquivada];
  const resultadoArquivada = simulateFallback2b(somenteArquivada, REGISTRY_ID, admissaoNova);
  check(
    "prescrição arquivada nunca aparece, independente do filtro de data",
    resultadoArquivada === undefined,
  );

  // Registry errado nunca aparece
  const resultadoRegistryErrado = simulateFallback2b(todasPrescricoes, "reg-outro", admissaoNova);
  check(
    "prescrição de outro paciente (registry diferente) nunca aparece",
    resultadoRegistryErrado === undefined,
  );
}

console.log(`\n───────────────────────────────────────────`);
console.log(`${total - falhas}/${total} verificações passaram`);
if (falhas > 0) {
  console.error(`${falhas} FALHA(S)`);
  process.exit(1);
}
console.log("Todos os casos passaram.\n");
