import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ActivePrescriptionSummary {
  id: string;
  status: string;
  version: number;
  itemsCount: number;
  updatedAt: string;
  signed: boolean;
}

/**
 * Subscribes to the latest prescription of a given patient.
 *
 * MIGRAÇÃO: prescriptions → prescricoes (ancorada por internacao_id). O
 * `patientId` já é `internacoes.id`. patient_registry/patient_encounters
 * mortos → removidos os filtros por registry/encounter e o fallback por
 * patient_name (prescricoes não tem coluna de nome). Sem patientId não há
 * como resolver a prescrição → retorna null. Colunas: version→versao,
 * items→itens, digital_signature→assinatura_digital, updated_at→atualizado_em,
 * created_at→criado_em. archived_at não existe → filtro removido.
 * `patientName`/`hospitalUnitId` mantidos na assinatura por compatibilidade.
 */
export function useActivePrescription(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  patientName: string | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  hospitalUnitId: string | null,
  patientId?: string | null,
) {
  const [data, setData] = useState<ActivePrescriptionSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!patientId) {
      setData(null);
      return;
    }
    setLoading(true);
    const { data: rows, error } = await supabase
      .from("prescricoes")
      .select("id, status, versao, itens, assinatura_digital, criado_em, atualizado_em")
      .eq("internacao_id", patientId)
      .neq("status", "draft")
      .order("criado_em", { ascending: false })
      .limit(1);
    if (!error && rows && rows.length > 0) {
      const row: any = rows[0];
      const items = Array.isArray(row.itens) ? row.itens : [];
      setData({
        id: row.id,
        status: row.status || "draft",
        version: row.versao || 1,
        itemsCount: items.length,
        updatedAt: row.atualizado_em || row.criado_em,
        signed: Boolean(row.assinatura_digital),
      });
    } else {
      setData(null);
    }
    setLoading(false);
  }, [patientId]);

  const fetchRef = useRef(fetch);
  useEffect(() => { fetchRef.current = fetch; }, [fetch]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    if (!patientId) return;
    // MIGRAÇÃO: realtime em "prescricoes" filtrado por internacao_id.
    const channel = supabase
      .channel(`prescription-live-${patientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "prescricoes",
          filter: `internacao_id=eq.${patientId}`,
        },
        () => {
          fetchRef.current();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId]);

  return { prescription: data, loading, refresh: fetch };
}
