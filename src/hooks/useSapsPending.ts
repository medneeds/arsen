import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SapsPendingInfo {
  id: string;
  pending_since: string | null;
}

/**
 * Observa a ficha SAPS 3 PENDENTE da internação e retorna o registro (se houver).
 *
 * MIGRAÇÃO: antes consultava a tabela morta `saps3_assessments` por `patient_name`
 * e status 'pending' (inglês). A fonte viva é `avaliacoes_saps3`, ancorada em
 * `internacao_id`, com status em português ('pendente'/'validada') e `pending_since`
 * (colunas confirmadas no banco). A assinatura passou de patientName para
 * internacaoId — a mesma âncora de todo dado clínico no schema novo.
 */
export function useSapsPending(internacaoId?: string | null): SapsPendingInfo | null {
  const [pending, setPending] = useState<SapsPendingInfo | null>(null);

  useEffect(() => {
    if (!internacaoId) {
      setPending(null);
      return;
    }

    let active = true;

    const fetchPending = async () => {
      const { data } = await supabase
        .from("avaliacoes_saps3")
        .select("id, pending_since, status")
        .eq("internacao_id", internacaoId)
        .eq("status", "pendente")
        .order("criado_em", { ascending: false })
        .limit(1);
      if (!active) return;
      const row = (data as { id: string; pending_since: string | null }[] | null)?.[0];
      setPending(row ? { id: row.id, pending_since: row.pending_since } : null);
    };

    fetchPending();

    const channel = supabase
      .channel(`saps-pending-${internacaoId}`)
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "avaliacoes_saps3", filter: `internacao_id=eq.${internacaoId}` },
        () => fetchPending(),
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [internacaoId]);

  return pending;
}
