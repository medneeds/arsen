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

/**
 * Campos que aparecem no comparativo entre versões da prescrição.
 *
 * POR QUE A LISTA CRESCEU (16/09/2026)
 * Rastreavam-se 12 campos, e TRÊS deles nem existiam no item: "frequency",
 * "observations" e "rate" são nomes mortos — o item usa schedule, instructions
 * e infusionRate. Dos 85 campos que o item realmente tem, ficavam de fora a
 * quantidade, o volume total, a reconstituição, a dose de nebulização, o fluxo
 * de oxigênio, a configuração inteira de dieta e os campos de antimicrobiano
 * exigidos pela CCIH.
 *
 * Na prática: o médico trocava o volume da dieta ou o solvente de
 * reconstituição, gerava uma versão nova, e o comparativo dizia "nenhuma
 * alteração". Num documento assinado, isso não é só incômodo — o diff É o
 * registro do que mudou entre duas versões.
 *
 * CRITÉRIO
 * Entra o que muda COMO O PACIENTE RECEBE: dose, via, preparo, velocidade,
 * horário, e as decisões clínicas que acompanham o item. Ficam de fora
 * identificadores, rótulos de exibição e estado de fluxo (id, validated,
 * printOnly, pharmacyFilled), que mudam sem alterar a administração e só
 * poluiriam o comparativo.
 *
 * Rastrear os 85 deixaria o diff ilegível; rastrear 12 era cegueira.
 */
const TRACKED_FIELDS: Array<{ key: string; label: string }> = [
  // ── O essencial da administração ──
  { key: "dose", label: "Dose" },
  { key: "quantity", label: "Quantidade" },
  { key: "quantityUnit", label: "Unidade" },
  { key: "route", label: "Via" },
  { key: "schedule", label: "Frequência" },
  { key: "posology", label: "Posologia" },
  { key: "presentation", label: "Apresentação" },
  { key: "action", label: "Fazer/Retirar" },

  // ── Preparo e infusão ──
  { key: "diluent", label: "Diluente" },
  { key: "diluentVolume", label: "Vol. diluente" },
  { key: "reconstitutionSolvent", label: "Solvente de reconstituição" },
  { key: "reconstitutionVolume", label: "Vol. de reconstituição" },
  { key: "enteralDilutionVolume", label: "Vol. diluição p/ sonda" },
  { key: "infusionTime", label: "Tempo de infusão" },
  { key: "infusionTimeUnit", label: "Unidade do tempo" },
  { key: "infusionRate", label: "Vazão" },
  { key: "infusionMode", label: "Modo de infusão" },
  { key: "volumeTotal", label: "Volume total" },
  { key: "concentration", label: "Concentração" },
  { key: "ivBolus", label: "Bolus EV" },
  { key: "accessType", label: "Acesso" },

  // ── Inalação e oxigênio ──
  { key: "nebDose", label: "Dose de nebulização" },
  { key: "nebDoseUnit", label: "Unidade da nebulização" },
  { key: "oxygenFlow", label: "Fluxo de O₂" },
  { key: "inhalationInterface", label: "Interface inalatória" },
  { key: "inhalationMode", label: "Modo inalatório" },
  { key: "puffs", label: "Puffs" },
  { key: "spacer", label: "Espaçador" },
  { key: "stageDuration", label: "Duração por etapa" },
  { key: "continuousDuration", label: "Duração contínua" },

  // ── Nutrição ──
  { key: "nutritionType", label: "Tipo de nutrição" },
  { key: "dietType", label: "Tipo de dieta" },
  { key: "dietProfile", label: "Perfil da dieta" },
  { key: "dietInterval", label: "Intervalo da dieta" },
  { key: "nutConsistency", label: "Consistência" },
  { key: "nutAccess", label: "Via/acesso nutricional" },
  { key: "nutVolDay", label: "Volume/dia" },
  { key: "nutFraction", label: "Tomadas/dia" },
  { key: "nutMode", label: "Modo de administração" },
  { key: "nutScheduleMode", label: "Esquema" },
  { key: "nutSteps", label: "Etapas" },
  { key: "nutProgression", label: "Progressão" },
  { key: "nutBedHead", label: "Cabeceira" },
  { key: "nutResidualCheck", label: "Checagem de resíduo" },
  { key: "nutNightPause", label: "Pausa noturna" },
  { key: "nutWaterVolPerAdmin", label: "Água por administração" },
  { key: "nutWaterFreq", label: "Frequência da água" },
  { key: "nutZeroReason", label: "Motivo do jejum" },

  // ── Antimicrobiano (exigências da CCIH) ──
  { key: "atbStartDate", label: "Início do ATB" },
  { key: "atbPlannedDays", label: "Duração prevista" },
  { key: "atbInfectionSite", label: "Sítio de infecção" },
  { key: "atbJustification", label: "Justificativa" },
  { key: "atbCultureCollected", label: "Cultura colhida" },
  { key: "atbCultureResult", label: "Resultado da cultura" },

  // ── Texto e sinalização clínica ──
  { key: "instructions", label: "Recomendações" },
  { key: "guidance", label: "Orientação" },
  { key: "highAlert", label: "Alta vigilância" },
  { key: "doubleCheck", label: "Dupla checagem" },
  { key: "controlled", label: "Controlado" },
  { key: "controlledList", label: "Lista de controle" },
  { key: "status", label: "Situação" },
  { key: "suspensionReason", label: "Motivo da suspensão" },
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

/**
 * Campo booleano ausente e campo booleano false são a MESMA coisa clinicamente:
 * a sinalização não está ligada. Sem esta normalização, um item antigo sem o
 * campo comparado a um item novo com `false` aparecia como alteração —
 * "Dupla checagem: — → false" — ruído puro num documento assinado.
 */
function exibir(v: unknown): string {
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (v == null || v === "") return "—";
  return String(v);
}

function comparavel(v: unknown): string {
  if (typeof v === "boolean") return v ? "sim" : "nao";
  if (v == null || v === "") return "";
  return normalize(v);
}

function detectChanges(before: any, after: any): DiffField[] {
  const changes: DiffField[] = [];
  const seen = new Set<string>();
  for (const { key, label } of TRACKED_FIELDS) {
    if (seen.has(label)) continue;
    const a = before?.[key];
    const b = after?.[key];
    const ehBooleano = typeof a === "boolean" || typeof b === "boolean";
    const va = ehBooleano ? comparavel(a ?? false) : comparavel(a);
    const vb = ehBooleano ? comparavel(b ?? false) : comparavel(b);
    if (va === vb) continue;
    if (va === "" && vb === "") continue;
    changes.push({
      field: key,
      label,
      before: ehBooleano ? exibir(a ?? false) : exibir(a),
      after: ehBooleano ? exibir(b ?? false) : exibir(b),
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
