/**
 * Janela do "dia clínico" no fuso America/Sao_Paulo (UTC-3, sem horário de verão).
 *
 * O dia clínico vai de **05:00 SP** até **04:59:59.999 SP** do dia seguinte.
 * Antes das 05:00 SP, ainda estamos no dia clínico que começou às 05:00 do dia anterior.
 *
 * Uso típico: filtrar `prescriptions.created_at >= window.start` para carregar
 * a prescrição validada/impressa do dia atual, mesmo se o médico reabrir a aba.
 *
 * Implementação: SP é UTC-3 fixo. Em UTC, 05:00 SP = 08:00 UTC.
 * Calculamos a "hora UTC equivalente a agora em SP" e decidimos se já passou das 05h SP hoje.
 */

const SP_OFFSET_HOURS = -3; // America/Sao_Paulo é UTC-3 (sem DST desde 2019)
const CUTOFF_HOUR_SP = 5;   // 05:00 SP

export interface ClinicalDayWindow {
  /** Início da janela (05:00 SP do dia clínico atual) em UTC. */
  start: Date;
  /** Fim da janela (04:59:59.999 SP do dia seguinte) em UTC. */
  end: Date;
}

/**
 * Retorna a janela do dia clínico atual em America/Sao_Paulo.
 *
 * @param now Data de referência (default: agora). Útil para testes.
 */
export function getClinicalDayWindowSP(now: Date = new Date()): ClinicalDayWindow {
  // Converte "agora" para o instante equivalente em SP (somando o offset)
  // Ex.: 02:00 UTC = 23:00 SP (dia anterior). Trabalhamos com componentes "como se" fosse SP.
  const nowSpMs = now.getTime() + SP_OFFSET_HOURS * 60 * 60 * 1000;
  const nowSp = new Date(nowSpMs);

  // Componentes da data SP (usando getUTC* sobre o relógio deslocado)
  const ySp = nowSp.getUTCFullYear();
  const mSp = nowSp.getUTCMonth();
  const dSp = nowSp.getUTCDate();
  const hSp = nowSp.getUTCHours();

  // Se ainda não bateu 05:00 SP, o dia clínico começou às 05:00 SP de ONTEM.
  const startDayOffset = hSp < CUTOFF_HOUR_SP ? -1 : 0;

  // 05:00 SP = 08:00 UTC do mesmo dia civil SP
  const startUtcMs = Date.UTC(ySp, mSp, dSp + startDayOffset, CUTOFF_HOUR_SP - SP_OFFSET_HOURS, 0, 0, 0);
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000 - 1;

  return {
    start: new Date(startUtcMs),
    end: new Date(endUtcMs),
  };
}

/**
 * Verifica se um instante (Date ou ISO string) cai dentro do dia clínico atual SP.
 */
export function isInCurrentClinicalDaySP(when: Date | string, now: Date = new Date()): boolean {
  const t = typeof when === "string" ? new Date(when).getTime() : when.getTime();
  if (!Number.isFinite(t)) return false;
  const { start, end } = getClinicalDayWindowSP(now);
  return t >= start.getTime() && t <= end.getTime();
}
