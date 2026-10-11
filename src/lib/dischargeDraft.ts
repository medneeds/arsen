import type { DischargeDocPayload, DischargeDocType } from "@/lib/dischargeDocuments";

/**
 * Rascunho LOCAL (so neste navegador) dos blocos do formulario de alta/obito.
 * Nao e registro clinico: o documento so existe de verdade quando a
 * sinalizacao e confirmada. Serve para ninguem perder o que digitou.
 *
 * Nunca guarda identificacao do paciente, assinatura (nome/CRM do medico) nem
 * data/hora da alta ou do obito (o padrao e "agora" e nao pode ficar velho):
 * so os campos clinicos de cada bloco, ancorados em internacao + tipo.
 */
export type DraftBlock = "summary" | "followup" | "family";

export const DISCHARGE_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

type Key = keyof DischargeDocPayload;

const FAMILY_FIELDS: Key[] = [
  "family_contact_name", "family_contact_relation", "family_contact_phone",
  "family_contact_email", "family_communication_mode", "family_communication_by",
  "family_communication_at", "family_satisfaction", "family_communication_notes",
];

/** Campos de cada bloco. Alta e obito dividem identificacao/clinico comum. */
export function draftFields(type: DischargeDocType, block: DraftBlock): Key[] {
  if (block === "family") return FAMILY_FIELDS;
  if (block === "followup") return ["return_date", "return_specialty", "restrictions"];
  const common: Key[] = ["admission_diagnosis", "final_diagnoses", "evolution_summary", "procedures", "complications"];
  if (type === "obito") {
    return [
      "death_place", ...common,
      "death_summary", "death_type", "necropsy", "do_number", "notified_family",
    ];
  }
  return ["admission_date", "discharge_type", ...common, "discharge_summary", "orientations"];
}

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
  key?(i: number): string | null;
  readonly length?: number;
}

const PREFIX = "arsen:discharge-draft";

export const draftKey = (patientId: string, type: DischargeDocType, block: DraftBlock) =>
  `${PREFIX}:${patientId}:${type}:${block}`;

export interface DraftRecord {
  savedAt: number;
  values: Partial<DischargeDocPayload>;
}

/** Guarda so os campos do bloco. Devolve false se o navegador recusar. */
export function saveDraft(
  storage: StorageLike | null,
  patientId: string,
  type: DischargeDocType,
  block: DraftBlock,
  form: Partial<DischargeDocPayload>,
  now: number = Date.now(),
): boolean {
  if (!storage) return false;
  const values: Record<string, unknown> = {};
  for (const k of draftFields(type, block)) {
    const v = form[k];
    if (v !== undefined && v !== null && String(v) !== "") values[k] = v;
  }
  try {
    storage.setItem(draftKey(patientId, type, block), JSON.stringify({ savedAt: now, values } satisfies DraftRecord));
    return true;
  } catch {
    return false;
  }
}

/** Le o rascunho; ignora vencido (> 24h), corrompido ou vazio. */
export function loadDraft(
  storage: StorageLike | null,
  patientId: string,
  type: DischargeDocType,
  block: DraftBlock,
  now: number = Date.now(),
): DraftRecord | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(draftKey(patientId, type, block));
    if (!raw) return null;
    const rec = JSON.parse(raw) as DraftRecord;
    if (typeof rec?.savedAt !== "number" || typeof rec.values !== "object" || rec.values === null) return null;
    if (now - rec.savedAt > DISCHARGE_DRAFT_TTL_MS) {
      storage.removeItem(draftKey(patientId, type, block));
      return null;
    }
    // So aceita chaves que pertencem ao bloco (nada de assinatura/identificacao).
    const allowed = new Set<string>(draftFields(type, block));
    const values: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rec.values)) if (allowed.has(k)) values[k] = v;
    return Object.keys(values).length > 0 ? { savedAt: rec.savedAt, values: values as Partial<DischargeDocPayload> } : null;
  } catch {
    return null;
  }
}

/** Apaga os rascunhos da internacao (apos confirmar a sinalizacao). */
export function clearDrafts(storage: StorageLike | null, patientId: string): void {
  if (!storage) return;
  try {
    for (const type of ["alta_hospitalar", "alta_pedido", "obito"] as DischargeDocType[]) {
      for (const block of ["summary", "followup", "family"] as DraftBlock[]) {
        storage.removeItem(draftKey(patientId, type, block));
      }
    }
  } catch { /* best-effort */ }
}

export function getDraftStorage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}
