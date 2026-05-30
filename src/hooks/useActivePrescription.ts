import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEncounterId } from "@/hooks/useActiveEncounterId";
import { useResolvedRegistryId } from "@/hooks/useResolvedRegistryId";

export interface ActivePrescriptionSummary {
  id: string;
  status: string;
  version: number;
  itemsCount: number;
  updatedAt: string;
  signed: boolean;
}

/**
 * Subscribes to the latest prescription of a given patient (matched by name + hospital).
 * Used by the clinical Cockpit to surface a real-time chip with the active
 * prescription status (rascunho, validada, assinada, etc.).
 *
 * Fase B.2 — quando recebe `patientId` e há encounter ativo resolvido,
 * filtra adicionalmente por `encounter_id` (igual ao ativo OU NULL legado),
 * evitando que prescrições do ocupante anterior do leito apareçam para
 * o novo paciente após transferência interna.
 */
export function useActivePrescription(
  patientName: string | null,
  hospitalUnitId: string | null,
  patientId?: string | null,
) {
  const [data, setData] = useState<ActivePrescriptionSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const { encounterId: activeEncounterId } = useActiveEncounterId(patientId ?? null);
  const { registryId: resolvedRegistryId } = useResolvedRegistryId(patientId ?? null);

  const fetch = useCallback(async () => {
    if (!patientName || !hospitalUnitId) {
      setData(null);
      return;
    }
    setLoading(true);
    let query: any = supabase
      .from("prescriptions")
      .select("id, status, version, items, digital_signature, updated_at, created_at")
      .eq("hospital_unit_id", hospitalUnitId)
      .is("archived_at", null)
      .neq("status", "draft");

    if (resolvedRegistryId && activeEncounterId && patientId) {
      // Caminho ideal: registry + encounter + patient_id.
      // OR duplo cobre prescrições legadas (patient_registry_id=NULL ou encounter=NULL).
      query = query
        .or(`patient_registry_id.eq.${resolvedRegistryId},and(patient_registry_id.is.null,patient_id.eq.${patientId})`)
        .or(`encounter_id.eq.${activeEncounterId},encounter_id.is.null`);
    } else if (resolvedRegistryId && patientId) {
      // Sem encounter: cobre registry + legados sem registry
      query = query.or(
        `patient_registry_id.eq.${resolvedRegistryId},and(patient_registry_id.is.null,patient_id.eq.${patientId})`
      );
    } else if (resolvedRegistryId) {
      query = query.eq("patient_registry_id", resolvedRegistryId);
    } else if (patientId && activeEncounterId) {
      // Sem registry: aceita encounter ativo OU legado sem carimbo do mesmo bed.
      query = query
        .eq("patient_id", patientId)
        .or(`encounter_id.eq.${activeEncounterId},encounter_id.is.null`);
    } else {
      // Fallback legado: busca por patient_name (prescrições anteriores ao
      // linking de registry/encounter ainda devem aparecer no cockpit).
      query = query.eq("patient_name", patientName.trim());
    }
    const { data: rows, error } = await query
      .order("created_at", { ascending: false })
      .limit(1);
    if (!error && rows && rows.length > 0) {
      const row: any = rows[0];
      const items = Array.isArray(row.items) ? row.items : [];
      setData({
        id: row.id,
        status: row.status || "draft",
        version: row.version || 1,
        itemsCount: items.length,
        updatedAt: row.updated_at || row.created_at,
        signed: Boolean(row.digital_signature),
      });
    } else {
      setData(null);
    }
    setLoading(false);
  }, [patientName, hospitalUnitId, patientId, activeEncounterId, resolvedRegistryId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    if (!patientName || !hospitalUnitId) return;
    const channel = supabase
      .channel(`prescription-live-${hospitalUnitId}-${patientName}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "prescriptions",
          filter: `hospital_unit_id=eq.${hospitalUnitId}`,
        },
        (payload) => {
          const row: any = payload.new || payload.old;
          if (
            (resolvedRegistryId && row?.patient_registry_id === resolvedRegistryId) ||
            (patientId && row?.patient_id === patientId) ||
            (!resolvedRegistryId && !patientId && row?.patient_name?.trim() === patientName.trim())
          ) {
            fetch();
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientName, hospitalUnitId, fetch, resolvedRegistryId]);

  return { prescription: data, loading, refresh: fetch };
}
