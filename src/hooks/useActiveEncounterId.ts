import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fase B.1 — Resolve o encounter_id ATIVO do paciente atual.
 *
 * Usado pelos hooks de leitura do cockpit (evoluções, condutas, movimentos, etc.)
 * para filtrar registros pelo atendimento corrente em vez de pelo patient_id
 * da linha-leito (que é reutilizada entre ocupantes — causa raiz dos dados
 * residuais). Ver: .lovable/memory/features/encounter-id-foundation-phase-a.md
 *
 * Estratégia: prefere encontro com status diferente de 'closed' (ativo/aberto);
 * cai para o mais recente. Realtime ouve mudanças em patient_encounters do
 * próprio paciente para refletir alta/transferência imediatamente.
 */
export function useActiveEncounterId(patientId: string | null): {
  encounterId: string | null;
  loading: boolean;
} {
  const [encounterId, setEncounterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!patientId) {
      setEncounterId(null);
      return;
    }
    setLoading(true);

    const resolve = async () => {
      // 1) Tenta encontro ativo/aberto
      const { data: open } = await supabase
        .from("patient_encounters")
        .select("id, status, created_at")
        .eq("patient_id", patientId)
        .neq("status", "closed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (open?.id) {
        setEncounterId(open.id);
        setLoading(false);
        return;
      }

      // 2) Fallback: encontro mais recente (pode estar fechado)
      const { data: latest } = await supabase
        .from("patient_encounters")
        .select("id")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      setEncounterId(latest?.id || null);
      setLoading(false);
    };

    resolve().catch(() => {
      if (!cancelled) setLoading(false);
    });

    const channel = supabase
      .channel(`active-encounter-${patientId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "patient_encounters", filter: `patient_id=eq.${patientId}` },
        () => { resolve().catch(() => {}); },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [patientId]);

  return { encounterId, loading };
}
