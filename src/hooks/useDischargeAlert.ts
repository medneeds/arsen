/**
 * useDischargeAlert — detecta pacientes com alta prevista nas próximas 24h
 * e exibe popup de notificação uma vez por sessão por paciente.
 *
 * Usa getClinicalDayWindowSP() para fuso horário correto (Fortaleza UTC-3).
 */
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { formatDateBR } from "@/utils/dateUtils";
import type { Patient } from "@/types/patient";

const SESSION_KEY = "discharge_alert_shown";

function getShownSet(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function markShown(patientId: string) {
  try {
    const set = getShownSet();
    set.add(patientId);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify([...set]));
  } catch {}
}

/** Extrai a primeira linha não-vazia de string | string[] | null */
function firstNonEmpty(v: string | string[] | null | undefined): string {
  if (v == null) return "";
  if (Array.isArray(v)) {
    for (const item of v) {
      if (typeof item === "string" && item.trim()) return item;
    }
    return "";
  }
  return typeof v === "string" ? v : "";
}

/** Retorna true se a data de alta está dentro das próximas 24h */
export function isWithin24h(dischargePrediction: string | null | undefined): boolean {
  if (!dischargePrediction || typeof dischargePrediction !== 'string') return false;
  const dateStr = dischargePrediction.replace(/\s*\(.*\)\s*$/, "").trim();
  const parsed = new Date(dateStr + "T12:00:00");
  if (isNaN(parsed.getTime())) return false;
  const now = Date.now();
  const ms = parsed.getTime() - now;
  return ms >= 0 && ms <= 24 * 60 * 60 * 1000;
}

/**
 * Retorna true se a data de alta está programada para AMANHÃ
 * (independente do horário — compara apenas a data do calendário).
 */
export function isTomorrow(dischargePrediction: string | null | undefined): boolean {
  if (!dischargePrediction || typeof dischargePrediction !== 'string') return false;
  const dateStr = dischargePrediction.replace(/\s*\(.*\)\s*$/, "").trim();
  const parsed = new Date(dateStr + "T12:00:00");
  if (isNaN(parsed.getTime())) return false;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return (
    parsed.getFullYear() === tomorrow.getFullYear() &&
    parsed.getMonth() === tomorrow.getMonth() &&
    parsed.getDate() === tomorrow.getDate()
  );
}

export { firstNonEmpty as _firstNonEmptyDischarge };

/**
 * Hook para o mapa de leitos — dispara popup de notificação
 * para pacientes com alta prevista nas próximas 24h.
 * Exibe no máximo uma vez por sessão por paciente.
 */
export function useDischargeAlert(patients: Patient[]) {
  const alertsShown = useRef(getShownSet());

  const imminent = useMemo(
    () =>
      patients.filter(
        (p) =>
          p.name?.trim() &&
          isWithin24h((p.utiDischargePrediction as any)?.[0] ?? null),
      ),
    [patients],
  );

  useEffect(() => {
    if (imminent.length === 0) return;
    const toShow = imminent.filter((p) => !alertsShown.current.has(p.id));
    if (toShow.length === 0) return;

    // Agrupar num único toast
    const names = toShow.map((p) => {
      const pred =
        (p.utiDischargePrediction as any)?.[0] ?? "";
      const date = formatDateBR(typeof pred === 'string' ? pred.replace(/\s*\(.*\)\s*$/, "").trim() : "");
      return `• ${p.name} (Leito ${p.bedNumber}) — Alta: ${date}`;
    });

    toast.warning(
      `Alta prevista nas próximas 24h (${toShow.length} paciente${toShow.length > 1 ? "s" : ""})`,
      {
        description: names.join("\n"),
        duration: 10000,
        id: "discharge-alert-24h",
      },
    );

    toShow.forEach((p) => {
      alertsShown.current.add(p.id);
      markShown(p.id);
    });
  }, [imminent]);

  return imminent;
}
