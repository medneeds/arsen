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

/** Opcao do seletor que REGISTRA a ausencia de precaucao (gravada como texto). */
export const NO_PRECAUTION = "Sem precaução";

/**
 * Ha precaucao/isolamento VIGENTE? Vazio e "Sem precaução" nao contam: o mapa e
 * o painel nao podem exibir "Sem precaução" como selo de isolamento.
 */
export function hasActivePrecaution(v: string | null | undefined): boolean {
  const s = (v ?? "").trim();
  if (!s) return false;
  const norm = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return norm(s) !== norm(NO_PRECAUTION);
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

// ─── Snapshot na evolucao ──────────────────────────────────────────────────
// Previsoes, precaucao e paliativo sao ESTADO VIVO da internacao (mudam ao longo
// dos dias). A evolucao validada e documento clinico: guarda no soap o valor
// vigente no momento da assinatura, como ja faz com o CID (__cid_*). Leitura:
// validada -> snapshot (nunca o valor de hoje); rascunho -> valor vivo.

export const DIAGNOSTIC_SNAPSHOT_KEY = "__diag_ctx";

export interface DiagnosticContextSnapshot extends PatientDiagnosticContext {
  captured_at: string;
}

export function buildDiagnosticSnapshot(
  row: InternacaoDiagRow | null | undefined,
  capturedAt: string = new Date().toISOString(),
): DiagnosticContextSnapshot {
  return { ...fromInternacaoRow(row), captured_at: capturedAt };
}

/** Le o snapshot do soap; null se ausente/invalido (evolucoes validadas antes desta versao). */
export function readDiagnosticSnapshot(soap: unknown): PatientDiagnosticContext | null {
  if (!soap || typeof soap !== "object") return null;
  const raw = (soap as Record<string, unknown>)[DIAGNOSTIC_SNAPSHOT_KEY];
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    utiDischargePrediction: str(r.utiDischargePrediction),
    hospitalDischargePrediction: str(r.hospitalDischargePrediction),
    isPalliative: r.isPalliative === true,
    isolationPrecautions: str(r.isolationPrecautions),
  };
}

/** Qual contexto exibir: validada usa SO o snapshot; rascunho usa o vivo (fallback snapshot). */
export function resolveDiagnosticContextForDisplay(
  isValidated: boolean,
  soap: unknown,
  live: PatientDiagnosticContext | null | undefined,
): PatientDiagnosticContext | null {
  const snap = readDiagnosticSnapshot(soap);
  if (isValidated) return snap;
  return live ?? snap;
}

/** ISO yyyy-MM-dd -> dd/MM/yyyy; outros formatos (legado livre) passam como estao. */
export function formatPredictionDate(v: string): string {
  const s = (v ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}

export interface DiagnosticContextLine { label: string; value: string }

/**
 * Linhas exibidas na evolucao validada e no impresso, na ordem do bloco
 * Diagnosticos. Previsoes e precaucao so aparecem quando preenchidas;
 * paliativo aparece sempre (Sim/Nao), pois "nao" tambem e informacao.
 */
export function diagnosticContextLines(ctx: PatientDiagnosticContext | null | undefined): DiagnosticContextLine[] {
  if (!ctx) return [];
  const lines: DiagnosticContextLine[] = [];
  const uti = ctx.utiDischargePrediction.trim();
  const hosp = ctx.hospitalDischargePrediction.trim();
  const iso = ctx.isolationPrecautions.trim();
  if (uti) lines.push({ label: "Previsão de alta UTI/UCI", value: formatPredictionDate(uti) });
  if (hosp) lines.push({ label: "Previsão de alta hospitalar", value: formatPredictionDate(hosp) });
  if (iso) lines.push({ label: "Precaução / Isolamento", value: iso });
  lines.push({ label: "Cuidados paliativos", value: ctx.isPalliative ? "Sim" : "Não" });
  return lines;
}
