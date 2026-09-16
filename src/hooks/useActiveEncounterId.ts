import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve o "encounter id" ATIVO do paciente atual.
 *
 * MIGRAÇÃO: a tabela patient_encounters não existe mais. No schema novo o
 * "encontro" É a própria internação — `patientId` já é `internacoes.id`.
 * Portanto o encounterId ativo é o próprio `patientId` (a internação), desde
 * que ela exista. Mantemos a assinatura `{ encounterId, loading }` para não
 * quebrar consumidores.
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
      // Confirma que a internação existe; o id dela É o encounter ativo.
      const { data } = await supabase
        .from("internacoes")
        .select("id")
        .eq("id", patientId)
        .maybeSingle();
      if (cancelled) return;
      setEncounterId(data?.id ?? null);
      setLoading(false);
    };

    resolve().catch(() => {
      if (!cancelled) setLoading(false);
    });

    // MIGRAÇÃO: realtime em "internacoes" (antes "patient_encounters"/"patients").
    const channel = supabase
      .channel(`active-encounter-${patientId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "internacoes", filter: `id=eq.${patientId}` },
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
