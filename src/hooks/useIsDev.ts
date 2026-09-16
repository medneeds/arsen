import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns whether the current user has access to the developer console.
 * Backed exclusively by the server-side `profissionais.papel` — localStorage is
 * NOT consulted to prevent privilege escalation.
 *
 * Allowed roles: `dev` and `admin`.
 *
 * MIGRAÇÃO: `user_roles` (morta) → `profissionais.papel` (enum papel_profissional),
 * uma linha por usuário resolvida por `user_id` (≠ profissionais.id).
 */
export function useIsDev(): { isDev: boolean; loading: boolean } {
  const { user } = useAuth();
  const [isDev, setIsDev] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setIsDev(false);
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
        const papel = (data as { papel?: string } | null)?.papel ?? null;
        setIsDev(papel === "dev" || papel === "admin");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { isDev, loading };
}
