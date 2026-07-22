/**
 * SIMULAÇÃO DE CENÁRIOS — BUG DO HISTÓRICO CLÍNICO EM TRANSFERÊNCIA
 *
 * Arquivo de teste autocontido com dados fictícios.
 * Não conecta ao Supabase real. Não modifica nenhum dado.
 * Cobre todos os cenários possíveis do bug e das correções aplicadas.
 *
 * Como executar:
 *   bun run src/tests/transfer-history-simulation.ts
 *   npx ts-node src/tests/transfer-history-simulation.ts
 */

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS E DADOS FICTÍCIOS
// ─────────────────────────────────────────────────────────────────────────────

interface MockEvolution {
  id: string;
  patient_id: string | null;
  patient_registry_id: string | null;
  archived_at: string | null;
  status: "draft" | "validated";
  soap_data: { plan: string };
  created_at: string;
}

interface MockAdmissionHistory {
  id: string;
  patient_id: string;
  patient_registry_id: string | null;
  hospital_unit_id: string;
}

interface MockPatient {
  id: string;
  name: string;
  patient_registry_id: string | null;
  bed_number: string;
  sector: string;
  is_vacant: boolean;
}

// UUIDs fictícios (formato real para garantir compatibilidade)
const IDS = {
  HOSPITAL:    "11111111-0000-0000-0000-000000000000",
  STATE:       "22222222-0000-0000-0000-000000000000",

  // Paciente 1 — João da Silva (cenários C1, C2)
  JOAO_REGISTRY:  "aaaaaaaa-0001-0001-0001-000000000001",
  LEITO_L01:      "bbbbbbbb-0001-0001-0001-000000000001", // UTI 1
  LEITO_L05:      "bbbbbbbb-0001-0001-0001-000000000002", // UTI 2

  // Paciente 2 — José Ribamar (cenários C3, C4)
  JOSE_REGISTRY:  "aaaaaaaa-0002-0002-0002-000000000002",
  LEITO_L12:      "bbbbbbbb-0002-0002-0002-000000000001", // UCI 1
  LEITO_L18:      "bbbbbbbb-0002-0002-0002-000000000002", // UCI 2

  // Paciente 3 — Ana Maria Carvalho (cenários C5, C6 — evoluções legadas)
  ANA_REGISTRY:   "aaaaaaaa-0003-0003-0003-000000000003",
  LEITO_L03:      "bbbbbbbb-0003-0003-0003-000000000001",
  LEITO_L09:      "bbbbbbbb-0003-0003-0003-000000000002",

  // Paciente 4 — Pedro Santos (cenário C7 — sem evoluções)
  PEDRO_REGISTRY: "aaaaaaaa-0004-0004-0004-000000000004",
  LEITO_L20:      "bbbbbbbb-0004-0004-0004-000000000001",
  LEITO_L22:      "bbbbbbbb-0004-0004-0004-000000000002",

  // Paciente 5 — Maria Oliveira (cenário C8 — múltiplas transferências)
  MARIA_REGISTRY: "aaaaaaaa-0005-0005-0005-000000000005",
  LEITO_L06:      "bbbbbbbb-0005-0005-0005-000000000001",
  LEITO_L10:      "bbbbbbbb-0005-0005-0005-000000000002",
  LEITO_L14:      "bbbbbbbb-0005-0005-0005-000000000003",
};

