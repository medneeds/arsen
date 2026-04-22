import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LatestRoundSession {
  id: string;
  roundDate: string;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
  responsesCount: number;
  goalsCount: number;
}

/**
 * Realtime: última sessão do Round Multiprofissional do paciente.
 * Mostra data, número de respostas e metas registradas.
 */
export function useLatestRoundSession(patientId: string | null) {
  const [round, setRound] = useState<LatestRoundSession | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchLatest = useCallback(async () => {
    if (!patientId) {
      setRound(null);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("round_sessions")
      .select("id, round_date, observations, created_at, updated_at")
      .eq("patient_id", patientId)
      .order("round_date", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      const r: any = data[0];
      const [{ count: respCount }, { count: goalCount }] = await Promise.all([
        supabase
          .from("round_responses")
          .select("id", { count: "exact", head: true })
          .eq("session_id", r.id),
        supabase
          .from("round_section_goals")
          .select("id", { count: "exact", head: true })
          .eq("session_id", r.id),
      ]);
      setRound({
        id: r.id,
        roundDate: r.round_date,
        observations: r.observations,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        responsesCount: respCount ?? 0,
        goalsCount: goalCount ?? 0,
      });
    } else {
      setRound(null);
    }
    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    fetchLatest();
  }, [fetchLatest]);

  useEffect(() => {
    if (!patientId) return;
    const channel = supabase
      .channel(`patient-round-${patientId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "round_sessions", filter: `patient_id=eq.${patientId}` },
        () => fetchLatest(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "round_responses" },
        () => fetchLatest(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "round_section_goals" },
        () => fetchLatest(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId, fetchLatest]);

  return { round, loading, refresh: fetchLatest };
}
