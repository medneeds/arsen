/**
 * Calcula o diff entre duas versões de prescrição (lista de itens).
 *
 * Estratégia de match:
 * 1. Match por `id` quando disponível (mesmo item evoluído).
 * 2. Fallback por chave normalizada (nome + categoria + via) para detectar
 *    itens "iguais" entre versões diferentes que perderam o id original.
 *
 * Categorias do diff:
 *  - added       : presente em B, ausente em A
 *  - removed     : presente em A, ausente em B
 *  - suspended   : ativo em A, suspenso em B
 *  - reactivated : suspenso em A, ativo em B
 *  - changed     : presente em ambos com diferenças (dose, frequência, via, instruções...)
 *  - unchanged   : presente em ambos sem alterações relevantes
 */

export type DiffStatus =
  | "added"
  | "removed"
  | "suspended"
  | "reactivated"
  | "changed"
  | "unchanged";

export interface DiffField {
  field: string;
  label: string;
  before?: string;
  after?: string;
}

export interface PrescriptionDiffEntry {
  status: DiffStatus;
  category: string;
  name: string;
  before?: any;
  after?: any;
  changes: DiffField[];
}

export interface PrescriptionDiffSummary {
  added: number;
  removed: number;
  suspended: number;
  reactivated: number;
  changed: number;
  unchanged: number;
  total: number;
}

const TRACKED_FIELDS: Array<{ key: string; label: string }> = [
  { key: "dose", label: "Dose" },
  { key: "frequency", label: "Frequência" },
  { key: "schedule", label: "Frequência" },
  { key: "route", label: "Via" },
  { key: "diluent", label: "Diluente" },
  { key: "diluentVolume", label: "Vol. diluente" },
  { key: "infusionTime", label: "Tempo infusão" },
  { key: "rate", label: "Vazão" },
  { key: "instructions", label: "Instruções" },
  { key: "observations", label: "Observações" },
  { key: "presentation", label: "Apresentação" },
  { key: "concentration", label: "Concentração" },
];

function normalize(s: any): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function makeFallbackKey(item: any): string {
  return [
    normalize(item?.name),
    normalize(item?.category),
    normalize(item?.route ?? ""),
  ].join("|");
}

function detectChanges(before: any, after: any): DiffField[] {
  const changes: DiffField[] = [];
  const seen = new Set<string>();
  for (const { key, label } of TRACKED_FIELDS) {
    if (seen.has(label)) continue;
    const a = before?.[key];
    const b = after?.[key];
    if (normalize(a) === normalize(b)) continue;
    if ((a == null || a === "") && (b == null || b === "")) continue;
    changes.push({
      field: key,
      label,
      before: a == null || a === "" ? "—" : String(a),
      after: b == null || b === "" ? "—" : String(b),
    });
    seen.add(label);
  }
  return changes;
}

export function computePrescriptionDiff(
  beforeItems: any[] = [],
  afterItems: any[] = []
): { entries: PrescriptionDiffEntry[]; summary: PrescriptionDiffSummary } {
  const entries: PrescriptionDiffEntry[] = [];
  const usedAfterIdx = new Set<number>();

  // Index after-items by id and by fallback key
  const afterById = new Map<string, number>();
  const afterByKey = new Map<string, number[]>();
  afterItems.forEach((it, idx) => {
    if (it?.id) afterById.set(it.id, idx);
    const k = makeFallbackKey(it);
    if (!afterByKey.has(k)) afterByKey.set(k, []);
    afterByKey.get(k)!.push(idx);
  });

  // Walk the before-list
  for (const beforeItem of beforeItems) {
    let afterIdx: number | undefined;

    if (beforeItem?.id && afterById.has(beforeItem.id)) {
      afterIdx = afterById.get(beforeItem.id);
    } else {
      const key = makeFallbackKey(beforeItem);
      const candidates = (afterByKey.get(key) || []).filter(
        (i) => !usedAfterIdx.has(i)
      );
      if (candidates.length > 0) afterIdx = candidates[0];
    }

    if (afterIdx === undefined) {
      entries.push({
        status: "removed",
        category: beforeItem?.category ?? "outros",
        name: beforeItem?.name ?? "(sem nome)",
        before: beforeItem,
        changes: [],
      });
      continue;
    }

    usedAfterIdx.add(afterIdx);
    const afterItem = afterItems[afterIdx];

    const beforeActive = beforeItem?.status !== "suspended";
    const afterActive = afterItem?.status !== "suspended";

    if (beforeActive && !afterActive) {
      entries.push({
        status: "suspended",
        category: afterItem?.category ?? "outros",
        name: afterItem?.name ?? beforeItem?.name ?? "(sem nome)",
        before: beforeItem,
        after: afterItem,
        changes: detectChanges(beforeItem, afterItem),
      });
      continue;
    }

    if (!beforeActive && afterActive) {
      entries.push({
        status: "reactivated",
        category: afterItem?.category ?? "outros",
        name: afterItem?.name ?? beforeItem?.name ?? "(sem nome)",
        before: beforeItem,
        after: afterItem,
        changes: detectChanges(beforeItem, afterItem),
      });
      continue;
    }

    const changes = detectChanges(beforeItem, afterItem);
    entries.push({
      status: changes.length > 0 ? "changed" : "unchanged",
      category: afterItem?.category ?? "outros",
      name: afterItem?.name ?? "(sem nome)",
      before: beforeItem,
      after: afterItem,
      changes,
    });
  }

  // Anything in `after` not yet matched is new
  afterItems.forEach((afterItem, idx) => {
    if (usedAfterIdx.has(idx)) return;
    entries.push({
      status: "added",
      category: afterItem?.category ?? "outros",
      name: afterItem?.name ?? "(sem nome)",
      after: afterItem,
      changes: [],
    });
  });

  const summary: PrescriptionDiffSummary = {
    added: 0,
    removed: 0,
    suspended: 0,
    reactivated: 0,
    changed: 0,
    unchanged: 0,
    total: entries.length,
  };
  for (const e of entries) summary[e.status] += 1;

  return { entries, summary };
}
