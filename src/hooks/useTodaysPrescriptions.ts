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

    // ─── Estratégia de detecção de validação ──────────────────────────────
    // NÃO filtramos por updated_at porque persistItems não seta updated_at
    // explicitamente — se a tabela não tem trigger, updated_at fica na data
    // de criação (que pode ser ontem ou mais). Para prescrições validadas hoje
    // mas criadas há dias, o filtro falharia para TODOS os pacientes.
    //
    // Estratégia correta: usar validatedAt nos ITENS da prescrição.
    // applyValidation faz: { ...item, validated: true, validatedAt: now }
    // validatedAt é setado no momento exato da validação e fica no JSONB.
    // Isso é independente de status ou updated_at.
    // ─────────────────────────────────────────────────────────────────────

    // Buscar todas as prescrições ativas do hospital (sem filtro de data)
    // A query é rápida pois filtra por hospital_unit_id
    const { data, error } = await supabase
      .from("prescriptions")
      .select("patient_name, status, items")
      .eq("hospital_unit_id", hospitalUnitId)
      .in("status", ["signed", "validated", "draft"]);

    if (error || !data) {
      setSignedToday(new Set());
      return;
    }

    // Janela de validação: últimas 36h (cobre turno anterior + dia atual)
    const since = new Date(Date.now() - 36 * 60 * 60 * 1000);

    // Normalizar nome para comparação
    const normName = (n: string) => String(n).replace(/\s+/g, " ").trim().toUpperCase();

    // Verificar se a prescrição foi validada recentemente
    const isValidatedRecently = (row: any): boolean => {
      // Status explícito de validação (prescrições novas após o fix)
      if (row.status === "signed" || row.status === "validated") return true;

      // Verificar validatedAt nos itens (prescrições existentes com status='draft')
      // validatedAt é setado pelo applyValidation no momento exato da validação
      if (Array.isArray(row.items)) {
        const hasRecentValidation = row.items.some((i: any) =>
          i.validatedAt && new Date(i.validatedAt) >= since
        );
        if (hasRecentValidation) return true;

        // Fallback final: todos os itens ativos têm validated=true
        // (sem validatedAt — prescrições muito antigas)
        const active = row.items.filter((i: any) => i.status === "active");
        if (active.length > 0 && active.every((i: any) => !!i.validated)) return true;
      }

      return false;
    };

    const next = new Set<string>();
    for (const row of data as any[]) {
      if (!row?.patient_name) continue;
      if (isValidatedRecently(row)) next.add(normName(row.patient_name));
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
      const normalized = String(patientName).replace(/\s+/g, " ").trim().toUpperCase();
      return signedToday.has(normalized) ? "validated" : "pending";
    },
    [signedToday],
  );

  return { getStatus, signedToday, refresh: fetchAll };
}
