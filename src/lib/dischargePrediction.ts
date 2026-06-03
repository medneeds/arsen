/**
 * Utilitários para previsão de alta — parse, comparação e formatação.
 * Fuso horário de referência: São Luís/MA (UTC-3).
 *
 * Cobre ambos os campos canônicos:
 *   - patients.uti_discharge_prediction (UTI/UCI) — armazenado como string[] na UI
 *     e como texto multi-linha no banco (linhas separadas por \n).
 *   - patients.hospital_discharge_prediction (enfermaria/clínica) — string única.
 */

/**
 * Normaliza qualquer formato vindo do estado/banco em uma string única
 * (a primeira linha não-vazia, que é a mais recente previsão).
 */
export function normalizeDischargePrediction(
  value: string | string[] | null | undefined
): string | null {
  if (value == null) return null;
  const raw = Array.isArray(value) ? value.join("\n") : value;
  const first = raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find((s) => s.length > 0);
  return first || null;
}

/**
 * Extrai a data ISO de um label como "17/06/2026 (D+5)" ou "05/06/2026".
 * Retorna Date apontando para o FIM do dia em UTC-3 (23:59).
 */
export function parseDischargePredictionDate(
  value: string | string[] | null | undefined
): Date | null {
  const label = normalizeDischargePrediction(value);
  if (!label) return null;
  if (/sem\s+previs[ãa]o/i.test(label)) return null;
  const m = label.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return new Date(`${yyyy}-${mm}-${dd}T23:59:00-03:00`);
}

/** True se a data ainda não passou e está nas próximas 24 horas. */
export function isWithin24Hours(date: Date | null | undefined): boolean {
  if (!date) return false;
  const ms = date.getTime() - Date.now();
  return ms > 0 && ms <= 24 * 60 * 60 * 1000;
}

/**
 * Resolve a previsão "mais relevante" para um paciente, considerando ambos
 * os campos. Hospitalar tem precedência quando ambos existirem, porque é o
 * desfecho final que importa para o mapa do setor.
 */
export function resolvePatientDischargePrediction(
  patient: {
    utiDischargePrediction?: string | string[] | null;
    uti_discharge_prediction?: string | null;
    hospitalDischargePrediction?: string | null;
    hospital_discharge_prediction?: string | null;
  } | null | undefined
): { label: string | null; date: Date | null; imminent: boolean; source: "hospital" | "uti" | null } {
  if (!patient) return { label: null, date: null, imminent: false, source: null };
  const hospital = normalizeDischargePrediction(
    patient.hospitalDischargePrediction ?? patient.hospital_discharge_prediction ?? null
  );
  const uti = normalizeDischargePrediction(
    patient.utiDischargePrediction ?? patient.uti_discharge_prediction ?? null
  );
  const pick = hospital ?? uti;
  if (!pick) return { label: null, date: null, imminent: false, source: null };
  const date = parseDischargePredictionDate(pick);
  return {
    label: pick,
    date,
    imminent: isWithin24Hours(date),
    source: hospital ? "hospital" : "uti",
  };
}

/** Converte ISO "YYYY-MM-DD" em label BR "DD/MM/YYYY (D+N)" (N a partir de hoje). */
export function buildDischargePredictionLabel(isoDate: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(isoDate + "T00:00:00");
  const days = Math.max(0, Math.round((target.getTime() - today.getTime()) / 86400000));
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y} (D+${days})`;
}

/** Chave de sessionStorage para garantir 1 alerta por paciente, por sessão. */
export const dischargeAlertSessionKey = (patientId: string) =>
  `discharge_alert_shown_${patientId}`;
