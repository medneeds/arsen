import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns whether the current user has access to the developer console.
 * Backed exclusively by the server-side `user_roles` table — localStorage is
 * NOT consulted to prevent privilege escalation.
 *
 * Allowed roles: `dev` and `admin`.
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
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (cancelled) return;
        const allowed = (data ?? []).some((r) =>
          ["dev", "admin"].includes(r.role as string),
        );
        setIsDev(allowed);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { isDev, loading };
}
