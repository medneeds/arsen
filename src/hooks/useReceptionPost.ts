/**
 * useReceptionPost — gerencia o "posto" do recepcionista (Vertical / Horizontal)
 * 
 * - Persiste a escolha em localStorage por usuário
 * - Cria/encerra sessão em `reception_desk_sessions` para medir tempo ativo
 * - Heartbeat a cada 60s para sinalizar presença ativa
 * - Encerra sessão automaticamente ao trocar de posto ou sair
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";

export type ReceptionPoint = "vertical" | "horizontal";

// MIGRAÇÃO: `reception_desk_sessions` (morta) → `sessoes_recepcao`. Colunas:
//   started_at→iniciado_em, ended_at→finalizado_em, reception_point→ponto_recepcao,
//   hospital_unit_id→hospital_id, user_name→nome_usuario,
//   last_heartbeat_at→ultimo_heartbeat_em, user_id→profissional_id (profissionais.id).
// DEGRADADO: state_id não existe → removido (e o gate por selected_state_id também,
// senão nenhuma sessão de recepção abriria).
async function resolveProfissionalId(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data } = await supabase.from("profissionais").select("id").eq("user_id", userId).maybeSingle();
    return (data as any)?.id ?? null;
  } catch {
    return null;
  }
}

export interface ReceptionPostState {
  /** Posto atualmente selecionado (null = ainda não escolheu) */
  point: ReceptionPoint | null;
  /** ID da sessão ativa em reception_desk_sessions */
  sessionId: string | null;
  /** Timestamp ISO de quando a sessão começou */
  startedAt: string | null;
  /** Loading inicial (carregando do localStorage / verificando sessão ativa) */
  loading: boolean;
  /** Define um novo posto (encerra sessão anterior se houver e abre nova) */
  setPoint: (next: ReceptionPoint) => Promise<void>;
  /** Encerra a sessão atual (logout / sair do posto) */
  clearPoint: () => Promise<void>;
}

const STORAGE_KEY = "reception_post_point";
const SESSION_KEY = "reception_post_session_id";
const HEARTBEAT_MS = 60_000;

export function useReceptionPost(): ReceptionPostState {
  const { user } = useAuth();
  const { currentHospital } = useHospital();
  const hospitalId = currentHospital?.id;

  const [point, setPointState] = useState<ReceptionPoint | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const heartbeatRef = useRef<number | null>(null);

  // Carrega do localStorage e tenta validar sessão existente
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    const storedPoint = (localStorage.getItem(`${STORAGE_KEY}:${user.id}`) || null) as ReceptionPoint | null;
    const storedSession = localStorage.getItem(`${SESSION_KEY}:${user.id}`);

    if (storedPoint && storedSession) {
      // Valida se a sessão ainda está aberta no banco
      supabase
        .from("sessoes_recepcao")
        .select("id, iniciado_em, finalizado_em, ponto_recepcao")
        .eq("id", storedSession)
        .maybeSingle()
        .then(({ data }) => {
          const row = data as any;
          if (row && !row.finalizado_em && row.ponto_recepcao === storedPoint) {
            setPointState(storedPoint);
            setSessionId(storedSession);
            setStartedAt(row.iniciado_em);
          } else {
            // Sessão inválida — limpa local
            localStorage.removeItem(`${STORAGE_KEY}:${user.id}`);
            localStorage.removeItem(`${SESSION_KEY}:${user.id}`);
          }
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [user?.id]);

  // Heartbeat: marca presença a cada 60s
  useEffect(() => {
    if (!sessionId) {
      if (heartbeatRef.current) {
        window.clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      return;
    }
    const beat = async () => {
      await supabase
        .from("sessoes_recepcao")
        .update({ ultimo_heartbeat_em: new Date().toISOString() })
        .eq("id", sessionId);
    };
    beat();
    heartbeatRef.current = window.setInterval(beat, HEARTBEAT_MS);
    return () => {
      if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
    };
  }, [sessionId]);

  const setPoint = useCallback(
    async (next: ReceptionPoint) => {
      if (!user?.id || !hospitalId) return;

      // 1) Encerra sessão anterior se existir e for diferente
      if (sessionId && point !== next) {
        await supabase
          .from("sessoes_recepcao")
          .update({ finalizado_em: new Date().toISOString() })
          .eq("id", sessionId);
      }

      // 2) Se for o mesmo ponto e sessão já ativa, só persiste localmente
      if (sessionId && point === next) {
        setPointState(next);
        localStorage.setItem(`${STORAGE_KEY}:${user.id}`, next);
        return;
      }

      // 3) Abre nova sessão
      const profissionalId = await resolveProfissionalId(user.id);
      const { data, error } = await supabase
        .from("sessoes_recepcao")
        .insert({
          profissional_id: profissionalId,
          nome_usuario: user.user_metadata?.full_name || user.email || null,
          ponto_recepcao: next,
          hospital_id: hospitalId,
          iniciado_em: new Date().toISOString(),
          ultimo_heartbeat_em: new Date().toISOString(),
        } as any)
        .select("id, iniciado_em")
        .single();

      if (error) {
        console.error("Erro ao abrir sessão de recepção:", error);
        return;
      }

      const row = data as any;
      setPointState(next);
      setSessionId(row.id);
      setStartedAt(row.iniciado_em);
      localStorage.setItem(`${STORAGE_KEY}:${user.id}`, next);
      localStorage.setItem(`${SESSION_KEY}:${user.id}`, row.id);
    },
    [user, hospitalId, sessionId, point],
  );

  const clearPoint = useCallback(async () => {
    if (!user?.id) return;
    if (sessionId) {
      await supabase
        .from("sessoes_recepcao")
        .update({ finalizado_em: new Date().toISOString() })
        .eq("id", sessionId);
    }
    setPointState(null);
    setSessionId(null);
    setStartedAt(null);
    localStorage.removeItem(`${STORAGE_KEY}:${user.id}`);
    localStorage.removeItem(`${SESSION_KEY}:${user.id}`);
  }, [user, sessionId]);

  return { point, sessionId, startedAt, loading, setPoint, clearPoint };
}

export const RECEPTION_POINT_LABEL: Record<ReceptionPoint, string> = {
  vertical: "Recepção Vertical",
  horizontal: "Recepção Horizontal",
};

export const RECEPTION_POINT_SHORT: Record<ReceptionPoint, string> = {
  vertical: "Vertical",
  horizontal: "Horizontal",
};
