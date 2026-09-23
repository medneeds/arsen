import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns whether the current user has the `super_admin` role.
 * Server-side only (`profissionais.papel`) — never localStorage.
 *
 * MIGRAÇÃO: `user_roles` (morta) → `profissionais.papel` por `user_id`.
 */
export function useIsSuperAdmin(): { isSuperAdmin: boolean; loading: boolean } {
  const { user } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("profissionais")
      .select("papel")
      .eq("user_id", user.id)
      .eq("papel", "super_admin")
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setIsSuperAdmin(!!data);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user]);

  return { isSuperAdmin, loading };
}
