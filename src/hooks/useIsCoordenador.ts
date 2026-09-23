import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Coordenadores têm acesso transversal a todos os setores das unidades
 * hospitalares atribuídas, mas em **modo somente leitura** para dados
 * clínicos. Podem apenas validar rounds e liberar leitos.
 *
 * Source of truth: server-side `profissionais.papel === 'coordenador'`.
 * localStorage NÃO é confiável para gating de escrita — RLS é o último guardião.
 *
 * MIGRAÇÃO: `profiles.access_profile`/`access_profiles` + `user_roles` (mortas)
 * → `profissionais.papel` por `user_id`. O sub-tipo do coordenador
 * (médico/enfermagem/multi) vinha de `access_profile` (coord_medico/…), que não
 * tem coluna equivalente → `kind` DEGRADADO para `null` (a UI cai no rótulo
 * genérico "Coord. Multi").
 */
export function useIsCoordenador(): {
  isCoordenador: boolean;
  kind: "medico" | "enfermagem" | "multi" | null;
  loading: boolean;
} {
  const { user } = useAuth();
  const [state, setState] = useState<{
    isCoordenador: boolean;
    kind: "medico" | "enfermagem" | "multi" | null;
  }>({ isCoordenador: false, kind: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setState({ isCoordenador: false, kind: null });
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("profissionais")
      .select("papel")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const isCoord = (data as { papel?: string } | null)?.papel === "coordenador";
        // MIGRAÇÃO: sem coluna de sub-tipo → kind degradado para null.
        setState({ isCoordenador: isCoord, kind: null });
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { ...state, loading };
}

/** Atalho boolean: o usuário está em modo somente-leitura clínica? */
export function useIsClinicalReadOnly(): boolean {
  return useIsCoordenador().isCoordenador;
}
