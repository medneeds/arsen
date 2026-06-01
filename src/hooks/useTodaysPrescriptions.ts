import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TodaysPrescriptionStatus = "signed" | "validated" | "pending";

/**
 * Subscribes to prescriptions of a hospital unit and returns a map of
 * patientName (trimmed, uppercased) → status for the CURRENT day.
 *
 * - "signed": there is at least one prescription with status='signed' whose
 *   created_at is within today (local time).
 * - "pending": otherwise (no signed prescription today; may have draft).
 *
 * Used by the Painel Clínico list dot indicator. Realtime keeps it in sync
 * when prescriptions are signed/validated in another tab.
 */
export function useTodaysPrescriptions(hospitalUnitId: string | null) {
  const [signedToday, setSignedToday] = useState<Set<string>>(new Set());

  const fetchAll = useCallback(async () => {
    if (!hospitalUnitId) {
      setSignedToday(new Set());
      return;
    }
    // 🔒 Filtrar por updated_at — não created_at.
    // A prescrição pode ser criada ontem (created_at = ontem) e validada
    // hoje (updated_at = hoje). Filtrar por created_at exclui esses casos.
    // Janela: últimas 24h para cobrir prescrições validadas em qualquer turno.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    // Buscar validated/signed E draft (para cobrir prescrições com itens validados
    // que ainda têm status='draft' no banco por bug anterior)
    const { data, error } = await supabase
      .from("prescriptions")
      .select("patient_name, status, updated_at, items")
      .eq("hospital_unit_id", hospitalUnitId)
      .in("status", ["signed", "validated", "draft"])
      .gte("updated_at", since.toISOString());
    if (error || !data) {
      setSignedToday(new Set());
      return;
    }
    const next = new Set<string>();
    for (const row of data as any[]) {
      if (!row?.patient_name) continue;
      // Status explícito de validação
      if (row.status === "signed" || row.status === "validated") {
        next.add(String(row.patient_name).trim().toUpperCase());
        continue;
      }
      // Fallback: draft com todos os itens ativos validados (bug legado no banco)
      if (row.status === "draft" && Array.isArray(row.items)) {
        const activeItems = row.items.filter((i: any) => i.status === "active");
        if (activeItems.length > 0 && activeItems.every((i: any) => i.validated)) {
          next.add(String(row.patient_name).trim().toUpperCase());
        }
      }
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
      if (!patientName) return "pending";
      return signedToday.has(patientName.trim().toUpperCase()) ? "validated" : "pending";
    },
    [signedToday],
  );

  return { getStatus, signedToday, refresh: fetchAll };
}
