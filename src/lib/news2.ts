// NEWS2 (National Early Warning Score 2) — extraído de MonitoramentoClinicoPage
// para reuso (Evolução, Monitoramento, etc.). Mantém EXATAMENTE a mesma
// pontuação por faixa para preservar histórico clínico.

export interface News2Params {
  respiratoryRate?: number;
  spo2?: number;
  supplementalOxygen?: boolean;
  temperature?: number;
  systolicBp?: number;
  heartRate?: number;
  /** "alert" | "voice" | "pain" | "unresponsive" (AVPU) — ausente = não pontua */
  consciousnessLevel?: string;
}

export type News2Risk = "low" | "low_key" | "medium" | "high";

export function calculateNEWS2(params: News2Params): { score: number; risk: News2Risk } {
  let score = 0;
  const { respiratoryRate, spo2, supplementalOxygen, temperature, systolicBp, heartRate, consciousnessLevel } = params;

  if (respiratoryRate != null) {
    if (respiratoryRate <= 8) score += 3;
    else if (respiratoryRate <= 11) score += 1;
    else if (respiratoryRate <= 20) score += 0;
    else if (respiratoryRate <= 24) score += 2;
    else score += 3;
  }

  if (spo2 != null) {
    if (spo2 <= 91) score += 3;
    else if (spo2 <= 93) score += 2;
    else if (spo2 <= 95) score += 1;
    else score += 0;
  }

  if (supplementalOxygen) score += 2;

  if (temperature != null) {
    if (temperature <= 35.0) score += 3;
    else if (temperature <= 36.0) score += 1;
    else if (temperature <= 38.0) score += 0;
    else if (temperature <= 39.0) score += 1;
    else score += 2;
  }

  if (systolicBp != null) {
    if (systolicBp <= 90) score += 3;
    else if (systolicBp <= 100) score += 2;
    else if (systolicBp <= 110) score += 1;
    else if (systolicBp <= 219) score += 0;
    else score += 3;
  }

  if (heartRate != null) {
    if (heartRate <= 40) score += 3;
    else if (heartRate <= 50) score += 1;
    else if (heartRate <= 90) score += 0;
    else if (heartRate <= 110) score += 1;
    else if (heartRate <= 130) score += 2;
    else score += 3;
  }

  if (consciousnessLevel && consciousnessLevel !== "alert") score += 3;

  let risk: News2Risk;
  if (score >= 7) risk = "high";
  else if (score >= 5) risk = "medium";
  else if (score === 3 && consciousnessLevel && consciousnessLevel !== "alert") risk = "low_key";
  else if (score >= 1) risk = "low";
  else risk = "low";

  return { score, risk };
}

export const news2RiskLabels: Record<News2Risk, { label: string; className: string }> = {
  low: { label: "Baixo", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  low_key: { label: "Baixo (monitorar)", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  medium: { label: "Médio", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
  high: { label: "Alto", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
};

/** Extrai número de campo de sinal vital — aceita "120/80" (pega 1º), "36,5", "36.5". */
export function parseVitalNumber(raw: string | undefined | null): number | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;
  const match = s.replace(",", ".").match(/-?\d+(\.\d+)?/);
  if (!match) return undefined;
  const n = parseFloat(match[0]);
  return Number.isFinite(n) ? n : undefined;
}
