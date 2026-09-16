import type { WaterOfferingState } from "@/components/shared/WaterOfferingFields";

/**
 * Plano nutricional — a configuração do Assistente de Terapia Nutricional,
 * guardada INTEIRA dentro do item de prescrição.
 *
 * POR QUE ISTO EXISTE
 * O assistente era um gerador de uso único: montava a configuração, achatava em
 * ~20 campos soltos no item e descartava o resto. Quatro consumidores (editor
 * inline, linha compacta, impresso, Guia ATM) remontavam a frase por conta
 * própria, cada um com sua lista de campos declarada à mão.
 *
 * Isso produziu, em 16/09/2026, cinco defeitos com a mesma raiz: campos que o
 * assistente passou a emitir e a lista de cópia não acompanhou (dietProfile,
 * nutAccess), unidade duplicada no volume de água, meta diária nunca enviada e
 * o texto de orientação apagado na conversão. Não foram cinco descuidos — foi
 * uma arquitetura que exige cinco listas em sincronia perfeita.
 *
 * Agora o item guarda o plano completo. A coluna `items` já é JSONB, então isto
 * persiste sem migração de banco. O assistente deixa de ser gerador e vira
 * EDITOR: reabrir a partir de um item traz tudo preenchido.
 *
 * REGRA: acrescentar um campo aqui basta. Ele chega às quatro pontas sozinho,
 * porque todas passam a derivar deste objeto em vez de copiar campo a campo.
 */

export type NutritionModality = "zero" | "oral" | "enteral" | "parenteral";

/**
 * Vias possiveis de um suplemento proteico. Declarado aqui, e nao no
 * assistente, para que o plano persistido e o componente falem o mesmo tipo —
 * duas declaracoes do mesmo conceito foi exatamente a origem dos defeitos que
 * este arquivo corrige.
 */
export type ProteinRouteKind = "oral" | "enteral" | "parenteral";

export interface ProteinOverride {
  dose: string;
  posology: string;
  route: ProteinRouteKind;
}

export interface NutritionPlan {
  /**
   * Versão do formato. Permite ler planos antigos sem adivinhação quando o
   * formato evoluir — um plano sem versão é anterior a esta mudança.
   */
  v: 1;

  modalities: NutritionModality[];
  comorbs: string[];

  oral: {
    consistency: string;
    profiles: string[];
    fraction: string;
    waterFree: boolean;
    custom: string;
  };

  enteral: {
    system: "aberto" | "fechado";
    via: string;
    formula: string;
    mode: string;
    rate: string;
    volDay: string;
    fractions: string;
    progression: boolean;
    custom: string;
  };

  /** Água via sonda: flush, programada e correção. */
  water: {
    flush: boolean;
    scheduled: boolean;
    vol: string;
    freq: string;
    correction: boolean;
    correctionVol: string;
    correctionObs: string;
  };

  /** Oferta hídrica ampliada (catálogo de águas). */
  waterOffer: {
    enabled: boolean;
    state: WaterOfferingState;
  };

  parenteral: {
    type: "central" | "periferica";
    volume: string;
    kcal: string;
    rate: string;
    obs: string;
    custom: string;
  };

  zero: {
    reason: string;
    since: string;
    hydrate: boolean;
    custom: string;
  };

  protein: {
    selected: string[];
    overrides: Record<string, ProteinOverride>;
  };

  /** Observações gerais do médico, digitadas no passo de comorbidades. */
  notes: string;
}

/**
 * Taxa de infusão derivada do plano.
 *
 * Existe porque a taxa era calculada em mais de um lugar e o item exibia
 * "Correr em 62 mL/h" mesmo com o modo INTERMITENTE selecionado — número que
 * não corresponde a nada quando a dieta vai em tomadas. Em modo intermitente ou
 * bolus, o que importa é o volume POR TOMADA, não uma vazão horária.
 */
export function deriveInfusionExpression(plan: NutritionPlan): {
  kind: "rate" | "perIntake" | "none";
  value: string;
  label: string;
} {
  const vol = parseFloat((plan.enteral.volDay || "").replace(",", "."));
  const modo = (plan.enteral.mode || "").toLowerCase();

  if (modo.includes("contínua") || modo.includes("continua") || modo.includes("bic")) {
    const rate = parseFloat((plan.enteral.rate || "").replace(",", "."));
    if (Number.isFinite(rate) && rate > 0) {
      return { kind: "rate", value: String(rate), label: "mL/h" };
    }
    if (Number.isFinite(vol) && vol > 0) {
      return { kind: "rate", value: String(Math.round(vol / 24)), label: "mL/h" };
    }
    return { kind: "none", value: "", label: "" };
  }

  const tomadas = parseInt(plan.enteral.fractions || "", 10);
  if (Number.isFinite(vol) && vol > 0 && Number.isFinite(tomadas) && tomadas > 0) {
    return {
      kind: "perIntake",
      value: String(Math.round(vol / tomadas)),
      label: "mL/tomada",
    };
  }
  return { kind: "none", value: "", label: "" };
}

/** Plano vazio, usado quando o assistente abre sem item de origem. */
export function emptyNutritionPlan(waterDefault: WaterOfferingState): NutritionPlan {
  return {
    v: 1,
    modalities: ["oral"],
    comorbs: [],
    oral: { consistency: "geral", profiles: ["livre"], fraction: "6x/dia", waterFree: true, custom: "" },
    enteral: {
      system: "fechado", via: "sne", formula: "polim_padrao", mode: "continua",
      rate: "25", volDay: "1500", fractions: "6", progression: true, custom: "",
    },
    water: {
      flush: true, scheduled: false, vol: "100", freq: "4/4h",
      correction: false, correctionVol: "", correctionObs: "",
    },
    waterOffer: { enabled: false, state: waterDefault },
    parenteral: { type: "central", volume: "1500", kcal: "", rate: "", obs: "", custom: "" },
    zero: { reason: "preop", since: "", hydrate: true, custom: "" },
    protein: { selected: [], overrides: {} },
    notes: "",
  };
}

/**
 * Aceita qualquer objeto vindo do banco e devolve um plano completo.
 *
 * Itens gravados antes desta mudança não têm plano — devolve null, e quem
 * chamar decide (o assistente abre em branco, o corpo do item continua lendo os
 * campos achatados). Nunca inventa configuração clínica a partir de nada.
 */
export function readNutritionPlan(
  bruto: unknown,
  waterDefault: WaterOfferingState,
): NutritionPlan | null {
  if (!bruto || typeof bruto !== "object") return null;
  const p = bruto as Partial<NutritionPlan>;
  if (p.v !== 1) return null;
  const base = emptyNutritionPlan(waterDefault);
  return {
    ...base,
    ...p,
    v: 1,
    modalities: Array.isArray(p.modalities) ? p.modalities : base.modalities,
    comorbs: Array.isArray(p.comorbs) ? p.comorbs : base.comorbs,
    oral: { ...base.oral, ...(p.oral ?? {}) },
    enteral: { ...base.enteral, ...(p.enteral ?? {}) },
    water: { ...base.water, ...(p.water ?? {}) },
    waterOffer: { ...base.waterOffer, ...(p.waterOffer ?? {}) },
    parenteral: { ...base.parenteral, ...(p.parenteral ?? {}) },
    zero: { ...base.zero, ...(p.zero ?? {}) },
    protein: { ...base.protein, ...(p.protein ?? {}) },
  };
}
