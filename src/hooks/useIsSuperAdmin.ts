import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns whether the current user has the `super_admin` role.
 * Server-side only (user_roles table) — never localStorage.
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
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin" as any)
      .then(({ data }) => {
        if (cancelled) return;
        setIsSuperAdmin((data ?? []).length > 0);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user]);

  return { isSuperAdmin, loading };
}
