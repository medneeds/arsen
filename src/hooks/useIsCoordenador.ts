import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const COORD_PROFILES = new Set([
  "coord_medico",
  "coord_enfermagem",
  "coord_multi",
]);

/**
 * Coordenadores (médico/enfermagem/multi) têm acesso transversal a todos
 * os setores das unidades hospitalares atribuídas, mas em **modo somente
 * leitura** para dados clínicos. Podem apenas validar rounds e liberar leitos.
 *
 * Source of truth: server-side `profiles.access_profile` + `user_roles` ('coordenador').
 * localStorage NÃO é confiável para gating de escrita — RLS é o último guardião.
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
      .from("profiles")
      .select("access_profile, access_profiles")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const primary = (data as { access_profile?: string } | null)?.access_profile ?? "";
        const list = (data as { access_profiles?: string[] | null } | null)?.access_profiles ?? [];
        const all = [primary, ...(list ?? [])].filter(Boolean);
        const match = all.find((p) => COORD_PROFILES.has(p));
        if (match) {
          const kind = match === "coord_medico"
            ? "medico"
            : match === "coord_enfermagem"
              ? "enfermagem"
              : "multi";
          setState({ isCoordenador: true, kind });
        } else {
          setState({ isCoordenador: false, kind: null });
        }
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
