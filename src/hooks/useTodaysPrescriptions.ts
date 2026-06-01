import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TodaysPrescriptionStatus = "signed" | "validated" | "pending";

const normalizeName = (raw: string | null | undefined): string => {
  if (!raw) return "";
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
};

/**
 * Painel Clínico — bolinha verde "Validada" = prescrição ASSINADA pelo médico hoje
 * (validação clínica, não farmacêutica).
 *
 * - "validated": existe ≥1 prescrição com status='signed' (ou legacy 'validated')
 *   criada hoje na unidade, ativa (archived_at IS NULL).
 * - "pending": caso contrário.
 *
 * Realtime mantém em sincronia ao assinar em outra aba.
 */
export function useTodaysPrescriptions(hospitalUnitId: string | null) {
  const [signedToday, setSignedToday] = useState<Set<string>>(new Set());

  const fetchAll = useCallback(async () => {
    if (!hospitalUnitId) {
      setSignedToday(new Set());
      return;
    }
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from("prescriptions")
      .select("patient_name, status, created_at, archived_at")
      .eq("hospital_unit_id", hospitalUnitId)
      .in("status", ["signed", "validated"])
      .is("archived_at", null)
      .gte("created_at", start.toISOString());
    if (error || !data) {
      setSignedToday(new Set());
      return;
    }
    const next = new Set<string>();
    for (const row of data as any[]) {
      const key = normalizeName(row?.patient_name);
      if (key) next.add(key);
    }
    setSignedToday(next);
  }, [hospitalUnitId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!hospitalUnitId) return;
    const channel = supabase
      .channel(`prescriptions-today-${hospitalUnitId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "prescriptions",
          filter: `hospital_unit_id=eq.${hospitalUnitId}`,
        },
        () => fetchAll(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [hospitalUnitId, fetchAll]);

  const getStatus = useCallback(
    (patientName: string | null | undefined): TodaysPrescriptionStatus => {
      const key = normalizeName(patientName);
      if (!key) return "pending";
      return signedToday.has(key) ? "validated" : "pending";
    },
    [signedToday],
  );

  return { getStatus, signedToday, refresh: fetchAll };
}
