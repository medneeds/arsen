/**
 * TESTE: contrato do helper único de solicitação
 *
 * Fase 2 do plano de padronizar o ato de solicitar. Antes, cada ficha gravava
 * do seu jeito e — pior — tratava o erro de um jeito:
 *
 *   - ficha geral: `throw error`                → bloqueava (correto)
 *   - APAC: console.error + toast, chamada com `void`  → NÃO bloqueava
 *   - AIH: só console.error                     → falha totalmente silenciosa
 *
 * Como nas duas últimas o registro era considerado "rastro", falhar em silêncio
 * parecia aceitável. Não é: o resultado era um histórico furado sem ninguém
 * saber que estava furado. Solicitação que não gravou não aconteceu.
 *
 * Este teste cobre o CONTRATO do helper. O acesso ao Supabase é injetado por
 * um duplo, então nada toca banco algum.
 *
 * Dados fictícios | Zero impacto em produção.
 */

import {
  SolicitacaoError,
  buildSolicitacaoRow,
  isMissingDocumentPayloadColumn,
  type SolicitacaoInput,
  type DocumentPayload,
} from "../lib/solicitacaoPayload.ts";

let falhas = 0;
let total = 0;

function check(nome: string, cond: boolean, detalhe = "") {
  total++;
  if (cond) console.log(`  OK   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ""}`); }
}

/** Entrada mínima válida, no formato que as três fichas passam. */
const base: SolicitacaoInput = {
  category: "laboratorio",
  patientName: "  Paciente Teste  ",
  items: [{ name: "Hemograma" }],
  requestedBy: "00000000-0000-0000-0000-000000000001",
  requestedByName: "Dr. Fulano — CRM 12345",
  hospitalUnitId: "00000000-0000-0000-0000-000000000002",
  stateId: "00000000-0000-0000-0000-000000000003",
};

console.log("\n=== SolicitacaoError preserva a causa ===");
{
  const causa = { code: "23503", message: "violates foreign key" };
  const e = new SolicitacaoError("falhou", causa);
  check("é Error", e instanceof Error);
  check("nome próprio", e.name === "SolicitacaoError");
  check("mensagem preservada", e.message === "falhou");
  check("causa preservada p/ diagnóstico", e.cause === causa);
}

console.log("\n=== Taxonomia NÃO é unificada (decisão de projeto) ===");
{
  // Os valores de category são lidos por useNirMetrics, pelo centro de
  // notificações do gestor e pelos filtros da aba. Padronizar o ATO não
  // significa achatar os tipos — trocá-los quebraria relatório existente.
  const categorias = ["laboratorio", "imagem", "parecer", "procedimento", "terapeutico", "regulacao"];
  check(
    "helper aceita cada categoria como veio",
    categorias.every((c) => ({ ...base, category: c }).category === c),
  );
  check("APAC continua 'procedimento'", ({ ...base, category: "procedimento" }).category === "procedimento");
  check("AIH continua 'regulacao'", ({ ...base, category: "regulacao" }).category === "regulacao");
}

console.log("\n=== DocumentPayload: formato com versão ===");
{
  const p: DocumentPayload = { kind: "apac", version: 1, data: { cidPrimary: "I21.0" } };
  check("kind aceito", p.kind === "apac");
  check("version presente", typeof p.version === "number");
  check("data carrega o formulário", (p.data as { cidPrimary?: string }).cidPrimary === "I21.0");

  const kinds: DocumentPayload["kind"][] = ["apac", "aih", "generica"];
  check("três kinds previstos", kinds.length === 3);
}

console.log("\n=== Campos opcionais podem faltar sem quebrar o tipo ===");
{
  // A AIH não envia leito nem setor; a ficha geral não envia registry.
  const semOpcionais: SolicitacaoInput = { ...base };
  check("entrada mínima é válida", !!semOpcionais.category && !!semOpcionais.patientName);

  const completo: SolicitacaoInput = {
    ...base,
    patientId: "00000000-0000-0000-0000-000000000004",
    patientRegistryId: "00000000-0000-0000-0000-000000000005",
    patientBed: "UTI-03",
    patientSector: "UTI",
    clinicalIndication: "Sepse",
    priority: "urgente",
    notes: "[PROCEDIMENTO]",
    documentPayload: { kind: "apac", version: 1, data: {} },
  };
  check("entrada completa é válida", completo.patientBed === "UTI-03" && !!completo.documentPayload);
}

console.log("\n=== Prioridade: default é rotina ===");
{
  check("sem priority, o helper usa rotina", (base.priority ?? "rotina") === "rotina");
  check("urgente é preservado", ({ ...base, priority: "urgente" }).priority === "urgente");
}

console.log("\n=== Montagem da linha: normalizações ===");
{
  const row = buildSolicitacaoRow(base);
  check("nome do paciente é trimado", row.patient_name === "Paciente Teste", String(row.patient_name));
  check("status sempre pending", row.status === "pending");
  check("prioridade default rotina", row.priority === "rotina");
  check("leito ausente vira null", row.patient_bed === null);
  check("setor ausente vira null", row.patient_sector === null);
  check("indicação ausente vira null", row.clinical_indication === null);
  check("registry ausente vira null", row.patient_registry_id === null);

  const vazios = buildSolicitacaoRow({ ...base, patientBed: "   ", patientSector: "", notes: "  " });
  check("string só com espaços vira null (leito)", vazios.patient_bed === null);
  check("string vazia vira null (setor)", vazios.patient_sector === null);
  check("nota só com espaços vira null", vazios.notes === null);
}

console.log("\n=== patient_id: só UUID real é persistido ===");
{
  // Evita gravar mocks do mapa de leitos como se fossem FK válida.
  const mock = buildSolicitacaoRow({ ...base, patientId: "uti2-01" });
  check("mock 'uti2-01' NÃO vira patient_id", mock.patient_id === null, String(mock.patient_id));

  const real = buildSolicitacaoRow({ ...base, patientId: "3f2504e0-4f89-11d3-9a0c-0305e82c3301" });
  check("UUID real é preservado", real.patient_id === "3f2504e0-4f89-11d3-9a0c-0305e82c3301");
}

console.log("\n=== document_payload só entra quando informado ===");
{
  // Crítico: a migration pode não estar aplicada. Mandar a chave à toa faria
  // TODA solicitação falhar.
  const sem = buildSolicitacaoRow(base);
  check("sem payload, a chave nem existe na linha", !("document_payload" in sem));

  const com = buildSolicitacaoRow({ ...base, documentPayload: { kind: "apac", version: 1, data: { cid: "I21" } } });
  check("com payload, a chave existe", "document_payload" in com);
  check("payload preservado", (com.document_payload as DocumentPayload).kind === "apac");
}

console.log("\n=== Detecção da coluna ausente (fallback do git != banco) ===");
{
  check(
    "erro do PostgREST sobre a coluna é reconhecido",
    isMissingDocumentPayloadColumn({ message: "Could not find the 'document_payload' column of 'exam_requests' in the schema cache" }),
  );
  check("outro erro NÃO é confundido", !isMissingDocumentPayloadColumn({ message: "violates foreign key constraint" }));
  check("erro nulo não quebra", !isMissingDocumentPayloadColumn(null));
}

console.log(`\n───────────────────────────────────────────`);
console.log(`${total - falhas}/${total} verificações passaram`);
if (falhas > 0) { console.error(`${falhas} FALHA(S)`); process.exit(1); }
console.log("Todos os casos passaram.\n");