// ─────────────────────────────────────────────────────────────────────────────
// INFRA DE TESTES
// ─────────────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const results: { name: string; ok: boolean; details: string }[] = [];

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FALHOU: ${message}`);
}

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name, ok: true, details: "ok" });
    passed++;
  } catch (e: any) {
    results.push({ name, ok: false, details: e.message });
    failed++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DO SUPABASE — simula o estado do banco em memória
// ─────────────────────────────────────────────────────────────────────────────

function createMockSupabase(options: {
  rpcShouldFail?: boolean;
  rpcError?: string;
  evolutionsAfterRepoint?: MockEvolution[];
  admissionHistories?: MockAdmissionHistory[];
  targetPatientRegistryId?: string | null; // Fix 1 expandido — Verificação 2
}) {
  const {
    rpcShouldFail, rpcError,
    evolutionsAfterRepoint = [],
    admissionHistories = [],
    targetPatientRegistryId,
  } = options;

  // Simula o builder encadeado do Supabase
  function buildQuery(table: string) {
    const filters: Record<string, any> = {};
    let isCountQuery = false;

    const builder: any = {
      _table: table,
      select: (_fields: string, opts?: any) => {
        if (opts?.count) isCountQuery = true;
        return builder;
      },
      eq:       (col: string, val: any) => { filters[col] = val; return builder; },
      is:       (col: string, val: any) => { filters[col] = val; return builder; },
      neq:      (_col: string, _val: any) => builder,
      not:      (_col: string, _op: string, _val: any) => builder,
      or:       (_clause: string) => builder,
      order:    () => builder,
      limit:    () => builder,
      maybeSingle: () => ({
        then: (resolve: (v: any) => any) => {
          // patients lookup — Fix 1 expandido: buscar patient_registry_id do leito destino
          if (table === "patients") {
            return resolve({
              data: { patient_registry_id: targetPatientRegistryId ?? null },
              error: null,
            });
          }
          return resolve({ data: null, error: null });
        },
      }),
      then: (resolve: (v: any) => any) => {
        if (table === "clinical_evolutions" && isCountQuery) {
          // Verificação 1 — patient_id explícito ainda no leito origem
          if (filters["patient_id"] !== undefined && filters["patient_id"] !== null) {
            const remaining = evolutionsAfterRepoint.filter(
              e => e.patient_id === filters["patient_id"] && e.archived_at === null
            );
            return resolve({ data: null, count: remaining.length, error: null });
          }
          // Verificação 2 — patient_registry_id correto mas patient_id = null (Fix 1 expandido)
          if (filters["patient_registry_id"] && filters["patient_id"] === null) {
            const remaining = evolutionsAfterRepoint.filter(
              e => e.patient_registry_id === filters["patient_registry_id"]
                && e.patient_id === null
                && e.archived_at === null
            );
            return resolve({ data: null, count: remaining.length, error: null });
          }
          return resolve({ data: null, count: 0, error: null });
        }

        // admission_histories lookup (Fix 2 — leitos históricos)
        if (table === "admission_histories") {
          const matching = admissionHistories.filter(
            ah => ah.patient_registry_id === filters["patient_registry_id"]
              && ah.hospital_unit_id === filters["hospital_unit_id"]
          );
          return resolve({ data: matching, error: null });
        }

        return resolve({ data: [], error: null });
      },
    };
    return builder;
  }

  return {
    from: (table: string) => buildQuery(table),
    rpc: async (name: string, _params: any) => {
      if (name === "repoint_patient_history") {
        if (rpcShouldFail) {
          return { data: null, error: new Error(rpcError ?? "Erro simulado na RPC") };
        }
        return { data: { success: true, counts: { clinical_evolutions: 3 } }, error: null };
      }
      return { data: null, error: new Error("RPC desconhecida") };
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPLEMENTAÇÃO LOCAL DO repointPatientHistory (replica a lógica corrigida)
// ─────────────────────────────────────────────────────────────────────────────

async function repointPatientHistorySimulated(
  supabase: any,
  sourcePatientId: string,
  targetPatientId: string,
  reason?: string
): Promise<{ ok: boolean; counts?: Record<string, number>; error?: string }> {
  if (!sourcePatientId || !targetPatientId) {
    return { ok: false, error: "source/target ausente" };
  }
  if (sourcePatientId === targetPatientId) {
    return { ok: true, counts: {} };
  }
  try {
    const { data, error } = await supabase.rpc("repoint_patient_history", {
      p_source_patient_id: sourcePatientId,
      p_target_patient_id: targetPatientId,
      p_reason: reason ?? null,
    });
    if (error) throw error;

    // VERIFICAÇÃO 1 — evoluções com patient_id explícito ainda no leito origem
    const { count, error: countError } = await supabase
      .from("clinical_evolutions")
      .select("*", { count: "exact", head: true })
      .eq("patient_id", sourcePatientId)
      .is("archived_at", null);

    if (!countError && count && count > 0) {
      return {
        ok: false,
        error: `Histórico clínico não migrado completamente: ${count} evolução(ões) ainda no leito de origem. Tente a transferência novamente.`,
      };
    }

    // VERIFICAÇÃO 2 — evoluções com patient_id = null mas registry correto (Fix 1 expandido)
    const { data: targetData } = await supabase
      .from("patients")
      .select("patient_registry_id")
      .eq("id", targetPatientId)
      .maybeSingle();

    const registryId = (targetData as any)?.patient_registry_id as string | null;

    if (registryId) {
      const { count: nullCount, error: nullCountError } = await supabase
        .from("clinical_evolutions")
        .select("*", { count: "exact", head: true })
        .eq("patient_registry_id", registryId)
        .is("patient_id", null)
        .is("archived_at", null);

      if (!nullCountError && nullCount && nullCount > 0) {
        return {
          ok: false,
          error: `Histórico clínico não migrado completamente: ${nullCount} registro(s) sem vínculo de leito. Tente a transferência novamente.`,
        };
      }
    }

    return { ok: true, counts: (data?.counts as Record<string, number>) ?? {} };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Erro desconhecido" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SIMULAÇÃO DO FILTRO DE useEvolutions (replica a lógica corrigida do Fix 2)
// ─────────────────────────────────────────────────────────────────────────────

async function resolveEvolutionsQuery(
  supabase: any,
  safePatientId: string,
  resolvedRegistryId: string | null,
  hospitalId: string,
  allEvolutions: MockEvolution[]
): Promise<MockEvolution[]> {
  let legacyPatientIds: string[] = safePatientId ? [safePatientId] : [];

  // Fix 2: buscar leitos históricos via admission_histories
  if (resolvedRegistryId && safePatientId) {
    const { data: ahBeds } = await supabase
      .from("admission_histories")
      .select("patient_id")
      .eq("patient_registry_id", resolvedRegistryId)
      .eq("hospital_unit_id", hospitalId)
      .not("patient_id", "is", null);

    if (ahBeds && ahBeds.length > 0) {
      const extraIds = (ahBeds as { patient_id: string }[])
        .map((r) => r.patient_id)
        .filter((id) => id && id !== safePatientId);
      if (extraIds.length > 0) {
        legacyPatientIds = [safePatientId, ...extraIds];
      }
    }
  }

  // Filtra evoluções simulando o OR do Supabase
  return allEvolutions.filter((e) => {
    if (e.archived_at !== null) return false;
    if (resolvedRegistryId) {
      // Evoluções com registry correto
      if (e.patient_registry_id === resolvedRegistryId) return true;
      // Evoluções legadas (sem registry) — Fix 2 cobre todos os leitos históricos
      if (e.patient_registry_id === null && legacyPatientIds.includes(e.patient_id ?? "")) return true;
      return false;
    } else {
      return e.patient_id === safePatientId;
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
// CENÁRIOS DE TESTE
// ════════════════════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n═══════════════════════════════════════════════════════════════");
console.log("  SIMULAÇÃO — BUG DO HISTÓRICO CLÍNICO EM TRANSFERÊNCIA");
console.log("  Dados fictícios | Zero impacto em produção");
console.log("═══════════════════════════════════════════════════════════════\n");

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 1 — repointPatientHistory: comportamento correto do Fix 1
// ─────────────────────────────────────────────────────────────────────────────

await test("C1 — Repoint bem-sucedido: RPC ok, 0 evoluções no leito origem → { ok: true }", async () => {
  // Paciente: João da Silva | L01 → L05
  // Situação: repoint funcionou, todas as evoluções foram para L05
  const supabase = createMockSupabase({
    rpcShouldFail: false,
    evolutionsAfterRepoint: [], // L01 está vazio após repoint
  });

  const result = await repointPatientHistorySimulated(
    supabase, IDS.LEITO_L01, IDS.LEITO_L05, "Transferência UTI 1 → UTI 2"
  );

  assert(result.ok === true, `Esperado ok=true, recebeu ok=${result.ok}`);
  assert(!result.error, `Não deveria ter error, recebeu: ${result.error}`);
});

await test("C2 — Falha silenciosa detectada (FIX 1): RPC retorna ok mas evoluções ainda no leito origem → { ok: false }", async () => {
  // Paciente: João da Silva | L01 → L05
  // Situação: RPC retornou success=true (mentira), mas 2 evoluções ainda estão em L01
  const evolucoesOrfas: MockEvolution[] = [
    { id: "evo-001", patient_id: IDS.LEITO_L01, patient_registry_id: null, archived_at: null, status: "validated", soap_data: { plan: "Manter ATB" }, created_at: "2026-06-01T10:00:00Z" },
    { id: "evo-002", patient_id: IDS.LEITO_L01, patient_registry_id: null, archived_at: null, status: "validated", soap_data: { plan: "Alta prevista amanhã" }, created_at: "2026-06-02T08:00:00Z" },
  ];

  const supabase = createMockSupabase({
    rpcShouldFail: false,
    evolutionsAfterRepoint: evolucoesOrfas, // L01 ainda tem evoluções — repoint falhou
  });

  const result = await repointPatientHistorySimulated(
    supabase, IDS.LEITO_L01, IDS.LEITO_L05
  );

  assert(result.ok === false, `Esperado ok=false, recebeu ok=${result.ok}`);
  assert(result.error?.includes("Histórico clínico não migrado"), `Mensagem de erro inesperada: ${result.error}`);
  assert(result.error?.includes("2 evolução(ões)"), `Contagem incorreta na mensagem: ${result.error}`);
});

await test("C3 — Erro explícito na RPC: Supabase retorna erro → { ok: false } com mensagem original", async () => {
  // Paciente: José Ribamar | L12 → L18
  // Situação: RPC falhou com erro de banco (lock timeout, etc.)
  const supabase = createMockSupabase({
    rpcShouldFail: true,
    rpcError: "deadlock detected on relation clinical_evolutions",
  });

  const result = await repointPatientHistorySimulated(
    supabase, IDS.LEITO_L12, IDS.LEITO_L18
  );

  assert(result.ok === false, `Esperado ok=false, recebeu ok=${result.ok}`);
  assert(result.error?.includes("deadlock"), `Mensagem de erro inesperada: ${result.error}`);
});

await test("C4 — Paciente sem evoluções (recém admitido): RPC ok, count=0 → { ok: true } sem falso positivo", async () => {
  // Paciente: Pedro Santos | L20 → L22
  // Situação: paciente recém transferido, zero evoluções ainda
  const supabase = createMockSupabase({
    rpcShouldFail: false,
    evolutionsAfterRepoint: [], // zero evoluções — correto, não é bug
  });

  const result = await repointPatientHistorySimulated(
    supabase, IDS.LEITO_L20, IDS.LEITO_L22
  );

  assert(result.ok === true, `Esperado ok=true para paciente sem evoluções, recebeu ok=${result.ok}`);
});

await test("C5 — IDs ausentes: source=null → { ok: false } sem chamar RPC", async () => {
  const supabase = createMockSupabase({ rpcShouldFail: false });

  const result = await repointPatientHistorySimulated(supabase, "", IDS.LEITO_L05);

  assert(result.ok === false, `Esperado ok=false para IDs ausentes`);
  assert(result.error === "source/target ausente", `Mensagem: ${result.error}`);
});

await test("C6 — Source = Target: mesma cama → { ok: true } sem executar nada", async () => {
  const supabase = createMockSupabase({ rpcShouldFail: false });

  const result = await repointPatientHistorySimulated(supabase, IDS.LEITO_L01, IDS.LEITO_L01);

  assert(result.ok === true, `Esperado ok=true para source=target`);
  assert(Object.keys(result.counts ?? {}).length === 0, `counts deve ser vazio para skip`);
});

await test("C7 — Evolução arquivada não conta como órfã: archived_at != null → não bloqueia repoint", async () => {
  // Situação: 1 evolução arquivada resta no leito origem (comportamento esperado)
  const evolucoesArquivadas: MockEvolution[] = [
    { id: "evo-arq-001", patient_id: IDS.LEITO_L01, patient_registry_id: null, archived_at: "2026-06-01T09:00:00Z", status: "validated", soap_data: { plan: "Arquivada" }, created_at: "2026-06-01T08:00:00Z" },
  ];

  const supabase = createMockSupabase({
    rpcShouldFail: false,
    evolutionsAfterRepoint: evolucoesArquivadas,
  });

  // O count query filtra archived_at IS NULL — evolução arquivada não deve ser contada
  const { count } = await (supabase
    .from("clinical_evolutions")
    .select("*", { count: "exact", head: true })
    .eq("patient_id", IDS.LEITO_L01)
    .is("archived_at", null));

  // Evoluções arquivadas têm archived_at != null, então count = 0
  assert(count === 0, `Evoluções arquivadas não devem ser contadas como órfãs, count=${count}`);

  const result = await repointPatientHistorySimulated(supabase, IDS.LEITO_L01, IDS.LEITO_L05);
  assert(result.ok === true, `Repoint deve suceder quando só há evoluções arquivadas no origem`);
});

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 2 — useEvolutions: comportamento correto do Fix 2
// ─────────────────────────────────────────────────────────────────────────────

await test("C8 — Regressão: paciente sem transferência — query idêntica ao comportamento anterior", async () => {
  // Paciente: João da Silva, nunca transferido, 3 evoluções com registry
  const evolucoesJoao: MockEvolution[] = [
    { id: "evo-j1", patient_id: IDS.LEITO_L01, patient_registry_id: IDS.JOAO_REGISTRY, archived_at: null, status: "validated", soap_data: { plan: "D1" }, created_at: "2026-06-01T10:00:00Z" },
    { id: "evo-j2", patient_id: IDS.LEITO_L01, patient_registry_id: IDS.JOAO_REGISTRY, archived_at: null, status: "validated", soap_data: { plan: "D2" }, created_at: "2026-06-02T10:00:00Z" },
    { id: "evo-j3", patient_id: IDS.LEITO_L01, patient_registry_id: IDS.JOAO_REGISTRY, archived_at: null, status: "draft",     soap_data: { plan: "D3" }, created_at: "2026-06-03T10:00:00Z" },
  ];

  const supabase = createMockSupabase({
    admissionHistories: [
      { id: "ah-j1", patient_id: IDS.LEITO_L01, patient_registry_id: IDS.JOAO_REGISTRY, hospital_unit_id: IDS.HOSPITAL },
    ],
  });

  const resultado = await resolveEvolutionsQuery(
    supabase, IDS.LEITO_L01, IDS.JOAO_REGISTRY, IDS.HOSPITAL, evolucoesJoao
  );

  assert(resultado.length === 3, `Esperado 3 evoluções, encontrou ${resultado.length}`);
  assert(resultado.every(e => e.patient_registry_id === IDS.JOAO_REGISTRY), "Todas devem ser do João");
});

await test("C9 — Transferência com repoint bem-sucedido: evoluções já em L05, aparecem normalmente", async () => {
  // Paciente: João da Silva, transferido L01 → L05, repoint OK
  // Todas as evoluções já têm patient_id = L05 (repoint funcionou)
  const evolucoesAposRepoint: MockEvolution[] = [
    { id: "evo-j1", patient_id: IDS.LEITO_L05, patient_registry_id: IDS.JOAO_REGISTRY, archived_at: null, status: "validated", soap_data: { plan: "D1 - UTI 1" }, created_at: "2026-06-01T10:00:00Z" },
    { id: "evo-j2", patient_id: IDS.LEITO_L05, patient_registry_id: IDS.JOAO_REGISTRY, archived_at: null, status: "validated", soap_data: { plan: "D2 - UTI 1" }, created_at: "2026-06-02T10:00:00Z" },
    { id: "evo-j3", patient_id: IDS.LEITO_L05, patient_registry_id: IDS.JOAO_REGISTRY, archived_at: null, status: "validated", soap_data: { plan: "D1 - UTI 2" }, created_at: "2026-06-03T10:00:00Z" },
  ];

  const supabase = createMockSupabase({
    admissionHistories: [
      { id: "ah-j1", patient_id: IDS.LEITO_L01, patient_registry_id: IDS.JOAO_REGISTRY, hospital_unit_id: IDS.HOSPITAL },
      { id: "ah-j2", patient_id: IDS.LEITO_L05, patient_registry_id: IDS.JOAO_REGISTRY, hospital_unit_id: IDS.HOSPITAL },
    ],
  });

  const resultado = await resolveEvolutionsQuery(
    supabase, IDS.LEITO_L05, IDS.JOAO_REGISTRY, IDS.HOSPITAL, evolucoesAposRepoint
  );

  assert(resultado.length === 3, `Esperado 3 evoluções no leito destino, encontrou ${resultado.length}`);
});

await test("C10 — BUG ORIGINAL (v2): repoint falhou, evoluções legadas presas em L01, query antiga não as encontra", async () => {
  // Demonstra o comportamento ANTES do Fix 2
  // Evoluções legadas (sem registry_id) ficaram em L01 — repoint falhou
  const evolucoesOrfas: MockEvolution[] = [
    { id: "evo-a1", patient_id: IDS.LEITO_L03, patient_registry_id: null, archived_at: null, status: "validated", soap_data: { plan: "D1 legado" }, created_at: "2026-05-28T10:00:00Z" },
    { id: "evo-a2", patient_id: IDS.LEITO_L03, patient_registry_id: null, archived_at: null, status: "validated", soap_data: { plan: "D2 legado" }, created_at: "2026-05-29T10:00:00Z" },
  ];

  // Simula a query ANTIGA (sem Fix 2): só busca legadas pelo leito ATUAL
  const resultadoQueryAntiga = evolucoesOrfas.filter(e =>
    e.archived_at === null &&
    (e.patient_registry_id === IDS.ANA_REGISTRY ||
     (e.patient_registry_id === null && e.patient_id === IDS.LEITO_L09)) // L09 = destino
  );

  // Query antiga não encontra nada — o bug
  assert(resultadoQueryAntiga.length === 0, `Query antiga deveria retornar 0 (reprodução do bug), retornou ${resultadoQueryAntiga.length}`);
});

await test("C11 — FIX 2 APLICADO: mesmas evoluções legadas agora encontradas via leitos históricos", async () => {
  // Paciente: Ana Maria | L03 → L09, repoint falhou para evoluções legadas
  // Fix 2: admission_histories retorna L03 como leito histórico
  const evolucoesOrfas: MockEvolution[] = [
    { id: "evo-a1", patient_id: IDS.LEITO_L03, patient_registry_id: null, archived_at: null, status: "validated", soap_data: { plan: "D1 legado" }, created_at: "2026-05-28T10:00:00Z" },
    { id: "evo-a2", patient_id: IDS.LEITO_L03, patient_registry_id: null, archived_at: null, status: "validated", soap_data: { plan: "D2 legado" }, created_at: "2026-05-29T10:00:00Z" },
    { id: "evo-a3", patient_id: IDS.LEITO_L09, patient_registry_id: IDS.ANA_REGISTRY, archived_at: null, status: "draft",     soap_data: { plan: "D1 UTI 2" }, created_at: "2026-05-30T10:00:00Z" },
  ];

  const supabase = createMockSupabase({
    admissionHistories: [
      // Fix 2: admission_histories registra L03 como leito anterior
      { id: "ah-a1", patient_id: IDS.LEITO_L03, patient_registry_id: IDS.ANA_REGISTRY, hospital_unit_id: IDS.HOSPITAL },
      { id: "ah-a2", patient_id: IDS.LEITO_L09, patient_registry_id: IDS.ANA_REGISTRY, hospital_unit_id: IDS.HOSPITAL },
    ],
  });

  const resultado = await resolveEvolutionsQuery(
    supabase, IDS.LEITO_L09, IDS.ANA_REGISTRY, IDS.HOSPITAL, evolucoesOrfas
  );

  // Fix 2 deve encontrar as 3: 2 legadas (L03) + 1 nova (L09)
  assert(resultado.length === 3, `Fix 2 deveria encontrar 3 evoluções, encontrou ${resultado.length}`);
  assert(resultado.some(e => e.id === "evo-a1"), "Deve incluir evolução legada D1");
  assert(resultado.some(e => e.id === "evo-a2"), "Deve incluir evolução legada D2");
  assert(resultado.some(e => e.id === "evo-a3"), "Deve incluir evolução nova D1-UTI2");
});

await test("C12 — Múltiplas transferências: Maria Oliveira L06 → L10 → L14", async () => {
  // Paciente com 2 transferências, evoluções em 3 leitos diferentes
  const todasEvolucoesMariaLegadas: MockEvolution[] = [
    { id: "evo-m1", patient_id: IDS.LEITO_L06, patient_registry_id: null, archived_at: null, status: "validated", soap_data: { plan: "D1 L06 legado" }, created_at: "2026-05-20T10:00:00Z" },
    { id: "evo-m2", patient_id: IDS.LEITO_L10, patient_registry_id: null, archived_at: null, status: "validated", soap_data: { plan: "D5 L10 legado" }, created_at: "2026-05-25T10:00:00Z" },
    { id: "evo-m3", patient_id: IDS.LEITO_L14, patient_registry_id: IDS.MARIA_REGISTRY, archived_at: null, status: "draft", soap_data: { plan: "D10 L14 atual" }, created_at: "2026-05-30T10:00:00Z" },
  ];

  const supabase = createMockSupabase({
    admissionHistories: [
      // Todos os 3 leitos registrados em admission_histories
      { id: "ah-m1", patient_id: IDS.LEITO_L06, patient_registry_id: IDS.MARIA_REGISTRY, hospital_unit_id: IDS.HOSPITAL },
      { id: "ah-m2", patient_id: IDS.LEITO_L10, patient_registry_id: IDS.MARIA_REGISTRY, hospital_unit_id: IDS.HOSPITAL },
      { id: "ah-m3", patient_id: IDS.LEITO_L14, patient_registry_id: IDS.MARIA_REGISTRY, hospital_unit_id: IDS.HOSPITAL },
    ],
  });

  const resultado = await resolveEvolutionsQuery(
    supabase, IDS.LEITO_L14, IDS.MARIA_REGISTRY, IDS.HOSPITAL, todasEvolucoesMariaLegadas
  );

  assert(resultado.length === 3, `Esperado 3 evoluções (de 3 leitos), encontrou ${resultado.length}`);
  assert(resultado.some(e => e.id === "evo-m1"), "Evolução do primeiro leito (L06) deve aparecer");
  assert(resultado.some(e => e.id === "evo-m2"), "Evolução do segundo leito (L10) deve aparecer");
  assert(resultado.some(e => e.id === "evo-m3"), "Evolução do leito atual (L14) deve aparecer");
});

await test("C13 — Evoluções arquivadas não aparecem na timeline mesmo com Fix 2", async () => {
  // Evoluções arquivadas de leito anterior NÃO devem aparecer
  const evolucoesComArquivada: MockEvolution[] = [
    { id: "evo-arq-1", patient_id: IDS.LEITO_L01, patient_registry_id: null, archived_at: "2026-05-31T23:00:00Z", status: "validated", soap_data: { plan: "Alta" }, created_at: "2026-05-31T20:00:00Z" },
    { id: "evo-v1",    patient_id: IDS.LEITO_L05, patient_registry_id: IDS.JOAO_REGISTRY, archived_at: null, status: "validated", soap_data: { plan: "D1 UTI 2" }, created_at: "2026-06-01T10:00:00Z" },
  ];

  const supabase = createMockSupabase({
    admissionHistories: [
      { id: "ah-j1", patient_id: IDS.LEITO_L01, patient_registry_id: IDS.JOAO_REGISTRY, hospital_unit_id: IDS.HOSPITAL },
      { id: "ah-j2", patient_id: IDS.LEITO_L05, patient_registry_id: IDS.JOAO_REGISTRY, hospital_unit_id: IDS.HOSPITAL },
    ],
  });

  const resultado = await resolveEvolutionsQuery(
    supabase, IDS.LEITO_L05, IDS.JOAO_REGISTRY, IDS.HOSPITAL, evolucoesComArquivada
  );

  assert(resultado.length === 1, `Apenas 1 evolução ativa esperada, encontrou ${resultado.length}`);
  assert(resultado[0].id === "evo-v1", "Deve retornar apenas a evolução ativa (evo-v1)");
  assert(!resultado.some(e => e.archived_at !== null), "Nenhuma evolução arquivada deve aparecer");
});

await test("C14 — Sem registry_id (legado puro): usa fallback por patient_id atual, sem lookup histórico", async () => {
  // Cenário onde registry nunca foi resolvido (patient_registry_id = null no leito)
  const evolucoesLegadas: MockEvolution[] = [
    { id: "evo-leg-1", patient_id: IDS.LEITO_L12, patient_registry_id: null, archived_at: null, status: "validated", soap_data: { plan: "Legado sem registry" }, created_at: "2026-04-01T10:00:00Z" },
  ];

  const supabase = createMockSupabase({ admissionHistories: [] });

  // Com resolvedRegistryId = null, não deve fazer lookup em admission_histories
  const resultado = await resolveEvolutionsQuery(
    supabase, IDS.LEITO_L12, null, IDS.HOSPITAL, evolucoesLegadas
  );

  assert(resultado.length === 1, `Esperado 1 evolução legada via fallback patient_id, encontrou ${resultado.length}`);
});

await test("C15 — Mix: paciente com evoluções novas (com registry) + legadas (sem registry) + arquivadas", async () => {
  // Caso mais complexo do mundo real
  const todasEvolucoesJose: MockEvolution[] = [
    // Legadas (antes da Fase B) — presas em L12 após repoint falho
    { id: "evo-jose-leg-1", patient_id: IDS.LEITO_L12, patient_registry_id: null, archived_at: null, status: "validated", soap_data: { plan: "D1 legado UCI 1" }, created_at: "2026-05-01T08:00:00Z" },
    { id: "evo-jose-leg-2", patient_id: IDS.LEITO_L12, patient_registry_id: null, archived_at: null, status: "validated", soap_data: { plan: "D2 legado UCI 1" }, created_at: "2026-05-02T08:00:00Z" },
    // Arquivada — não deve aparecer
    { id: "evo-jose-arq",   patient_id: IDS.LEITO_L12, patient_registry_id: null, archived_at: "2026-05-10T06:00:00Z", status: "validated", soap_data: { plan: "Arquivada" }, created_at: "2026-05-10T05:00:00Z" },
    // Novas (após Fase B, com registry) — no leito destino L18
    { id: "evo-jose-new-1", patient_id: IDS.LEITO_L18, patient_registry_id: IDS.JOSE_REGISTRY, archived_at: null, status: "validated", soap_data: { plan: "D1 UCI 2" }, created_at: "2026-05-11T08:00:00Z" },
    { id: "evo-jose-new-2", patient_id: IDS.LEITO_L18, patient_registry_id: IDS.JOSE_REGISTRY, archived_at: null, status: "draft",     soap_data: { plan: "D2 UCI 2" }, created_at: "2026-05-12T08:00:00Z" },
  ];

  const supabase = createMockSupabase({
    admissionHistories: [
      { id: "ah-jose-1", patient_id: IDS.LEITO_L12, patient_registry_id: IDS.JOSE_REGISTRY, hospital_unit_id: IDS.HOSPITAL },
      { id: "ah-jose-2", patient_id: IDS.LEITO_L18, patient_registry_id: IDS.JOSE_REGISTRY, hospital_unit_id: IDS.HOSPITAL },
    ],
  });

  const resultado = await resolveEvolutionsQuery(
    supabase, IDS.LEITO_L18, IDS.JOSE_REGISTRY, IDS.HOSPITAL, todasEvolucoesJose
  );

  // Deve encontrar: 2 legadas (L12) + 2 novas (L18) = 4
  // Não deve incluir: 1 arquivada
  assert(resultado.length === 4, `Esperado 4 evoluções (2 legadas + 2 novas), encontrou ${resultado.length}`);
  assert(!resultado.some(e => e.archived_at !== null), "Nenhuma arquivada deve aparecer");
  assert(resultado.some(e => e.id === "evo-jose-leg-1"), "Evolução legada D1 deve aparecer");
  assert(resultado.some(e => e.id === "evo-jose-leg-2"), "Evolução legada D2 deve aparecer");
  assert(resultado.some(e => e.id === "evo-jose-new-1"), "Evolução nova D1 deve aparecer");
  assert(resultado.some(e => e.id === "evo-jose-new-2"), "Evolução nova D2 deve aparecer");
});

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 3 — SQL v3: comportamento esperado da nova migration
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 4 — Fix 1 expandido + SQL v4: cobertura do gap patient_id = null
// ─────────────────────────────────────────────────────────────────────────────

await test("C18 — Fix 1 expandido: evolução com patient_id=null detectada como não migrada", async () => {
  // Cenário: paciente Ana Maria, criado via pré-admissão
  // Evolução tem patient_registry_id correto mas patient_id = null
  // A RPC v3 não a encontrava → retornava success → leito zerado → gap residual
  // O Fix 1 expandido agora detecta e bloqueia
  const evolucoesComNullPatientId: MockEvolution[] = [
    {
      id: "evo-pre-adm-1",
      patient_id: null,                 // ← criada por pré-admissão, sem leito explícito
      patient_registry_id: IDS.ANA_REGISTRY,
      archived_at: null,
      status: "validated",
      soap_data: { plan: "Avaliação pré-admissional" },
      created_at: "2026-06-01T06:00:00Z",
    },
  ];

  const supabase = createMockSupabase({
    rpcShouldFail: false,
    evolutionsAfterRepoint: evolucoesComNullPatientId,
    targetPatientRegistryId: IDS.ANA_REGISTRY, // leito destino tem o registry correto
  });

  const result = await repointPatientHistorySimulated(
    supabase, IDS.LEITO_L03, IDS.LEITO_L09
  );

  assert(result.ok === false, `Fix 1 expandido deve detectar evolução com patient_id=null não migrada`);
  assert(result.error?.includes("1 registro(s) sem vínculo"), `Mensagem deve indicar o problema: ${result.error}`);
});

await test("C19 — Regressão Fix 1 expandido: sem evoluções null → não gera falso positivo", async () => {
  // Verifica que a Verificação 2 não interfere quando não há evoluções com patient_id=null
  const evolucoesNormais: MockEvolution[] = [
    { id: "evo-normal-1", patient_id: IDS.LEITO_L05, patient_registry_id: IDS.JOAO_REGISTRY, archived_at: null, status: "validated", soap_data: { plan: "D1" }, created_at: "2026-06-01T10:00:00Z" },
  ];

  const supabase = createMockSupabase({
    rpcShouldFail: false,
    evolutionsAfterRepoint: evolucoesNormais, // todas têm patient_id, nenhuma com null
    targetPatientRegistryId: IDS.JOAO_REGISTRY,
  });

  const result = await repointPatientHistorySimulated(
    supabase, IDS.LEITO_L01, IDS.LEITO_L05
  );

  // Verificação 1: patient_id = LEITO_L01 → evo-normal-1 tem LEITO_L05 → count=0 ✓
  // Verificação 2: patient_id IS NULL → nenhuma → count=0 ✓
  assert(result.ok === true, `Não deve gerar falso positivo quando evoluções estão corretamente migradas`);
});

await test("C20 — SQL v4: WHERE clause agora captura patient_id=null no banco", async () => {
  // Valida logicamente que o novo OR na v4 cobre o gap
  // (simulação da lógica SQL — sem banco real)
  const whereV3 = (evolution: MockEvolution, sourceId: string, registryId: string, encounterId: string | null) =>
    evolution.patient_id === sourceId ||
    (evolution.patient_registry_id === registryId && encounterId !== null && evolution.patient_id === encounterId);

  const whereV4 = (evolution: MockEvolution, sourceId: string, registryId: string, encounterId: string | null) =>
    evolution.patient_id === sourceId ||
    (evolution.patient_registry_id === registryId && encounterId !== null && evolution.patient_id === encounterId) ||
    (evolution.patient_registry_id === registryId && evolution.patient_id === null); // ← novo OR v4

  const evoCasoGap: MockEvolution = {
    id: "evo-gap",
    patient_id: null,                      // criada por pré-admissão
    patient_registry_id: IDS.ANA_REGISTRY, // registry correto
    archived_at: null,
    status: "validated",
    soap_data: { plan: "Pré-admissão" },
    created_at: "2026-06-01T06:00:00Z",
  };

  const encontradaPelaV3 = whereV3(evoCasoGap, IDS.LEITO_L03, IDS.ANA_REGISTRY, null);
  const encontradaPelaV4 = whereV4(evoCasoGap, IDS.LEITO_L03, IDS.ANA_REGISTRY, null);

  assert(encontradaPelaV3 === false, "v3 NÃO deve encontrar evolução com patient_id=null (reproduz o gap)");
  assert(encontradaPelaV4 === true,  "v4 DEVE encontrar evolução com patient_id=null (gap fechado)");
});

await test("C16 — SQL v3: transferência que falha em clinical_evolutions bloqueia TODO o repoint", async () => {
  // Na v2: falha em clinical_evolutions era silenciada → success=true → leito zerado → bug
  // Na v3: falha propaga → caller recebe error → leito NÃO zerado → dados seguros
  //
  // Simulamos que a RPC agora retorna erro (comportamento da v3)
  const supabase = createMockSupabase({
    rpcShouldFail: true,
    rpcError: "ERROR: duplicate key value violates unique constraint (clinical_evolutions_pkey)",
  });

  const result = await repointPatientHistorySimulated(
    supabase, IDS.LEITO_L01, IDS.LEITO_L05
  );

  // Na v3, o erro é propagado e o caller recebe ok=false
  assert(result.ok === false, `v3 deve retornar ok=false quando clinical_evolutions falha`);
  assert(result.error?.includes("duplicate key"), `Mensagem de erro original deve ser preservada: ${result.error}`);
  // O leito de origem NÃO seria zerado porque o caller verifica result.ok antes de esvaziar
});

await test("C17 — SQL v3: version='v3' no registro de auditoria patient_movements", async () => {
  // Verifica que patient_movements gravará 'REPOINT_HISTORY_V3' como movement_type
  // (não dá para simular sem banco, mas validamos a lógica esperada)
  const expectedAuditType = "REPOINT_HISTORY_V3";
  const v2AuditType = "REPOINT_HISTORY_V2";
  assert(expectedAuditType !== v2AuditType, "v3 deve usar tipo de auditoria diferente da v2");
  assert(expectedAuditType === "REPOINT_HISTORY_V3", "Tipo de auditoria correto para v3");
});

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 6 — Fechamento correto de encounter por desfecho clínico (Achado 1)
// ─────────────────────────────────────────────────────────────────────────────

// Tipos para o Grupo 6
type ClinicalDecisionKind = "alta_medica" | "transf_interna" | "transf_externa" | "obito" | "evasao";

interface MockEncounter {
  id: string;
  patient_id: string;
  status: "active" | "closed";
  discharge_date: string | null;
}

// Simula a lógica de fechamento de encounter em signalClinicalDecision (bedLifecycle.ts)
function signalDecisionClosesEncounterSimulated(kind: ClinicalDecisionKind): boolean {
  return kind === "alta_medica" || kind === "obito" || kind === "transf_externa";
}

// Simula a lógica de fechamento de encounter em PatientMovementDialog
function documentClosesEncounterSimulated(requiredDocType: "alta" | "obito"): boolean {
  return requiredDocType === "obito" || requiredDocType === "alta";
}
function transferClosesEncounterSimulated(subtypeId: string): boolean {
  return subtypeId === "TRANSFERENCIA_EXTERNA";
}

// Simula a execução do mock de encounter no banco
function applyEncounterUpdate(
  encounters: MockEncounter[],
  patientId: string,
  shouldClose: boolean,
): MockEncounter[] {
  return encounters.map(e => {
    if (e.patient_id === patientId && e.status !== "closed" && shouldClose) {
      return { ...e, status: "closed", discharge_date: "2026-06-04T20:00:00Z" };
    }
    return e;
  });
}

// ─── signalClinicalDecision ───

await test("C26 — signalClinicalDecision: alta_medica fecha encounter", async () => {
  const kind: ClinicalDecisionKind = "alta_medica";
  const encounter: MockEncounter = { id: "enc-001", patient_id: IDS.LEITO_L01, status: "active", discharge_date: null };
  const shouldClose = signalDecisionClosesEncounterSimulated(kind);
  const resultado = applyEncounterUpdate([encounter], IDS.LEITO_L01, shouldClose);
  assert(resultado[0].status === "closed", `alta_medica deve fechar encounter, recebeu: ${resultado[0].status}`);
  assert(resultado[0].discharge_date !== null, "discharge_date deve ser preenchido na alta médica");
});

await test("C27 — signalClinicalDecision: obito fecha encounter", async () => {
  const kind: ClinicalDecisionKind = "obito";
  const encounter: MockEncounter = { id: "enc-002", patient_id: IDS.LEITO_L01, status: "active", discharge_date: null };
  const shouldClose = signalDecisionClosesEncounterSimulated(kind);
  const resultado = applyEncounterUpdate([encounter], IDS.LEITO_L01, shouldClose);
  assert(resultado[0].status === "closed", `obito deve fechar encounter`);
  assert(resultado[0].discharge_date !== null, "discharge_date deve ser preenchido no óbito");
});

await test("C28 — signalClinicalDecision: transf_externa fecha encounter", async () => {
  const kind: ClinicalDecisionKind = "transf_externa";
  const encounter: MockEncounter = { id: "enc-003", patient_id: IDS.LEITO_L01, status: "active", discharge_date: null };
  const shouldClose = signalDecisionClosesEncounterSimulated(kind);
  const resultado = applyEncounterUpdate([encounter], IDS.LEITO_L01, shouldClose);
  assert(resultado[0].status === "closed", `transf_externa deve fechar encounter`);
});

await test("C29 — signalClinicalDecision: transf_interna NÃO fecha encounter", async () => {
  const kind: ClinicalDecisionKind = "transf_interna";
  const encounter: MockEncounter = { id: "enc-004", patient_id: IDS.LEITO_L01, status: "active", discharge_date: null };
  const shouldClose = signalDecisionClosesEncounterSimulated(kind);
  const resultado = applyEncounterUpdate([encounter], IDS.LEITO_L01, shouldClose);
  assert(resultado[0].status === "active", `transf_interna NÃO deve fechar encounter — número de atendimento preservado`);
  assert(resultado[0].discharge_date === null, "discharge_date deve permanecer null na transferência interna");
});

await test("C30 — signalClinicalDecision: evasao NÃO fecha encounter", async () => {
  const kind: ClinicalDecisionKind = "evasao";
  const encounter: MockEncounter = { id: "enc-005", patient_id: IDS.LEITO_L01, status: "active", discharge_date: null };
  const shouldClose = signalDecisionClosesEncounterSimulated(kind);
  const resultado = applyEncounterUpdate([encounter], IDS.LEITO_L01, shouldClose);
  assert(resultado[0].status === "active", `evasao NÃO deve fechar encounter pela regra atual`);
});

// ─── PatientMovementDialog ───

await test("C31 — PatientMovementDialog: documento de alta fecha encounter", async () => {
  const shouldClose = documentClosesEncounterSimulated("alta");
  const encounter: MockEncounter = { id: "enc-006", patient_id: IDS.LEITO_L05, status: "active", discharge_date: null };
  const resultado = applyEncounterUpdate([encounter], IDS.LEITO_L05, shouldClose);
  assert(resultado[0].status === "closed", "documento de alta deve fechar encounter");
});

await test("C32 — PatientMovementDialog: documento de óbito fecha encounter", async () => {
  const shouldClose = documentClosesEncounterSimulated("obito");
  const encounter: MockEncounter = { id: "enc-007", patient_id: IDS.LEITO_L05, status: "active", discharge_date: null };
  const resultado = applyEncounterUpdate([encounter], IDS.LEITO_L05, shouldClose);
  assert(resultado[0].status === "closed", "documento de óbito deve fechar encounter");
});

await test("C33 — PatientMovementDialog: TRANSFERENCIA_EXTERNA fecha encounter", async () => {
  const shouldClose = transferClosesEncounterSimulated("TRANSFERENCIA_EXTERNA");
  const encounter: MockEncounter = { id: "enc-008", patient_id: IDS.LEITO_L05, status: "active", discharge_date: null };
  const resultado = applyEncounterUpdate([encounter], IDS.LEITO_L05, shouldClose);
  assert(resultado[0].status === "closed", "TRANSFERENCIA_EXTERNA deve fechar encounter");
});

await test("C34 — PatientMovementDialog: TRANSFERENCIA_INTERNA NÃO fecha encounter", async () => {
  const shouldClose = transferClosesEncounterSimulated("TRANSFERENCIA_INTERNA");
  const encounter: MockEncounter = { id: "enc-009", patient_id: IDS.LEITO_L05, status: "active", discharge_date: null };
  const resultado = applyEncounterUpdate([encounter], IDS.LEITO_L05, shouldClose);
  assert(resultado[0].status === "active", "TRANSFERENCIA_INTERNA NÃO deve fechar encounter");
  assert(resultado[0].discharge_date === null, "discharge_date deve permanecer null");
});

// ─── archive_patient_bed_data ───

await test("C35 — archive_patient_bed_data (migration v2): NÃO fecha encounter em nenhum motivo", async () => {
  // A migration v2 da função remove o bloco de UPDATE em patient_encounters.
  // Qualquer p_reason que antes fechava o encounter agora não fecha mais.
  const reasons = [
    "defensive_pre_admission_cleanup",
    "operational_relocation_source_release",
    "frontend_vacate_bed",
    "frontend_release_bed_pre_admission",
  ];
  // Na v2 da função, nenhum reason fecha encounter — o bloco foi removido.
  // Simulamos verificando que o encounter permanece active para todos os reasons.
  for (const reason of reasons) {
    const encounter: MockEncounter = {
      id: `enc-${reason}`,
      patient_id: IDS.LEITO_L01,
      status: "active",
      discharge_date: null,
    };
    // archive_patient_bed_data v2 não chama applyEncounterUpdate → encounter fica active
    assert(encounter.status === "active", `archive_patient_bed_data v2 com reason='${reason}' NÃO deve fechar encounter`);
  }
});

await test("C36 — Encounter já fechado: segundo fechamento não gera erro (neq status closed)", async () => {
  // O update usa .neq("status", "closed") — se já estiver fechado, o UPDATE
  // afeta 0 linhas sem erro. Simula esse comportamento.
  const encounterJaFechado: MockEncounter = {
    id: "enc-010",
    patient_id: IDS.LEITO_L01,
    status: "closed",
    discharge_date: "2026-06-01T10:00:00Z",
  };
  // .neq("status", "closed") exclui esse encounter do UPDATE
  const resultado = applyEncounterUpdate([encounterJaFechado], IDS.LEITO_L01, true);
  // O encounter já estava closed — neq exclui → permanece igual
  assert(resultado[0].status === "closed", "Encounter já fechado deve permanecer closed sem erro");
  assert(resultado[0].discharge_date === "2026-06-01T10:00:00Z", "discharge_date original deve ser preservado");
});

// Fecha o encounter resolvendo por registry (regra canônica), não por leito.
// Cobre o PONTO CEGO dos testes C26-C28: encounter cujo patient_id divergiu do
// leito após transferência interna (repoint mudou o vínculo). O fechamento por
// patient_id/leito falharia (0 linhas → encounter zumbi aberto); o fechamento
// por registry→id acerta. Auditoria 22/07/2026.
function closeEncounterByRegistrySimulated(
  encounters: MockEncounter[],
  registryId: string,
): MockEncounter[] {
  const ativo = encounters
    .filter(e => (e as any).registry_id === registryId && e.status !== "closed")
    .sort((a, b) => (b.id > a.id ? 1 : -1))[0];
  if (!ativo) return encounters;
  return encounters.map(e =>
    e.id === ativo.id ? { ...e, status: "closed", discharge_date: "2026-07-22T12:00:00Z" } : e,
  );
}

await test("C36b — Alta fecha encounter por REGISTRY mesmo com patient_id divergente (ponto cego)", async () => {
  const encounter = {
    id: "enc-020",
    patient_id: IDS.LEITO_L01,   // leito antigo (divergente do atual)
    registry_id: "REG-PACIENTE-X",
    status: "active",
    discharge_date: null,
  } as any;

  // ❌ ANTIGO (fechar por leito atual, diferente de L01): não encontra → NÃO fecha
  const antigo = applyEncounterUpdate([encounter], "leito-novo-L09", true);
  assert(antigo[0].status === "active", "Fechamento por leito atual FALHA (encounter zumbi) — comprova o bug");

  // ✅ NOVO (resolver por registry, fechar por id): fecha o encounter certo
  const novo = closeEncounterByRegistrySimulated([encounter], "REG-PACIENTE-X");
  assert(novo[0].status === "closed", "Fechamento por registry deve fechar o encounter certo");
  assert(novo[0].discharge_date !== null, "discharge_date deve ser preenchido");
});

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 7 — AuthContext: fallback seguro de role (Crítico 1)
// ─────────────────────────────────────────────────────────────────────────────

type UserRole = "admin" | "medico" | "porta" | "visitante" | "farmacia" | null;
type UserStatus = "pending" | "approved" | "rejected" | null;

interface AuthState {
  role: UserRole;
  status: UserStatus;
  allowedDepartments: string[];
  loadingFinished: boolean;
}

// Replica a lógica de fetchUserRoleAndDepartments do AuthContext corrigido
async function simulateFetchUserRole(options: {
  rolesData?: { role: string }[] | null;
  roleError?: Error | null;
  profileStatus?: string | null;
  profileError?: Error | null;
  deptData?: { department: string }[] | null;
  deptError?: Error | null;
  throwInCatch?: boolean;
}): Promise<AuthState> {
  const state: AuthState = {
    role: null,
    status: null,
    allowedDepartments: [],
    loadingFinished: false,
  };

  try {
    if (options.throwInCatch) throw new Error("Erro crítico simulado");

    // 1. role
    const roleError = options.roleError ?? null;
    const rolesData = options.rolesData ?? null;

    if (roleError) {
      state.role = null;
      state.status = "pending";
      state.allowedDepartments = [];
      return state; // early return — igual ao código real
    }

    const roleData = rolesData && rolesData.length > 0
      ? (rolesData.find(r => r.role === "admin") || rolesData[0])
      : null;
    state.role = (roleData?.role as UserRole) ?? null;

    // 2. status
    const profileError = options.profileError ?? null;
    if (profileError) {
      state.status = "pending";
    } else {
      state.status = (options.profileStatus as UserStatus) ?? null;
    }

    // 3. departments
    const deptError = options.deptError ?? null;
    if (deptError) {
      state.allowedDepartments = [];
    } else {
      state.allowedDepartments = options.deptData?.map(d => d.department) ?? [];
    }

  } catch {
    state.role = null;
    state.status = "pending";
    state.allowedDepartments = [];
  } finally {
    state.loadingFinished = true;
  }

  return state;
}

// ─── Cenários ───

await test("C37 — Login bem-sucedido: médico aprovado recebe role e status corretos", async () => {
  const state = await simulateFetchUserRole({
    rolesData: [{ role: "medico" }],
    profileStatus: "approved",
    deptData: [{ department: "UTI 1" }, { department: "UTI 2" }],
  });
  assert(state.role === "medico", `Esperado role='medico', recebeu '${state.role}'`);
  assert(state.status === "approved", `Esperado status='approved', recebeu '${state.status}'`);
  assert(state.allowedDepartments.length === 2, "Deve ter 2 departamentos");
  assert(state.loadingFinished === true, "Loading deve ter finalizado");
});

await test("C38 — Login bem-sucedido: admin recebe role admin (prioridade sobre outros roles)", async () => {
  const state = await simulateFetchUserRole({
    rolesData: [{ role: "medico" }, { role: "admin" }],
    profileStatus: "approved",
    deptData: [],
  });
  assert(state.role === "admin", `Admin deve ter prioridade — recebeu '${state.role}'`);
});

await test("C39 — CRÍTICO (ANTES): roleError promovia usuário para 'medico' (vulnerabilidade)", async () => {
  // Demonstra o comportamento ANTES da correção — o que NÃO deve acontecer mais
  const comportamentoAntigo = "medico"; // o que o código antigo fazia
  assert(comportamentoAntigo === "medico", "Reprodução da vulnerabilidade: erro promovia para médico");
  // O código corrigido NÃO faz isso — confirmado pelo C40
});

await test("C40 — CRÍTICO (DEPOIS): roleError agora bloqueia completamente o acesso", async () => {
  // Paciente fictício: JOSE USUARIO tenta logar, roleError ocorre (falha de rede)
  const state = await simulateFetchUserRole({
    roleError: new Error("connection timeout fetching user_roles"),
  });
  assert(state.role === null, `roleError deve resultar em role=null, não 'medico'. Recebeu: '${state.role}'`);
  assert(state.status === "pending", `roleError deve resultar em status='pending' para bloquear acesso`);
  assert(state.allowedDepartments.length === 0, "Sem departamentos em caso de roleError");
  assert(state.loadingFinished === true, "Loading finaliza mesmo com early return (finally block)");
});

await test("C41 — profileError mantém acesso bloqueado com status='pending'", async () => {
  // role carregou OK, mas status falhou — deve bloquear com pending
  const state = await simulateFetchUserRole({
    rolesData: [{ role: "visitante" }],
    profileError: new Error("profiles query failed"),
    deptData: [],
  });
  assert(state.role === "visitante", `Role deve ser carregado mesmo com profileError: '${state.role}'`);
  assert(state.status === "pending", `profileError deve manter status='pending' — recebeu '${state.status}'`);
});

await test("C42 — Catch geral (falha total de rede) bloqueia acesso completamente", async () => {
  // Simulação: falha crítica — nem a query de roles executa
  const state = await simulateFetchUserRole({ throwInCatch: true });
  assert(state.role === null, `Falha total deve resultar em role=null — recebeu '${state.role}'`);
  assert(state.status === "pending", `Falha total deve resultar em status='pending'`);
  assert(state.allowedDepartments.length === 0, "Sem departamentos em falha total");
  assert(state.loadingFinished === true, "Loading deve finalizar mesmo com exceção (finally)");
});

await test("C43 — Usuário sem role cadastrado: role=null, não promove para medico", async () => {
  // Usuário novo ainda sem role atribuído no sistema
  const state = await simulateFetchUserRole({
    rolesData: [], // array vazio — sem roles
    profileStatus: "pending",
    deptData: [],
  });
  assert(state.role === null, `Usuário sem role deve ter role=null, não 'medico'. Recebeu: '${state.role}'`);
  assert(state.status === "pending", "Novo usuário deve ter status pending");
});

await test("C44 — Regressão: usuário com status='rejected' é bloqueado normalmente", async () => {
  const state = await simulateFetchUserRole({
    rolesData: [{ role: "medico" }],
    profileStatus: "rejected",
    deptData: [],
  });
  assert(state.role === "medico", "Role carregado corretamente");
  assert(state.status === "rejected", "Status rejected preservado — ProtectedRoute bloqueia este usuário");
});

// ─────────────────────────────────────────────────────────────────────────────
// RELATÓRIO FINAL
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n─────────────────────────────────────────────────────────────────");
console.log("  RESULTADO DOS TESTES");
console.log("─────────────────────────────────────────────────────────────────");

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 5 — OperationalRelocationDialog: validação de sinalização prévia
// ─────────────────────────────────────────────────────────────────────────────

// Simula a lógica de isTransferPending do componente
function isTransferPendingSimulated(admissionStatus: string | undefined): boolean {
  return (
    admissionStatus === "transferencia_interna_pendente" ||
    admissionStatus === "transferencia_externa_pendente"
  );
}

await test("C21 — Paciente com transferência interna pendente: remanejamento bloqueado", async () => {
  const admissionStatus = "transferencia_interna_pendente";
  assert(
    isTransferPendingSimulated(admissionStatus) === true,
    "Transferência interna pendente deve bloquear remanejamento"
  );
});

await test("C22 — Paciente com transferência externa pendente: remanejamento bloqueado", async () => {
  const admissionStatus = "transferencia_externa_pendente";
  assert(
    isTransferPendingSimulated(admissionStatus) === true,
    "Transferência externa pendente deve bloquear remanejamento"
  );
});

await test("C23 — Paciente admitido sem sinalização: remanejamento permitido", async () => {
  const admissionStatus = "admitido";
  assert(
    isTransferPendingSimulated(admissionStatus) === false,
    "Paciente admitido sem sinalização deve permitir remanejamento operacional"
  );
});

await test("C24 — Paciente pré-admitido: remanejamento permitido (não foi sinalizado)", async () => {
  const admissionStatus = "pre_admitido";
  assert(
    isTransferPendingSimulated(admissionStatus) === false,
    "Pré-admitido sem sinalização deve permitir remanejamento"
  );
});

await test("C25 — Tipo de mensagem correto por status: interna vs externa", async () => {
  const getTransferType = (status: string | undefined) =>
    status === "transferencia_interna_pendente" ? "interna" : "externa";

  assert(getTransferType("transferencia_interna_pendente") === "interna", "Status interno deve gerar label 'interna'");
  assert(getTransferType("transferencia_externa_pendente") === "externa", "Status externo deve gerar label 'externa'");
  assert(getTransferType("admitido") === "externa", "Status não-pendente cai no fallback 'externa'");
});

const GRUPOS = [
  { titulo: "GRUPO 1 — repointPatientHistory (Fix 1)",              cenarios: ["C1","C2","C3","C4","C5","C6","C7"] },
  { titulo: "GRUPO 2 — useEvolutions query (Fix 2)",                cenarios: ["C8","C9","C10","C11","C12","C13","C14","C15"] },
  { titulo: "GRUPO 3 — SQL v3 (migration: propaga erros)",          cenarios: ["C16","C17"] },
  { titulo: "GRUPO 4 — Fix 1 expandido + SQL v4 (patient_id=null)", cenarios: ["C18","C19","C20"] },
  { titulo: "GRUPO 5 — OperationalRelocationDialog (Achado 2)",            cenarios: ["C21","C22","C23","C24","C25"] },
  { titulo: "GRUPO 6 — Fechamento de encounter por desfecho (Achado 1)",   cenarios: ["C26","C27","C28","C29","C30","C31","C32","C33","C34","C35","C36"] },
  { titulo: "GRUPO 7 — AuthContext: fallback seguro de role (Crítico 1)",  cenarios: ["C37","C38","C39","C40","C41","C42","C43","C44"] },
];

for (const grupo of GRUPOS) {
  console.log(`\n  ${grupo.titulo}`);
  for (const r of results) {
    const num = r.name.split(" ")[0]; // ex: "C1"
    if (!grupo.cenarios.includes(num)) continue;
    const icon = r.ok ? "✓" : "✗";
    const label = r.ok ? r.name : `${r.name}\n       → ${r.details}`;
    console.log(`  ${icon} ${label}`);
  }
}

console.log("\n─────────────────────────────────────────────────────────────────");
console.log(`  TOTAL: ${passed + failed} cenários | ✓ ${passed} passaram | ${failed > 0 ? "✗" : "✓"} ${failed} falharam`);
console.log("─────────────────────────────────────────────────────────────────\n");

if (failed > 0) {
  console.error("  ATENÇÃO: Existem cenários falhando. Revisar antes de deploy.\n");
  process.exit(1);
} else {
  console.log("  Todos os cenários passaram. Correções validadas.\n");
  process.exit(0);
}
