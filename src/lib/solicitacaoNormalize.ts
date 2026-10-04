import { fromSolicitacaoStatusDb } from "@/lib/solicitacaoStatus";

/**
 * Normalizacao de uma linha de solicitacoes_exame para o shape que a lista, o
 * RequestCard e os builders de impressao consomem (guia de requisicao, SAT, etc).
 *
 * Fica fora da pagina para que a lista e o popup "Requisicao enviada" montem o
 * pedido de impressao EXATAMENTE do mesmo jeito. Antes o popup montava um
 * objeto proprio, sem nome/leito/setor do paciente nem solicitante, e a guia
 * impressa por ele saia com esses campos vazios.
 */

// AUTORIA: linha minima de profissionais para resolver autor (id -> nome/CRM),
// sem introduzir `any`. CRM vive em numero_conselho (nao ha coluna `crm`);
// o alias PostgREST (crm:numero_conselho) mantem o campo `crm` no view-model.
export interface ProfissionalLite {
  id: string;
  nome: string | null;
  crm: string | null;
}

export interface SolicitacaoContext {
  patientName?: string;
  patientBed?: string;
  patientSector?: string;
}

// MIGRAÇÃO: solicitacoes_exame só tem internacao_id + campos clínicos — não há
// colunas de paciente/unidade/documento/solicitante. Normaliza a linha nova
// para o shape legado que RequestCard e os builders de impressão consomem
// (todos recebem `req` como any). Campos sem coluna nova são degradados.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeSolicitacao(row: any, ctx: SolicitacaoContext) {
  return {
    id: row.id,
    internacao_id: row.internacao_id,
    patient_id: row.internacao_id, // scoping client-side usa patient_id
    patient_name: ctx.patientName || "", // MIGRAÇÃO: sem coluna → contexto do form
    patient_bed: ctx.patientBed || "", // MIGRAÇÃO: idem
    patient_sector: ctx.patientSector || "", // MIGRAÇÃO: idem
    category: row.categoria,
    items: Array.isArray(row.itens) ? row.itens : [],
    priority: row.prioridade,
    status: fromSolicitacaoStatusDb(row.status),
    clinical_indication: row.indicacao_clinica || "",
    notes: row.observacoes || "",
    results: row.resultado_texto || null,
    result_data: row.resultado_dados || null,
    completed_at: row.concluido_em || null,
    completed_by: null, // MIGRAÇÃO: concluido_por é FK profissional; nome não resolvido
    created_at: row.criado_em,
    // AUTORIA: solicitado_por e FK de profissionais.id; o nome/CRM sao resolvidos
    // (ver applyAuthor) e injetados como requested_by_name/_crm.
    solicitado_por: row.solicitado_por ?? null,
    requested_by_name: "",
    requested_by_crm: null as string | null,
    document_payload: null, // MIGRAÇÃO: sem coluna → reimpressão de snapshot indisponível
    patient_registry_id: null, // MIGRAÇÃO: sem coluna no schema novo
  };
}

export type NormalizedSolicitacao = ReturnType<typeof normalizeSolicitacao>;

/** Injeta requested_by_name/_crm do autor resolvido; sem autor, devolve a mesma solicitacao. */
export function applyAuthor<T extends NormalizedSolicitacao>(
  req: T,
  prof: ProfissionalLite | null | undefined,
): T {
  if (!prof) return req;
  return { ...req, requested_by_name: prof.nome ?? "", requested_by_crm: prof.crm ?? null };
}
