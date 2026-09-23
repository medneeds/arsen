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
 *
 * MIGRAÇÃO: round_sessions→sessoes_visita, round_responses→respostas_visita,
 * round_section_goals→metas_secao_visita. `patientId` já é `internacoes.id` (=
 * o "encounter"), então filtramos direto por `internacao_id`. Colunas:
 * round_date→data_visita, observations→observacoes, created_at→criado_em,
 * updated_at→atualizado_em, session_id→sessao_id. DEGRADADO: sem colunas
 * `archived_at`/`encounter_id` em sessoes_visita → os filtros de arquivamento e
 * de encounter (via useActiveEncounterId) foram removidos.
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
      .from("sessoes_visita")
      .select("id, data_visita, observacoes, criado_em, atualizado_em")
      .eq("internacao_id", patientId)
      .order("data_visita", { ascending: false })
      .order("atualizado_em", { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      const r: any = data[0];
      const [{ count: respCount }, { count: goalCount }] = await Promise.all([
        supabase
          .from("respostas_visita")
          .select("id", { count: "exact", head: true })
          .eq("sessao_id", r.id),
        supabase
          .from("metas_secao_visita")
          .select("id", { count: "exact", head: true })
          .eq("sessao_id", r.id),
      ]);
      setRound({
        id: r.id,
        roundDate: r.data_visita,
        observations: r.observacoes,
        createdAt: r.criado_em,
        updatedAt: r.atualizado_em,
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
        { event: "*", schema: "public", table: "sessoes_visita", filter: `internacao_id=eq.${patientId}` },
        () => fetchLatest(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "respostas_visita" },
        () => fetchLatest(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "metas_secao_visita" },
        () => fetchLatest(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId, fetchLatest]);

  return { round, loading, refresh: fetchLatest };
}
