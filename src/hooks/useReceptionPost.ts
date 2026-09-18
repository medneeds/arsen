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
import { safeSetItem } from "@/lib/safeStorage";

export type ReceptionPoint = "vertical" | "horizontal";

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
        .from("reception_desk_sessions" as any)
        .select("id, started_at, ended_at, reception_point")
        .eq("id", storedSession)
        .maybeSingle()
        .then(({ data }) => {
          const row = data as any;
          if (row && !row.ended_at && row.reception_point === storedPoint) {
            setPointState(storedPoint);
            setSessionId(storedSession);
            setStartedAt(row.started_at);
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
      // Batimento de sessao: nao bloqueia nada, mas o resultado era descartado.
      // Se ele para de gravar, a sessao do posto aparece como inativa sem que
      // ninguem perceba. Registra em nivel debug para nao poluir o console a
      // cada intervalo — em producao o build remove console.debug.
      const { error } = await supabase
        .from("reception_desk_sessions" as any)
        .update({ last_heartbeat_at: new Date().toISOString() })
        .eq("id", sessionId);
      if (error) console.debug("[useReceptionPost] batimento nao gravou:", error.message);
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
      const stateId = localStorage.getItem("selected_state_id");
      if (!stateId) return;

      // 1) Encerra sessão anterior se existir e for diferente
      if (sessionId && point !== next) {
        // Resultado era descartado: sessao antiga podia ficar aberta para
        // sempre no banco, com o mesmo usuario aparecendo em dois postos.
        const { error: erroEncerrar } = await supabase
          .from("reception_desk_sessions" as any)
          .update({ ended_at: new Date().toISOString() })
          .eq("id", sessionId);
        if (erroEncerrar) console.warn("[useReceptionPost] sessao anterior nao foi encerrada:", erroEncerrar);
      }

      // 2) Se for o mesmo ponto e sessão já ativa, só persiste localmente
      if (sessionId && point === next) {
        setPointState(next);
        safeSetItem(`${STORAGE_KEY}:${user.id}`, next);
        return;
      }

      // 3) Abre nova sessão
      const { data, error } = await supabase
        .from("reception_desk_sessions" as any)
        .insert({
          user_id: user.id,
          user_name: user.user_metadata?.full_name || user.email || null,
          reception_point: next,
          hospital_unit_id: hospitalId,
          state_id: stateId,
          started_at: new Date().toISOString(),
          last_heartbeat_at: new Date().toISOString(),
        } as any)
        .select("id, started_at")
        .single();

      if (error) {
        console.error("Erro ao abrir sessão de recepção:", error);
        return;
      }

      const row = data as any;
      setPointState(next);
      setSessionId(row.id);
      setStartedAt(row.started_at);
      safeSetItem(`${STORAGE_KEY}:${user.id}`, next);
      safeSetItem(`${SESSION_KEY}:${user.id}`, row.id);
    },
    [user, hospitalId, sessionId, point],
  );

  const clearPoint = useCallback(async () => {
    if (!user?.id) return;
    if (sessionId) {
      // Idem: sem verificacao, o posto continuava "ocupado" no banco depois de
      // o usuario sair, sem sinal nenhum.
      const { error: erroLimpar } = await supabase
        .from("reception_desk_sessions" as any)
        .update({ ended_at: new Date().toISOString() })
        .eq("id", sessionId);
      if (erroLimpar) console.warn("[useReceptionPost] sessao nao foi encerrada ao sair do posto:", erroLimpar);
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
