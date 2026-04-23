import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns whether the current user has the `admin` role.
 * Backed exclusively by `user_roles` (server-side) — never localStorage.
 */
export function useIsAdmin(): { isAdmin: boolean; loading: boolean } {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (cancelled) return;
        const allowed = (data ?? []).some((r) => (r.role as string) === "admin");
        setIsAdmin(allowed);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { isAdmin, loading };
}
