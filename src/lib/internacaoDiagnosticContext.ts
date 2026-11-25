/**
 * Contexto diagnostico da internacao — mapeamento puro entre o view-model da
 * evolucao e as colunas de `internacoes`. Sem dependencias (testavel via tsx).
 *
 *   previsao_alta             -> previsao de alta da UTI/UCI
 *   previsao_alta_hospitalar  -> previsao de alta hospitalar
 *   paliativo                 -> cuidados paliativos
 *   precaucao_isolamento      -> precaucao/isolamento vigente
 */
export interface PatientDiagnosticContext {
  /** Previsao de alta da UTI/UCI (ISO yyyy-MM-dd ou string livre legada) */
  utiDischargePrediction: string;
  /** Previsao de alta hospitalar (ISO yyyy-MM-dd) */
  hospitalDischargePrediction: string;
  isPalliative: boolean;
  isolationPrecautions: string;
}

export type DiagnosticContextField = keyof PatientDiagnosticContext;

export const DIAGNOSTIC_CONTEXT_COLUMN: Record<DiagnosticContextField, string> = {
  utiDischargePrediction: "previsao_alta",
  hospitalDischargePrediction: "previsao_alta_hospitalar",
  isPalliative: "paliativo",
  isolationPrecautions: "precaucao_isolamento",
};

export const EMPTY_DIAGNOSTIC_CONTEXT: PatientDiagnosticContext = {
  utiDischargePrediction: "",
  hospitalDischargePrediction: "",
  isPalliative: false,
  isolationPrecautions: "",
};

export interface InternacaoDiagRow {
  previsao_alta?: string | null;
  previsao_alta_hospitalar?: string | null;
  paliativo?: boolean | null;
  precaucao_isolamento?: string | null;
}

export function fromInternacaoRow(row: InternacaoDiagRow | null | undefined): PatientDiagnosticContext {
  if (!row) return { ...EMPTY_DIAGNOSTIC_CONTEXT };
  return {
    utiDischargePrediction: row.previsao_alta ?? "",
    hospitalDischargePrediction: row.previsao_alta_hospitalar ?? "",
    isPalliative: row.paliativo === true,
    isolationPrecautions: row.precaucao_isolamento ?? "",
  };
}

/** Valor gravado na coluna: texto vazio vira null; paliativo e sempre boolean. */
export function toColumnValue(field: DiagnosticContextField, value: string | boolean): string | boolean | null {
  if (field === "isPalliative") return value === true;
  const s = String(value ?? "").trim();
  return s ? s : null;
}

/** Normaliza hipoteses/antecedentes (array ou texto com quebras) para lista de itens. */
export function toHypothesesList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x ?? "").trim()).filter(Boolean);
  if (typeof v === "string") return v.split("\n").map((x) => x.trim()).filter(Boolean);
  return [];
}
