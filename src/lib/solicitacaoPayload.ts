import { asUuidOrNull } from "@/lib/utils";

/**
 * Snapshot do documento solicitado, gravado em exam_requests.document_payload.
 *
 * `version` não é enfeite: o formulário da AIH tem 33 campos e vai mudar.
 * Sem ele, acrescentar um campo daqui a dois meses quebraria a reimpressão de
 * tudo que já foi gravado antes.
 */
export interface DocumentPayload {
  /**
   * Cada `kind` corresponde a um IMPRESSO proprio, e e por ele que o historico
   * decide qual documento reemitir (fase 5). Sao seis, nao tres: a fase 2
   * cobriu apac/aih/generica e deixou de fora hemocomponente, sat e cultura,
   * que tem impresso diferenciado e gravavam direto em exam_requests.
   */
  kind: "apac" | "aih" | "generica" | "hemocomponente" | "sat" | "cultura";
  version: number;
  data: Record<string, unknown>;
}

export interface SolicitacaoInput {
  /** Mantém a taxonomia existente: laboratorio, imagem, parecer, procedimento,
   *  terapeutico, regulacao, cultura, hemocomponente. NÃO unificar — esses
   *  valores já são lidos por useNirMetrics, pelo centro de notificações do
   *  gestor e pelos filtros da aba de solicitações. */
  category: string;
  patientId?: string | null;
  patientRegistryId?: string | null;
  patientName: string;
  patientBed?: string | null;
  patientSector?: string | null;
  items: { name: string }[];
  clinicalIndication?: string | null;
  /** 'rotina' | 'urgente' | 'programado'. Default: rotina. */
  priority?: string;
  notes?: string | null;
  requestedBy: string;
  requestedByName: string;
  hospitalUnitId: string;
  stateId: string;
  /** Quando presente, permite reimprimir o documento a partir do histórico. */
  documentPayload?: DocumentPayload;
}

/** Erro de solicitação — carrega a causa original para diagnóstico. */
export class SolicitacaoError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "SolicitacaoError";
  }
}

/**
 * Monta a linha de solicitacoes_exame a partir da entrada das três fichas.
 *
 * MIGRAÇÃO (Wave3): exam_requests → solicitacoes_exame. A tabela nova pendura em
 * `internacao_id` (o patientId das telas) e só tem campos clínicos. As colunas
 * antigas de paciente/unidade/solicitante/snapshot NÃO existem no schema novo e
 * foram DEGRADADAS (removidas do payload):
 *   - patient_registry_id, patient_name, patient_bed, patient_sector → sem coluna
 *   - hospital_unit_id, state_id → sem coluna (escopo passa a ser via RLS)
 *   - requested_by_name → sem coluna (nome vem por join profissionais na leitura)
 *   - document_payload → sem coluna (snapshot de reimpressão indisponível)
 * Mapeamento: category→categoria, items→itens, clinical_indication→
 * indicacao_clinica, priority→prioridade, notes→observacoes.
 *
 * `solicitado_por` é FK de profissionais.id (≠ auth.uid) e NÃO é resolvido aqui:
 * esta função é PURA (sem I/O). registrarSolicitacao resolve o profissional a
 * partir de input.requestedBy e mescla o campo antes do insert.
 *
 * Vive separado de registrarSolicitacao porque ali há I/O: aquele módulo
 * importa o client do Supabase, que lê import.meta.env e não carrega sob tsx.
 * Aqui é função pura — dá para testar as normalizações (trim, null, default de
 * prioridade, UUID) sem tocar em banco nenhum.
 */
export function buildSolicitacaoRow(
  input: SolicitacaoInput,
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    categoria: input.category,
    // internacao_id é NOT NULL. Só persiste UUID real (evita mocks tipo "uti2-01");
    // sem UUID, o insert falha por constraint — comportamento esperado (não há
    // mais colunas de paciente avulso para pendurar a solicitação).
    internacao_id: asUuidOrNull(input.patientId),
    itens: input.items,
    indicacao_clinica: input.clinicalIndication?.trim() || null,
    prioridade: input.priority || "rotina",
    observacoes: input.notes?.trim() || null,
    // CHECK solicitacoes_exame_status_check: pendente | em_andamento | concluido | cancelado.
    // O código antigo gravava "pending" (inglês) → violava a constraint.
    status: "pendente",
  };
  // MIGRAÇÃO: document_payload não tem coluna em solicitacoes_exame → NÃO emitido.
  // isMissingDocumentPayloadColumn permanece como guarda defensiva nos callers.
  return row;
}

/** A coluna document_payload existe? Detecta o erro de schema do PostgREST. */
export function isMissingDocumentPayloadColumn(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err ?? "");
  return msg.includes("document_payload");
}
