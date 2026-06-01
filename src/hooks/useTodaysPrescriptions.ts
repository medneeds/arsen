import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TodaysPrescriptionStatus = "signed" | "validated" | "pending";

/**
 * Detecta prescrições validadas hoje por hospital_unit_id.
 * Retorna dois mapas: por patient_registry_id e por patient_name (normalizado).
 *
 * Estratégia de detecção (em ordem de prioridade):
 *  1. status = 'signed' ou 'validated' → validada (pós-fix)
 *  2. items[].validatedAt dentro das últimas 36h → validada hoje/plantão
 *  3. Todos items ativos com validated=true → validada (legado sem validatedAt)
 *
 * Usa validatedAt dos itens como fonte primária — independe de updated_at
 * (que pode não ser atualizado) e de status (que estava quebrado antes do fix).
 */
export function useTodaysPrescriptions(hospitalUnitId: string | null) {
  // Dois mapas para lookup robusto
  const [validatedRegistryIds, setValidatedRegistryIds] = useState<Set<string>>(new Set());
  const [validatedNames, setValidatedNames] = useState<Set<string>>(new Set());

  const fetchAll = useCallback(async () => {
    if (!hospitalUnitId) {
      setValidatedRegistryIds(new Set());
      setValidatedNames(new Set());
      return;
    }

    // Buscar prescrições do hospital — sem filtro de data/status para não
    // perder prescrições criadas antes de hoje e validadas hoje.
    // Limitamos a 200 registros recentes por performance.
    const { data, error } = await supabase
      .from("prescriptions")
      .select("patient_name, patient_registry_id, status, items")
      .eq("hospital_unit_id", hospitalUnitId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error || !data) {
      setValidatedRegistryIds(new Set());
      setValidatedNames(new Set());
      return;
    }

    // Janela: últimas 36h (cobre plantão noturno + dia atual)
    const since = new Date(Date.now() - 36 * 60 * 60 * 1000);
    const normName = (n: string) => String(n).replace(/\s+/g, " ").trim().toUpperCase();

    const isValidatedRecently = (row: any): boolean => {
      // 1. Status explícito
      if (row.status === "signed" || row.status === "validated") return true;

      // 2. validatedAt nos itens
      const items = Array.isArray(row.items) ? row.items
        : typeof row.items === "string" ? (() => { try { return JSON.parse(row.items); } catch { return []; } })()
        : [];

      if (items.length > 0) {
        // Qualquer item validado nas últimas 36h
        const hasRecentValidation = items.some((i: any) =>
          i && i.validatedAt && new Date(i.validatedAt) >= since
        );
        if (hasRecentValidation) return true;

        // 3. Todos os itens ativos validados (sem validatedAt — legado)
        const active = items.filter((i: any) => i && i.status === "active");
        if (active.length > 0 && active.every((i: any) => !!i.validated)) return true;
      }

      return false;
    };

    const nextIds = new Set<string>();
    const nextNames = new Set<string>();

    for (const row of data as any[]) {
      if (!isValidatedRecently(row)) continue;
      if (row.patient_registry_id) nextIds.add(String(row.patient_registry_id));
      if (row.patient_name) nextNames.add(normName(row.patient_name));
    }

    setValidatedRegistryIds(nextIds);
    setValidatedNames(nextNames);
  }, [hospitalUnitId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!hospitalUnitId) return;
    const channel = supabase
      .channel(`prescriptions-today-${hospitalUnitId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "prescriptions",
        filter: `hospital_unit_id=eq.${hospitalUnitId}`,
      }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [hospitalUnitId, fetchAll]);

  const getStatus = useCallback(
    (patientName: string | null | undefined, registryId?: string | null): TodaysPrescriptionStatus => {
      // Lookup por registry_id primeiro (mais confiável)
      if (registryId && validatedRegistryIds.has(registryId)) return "validated";
      // Fallback por nome
      if (!patientName) return "pending";
      const normalized = String(patientName).replace(/\s+/g, " ").trim().toUpperCase();
      return validatedNames.has(normalized) ? "validated" : "pending";
    },
    [validatedRegistryIds, validatedNames],
  );

  return { getStatus, validatedRegistryIds, validatedNames, refresh: fetchAll };
}
