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
 * Monta a linha de exam_requests a partir da entrada das três fichas.
 *
 * Vive separado de registrarSolicitacao porque ali há I/O: aquele módulo
 * importa o client do Supabase, que lê import.meta.env e não carrega sob tsx.
 * Aqui é função pura — dá para testar as normalizações (trim, null, default de
 * prioridade, UUID) sem tocar em banco nenhum.
 *
 * `document_payload` só entra na linha quando informado. Isso importa: a
 * migration que cria a coluna pode ainda não ter sido aplicada, e mandar a
 * chave à toa faria toda solicitação falhar.
 */
export function buildSolicitacaoRow(
  input: SolicitacaoInput,
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    category: input.category,
    // Só persiste vínculo quando o ID for UUID real (evita mocks tipo "uti2-01")
    patient_id: asUuidOrNull(input.patientId),
    patient_registry_id: input.patientRegistryId ?? null,
    patient_name: input.patientName.trim(),
    patient_bed: (input.patientBed || "").trim() || null,
    patient_sector: (input.patientSector || "").trim() || null,
    items: input.items,
    clinical_indication: input.clinicalIndication?.trim() || null,
    priority: input.priority || "rotina",
    notes: input.notes?.trim() || null,
    requested_by: input.requestedBy,
    requested_by_name: input.requestedByName,
    hospital_unit_id: input.hospitalUnitId,
    state_id: input.stateId,
    status: "pending",
  };
  if (input.documentPayload) row.document_payload = input.documentPayload;
  return row;
}

/** A coluna document_payload existe? Detecta o erro de schema do PostgREST. */
export function isMissingDocumentPayloadColumn(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err ?? "");
  return msg.includes("document_payload");
}
