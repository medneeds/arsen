import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns true when the current user is browsing in "gestor" mode.
 * Gestor profiles have read-only access to the bed map and the consolidated
 * panel, but cannot edit clinical data nor open the Painel Clínico tab.
 *
 * Security: localStorage `access_profile` is UI-only. We additionally validate
 * the server-side role (`user_roles` table) so that a tampered localStorage
 * value cannot grant elevated capabilities. Admin always bypasses gestor mode.
 */
export function useIsGestor(): boolean {
  const { role, user } = useAuth();
  const [serverHasGestor, setServerHasGestor] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setServerHasGestor(false);
      return;
    }
    // Server-side check: does this user have any role assignment that justifies
    // gestor view? We treat 'admin' and 'medico' as legitimate viewers; other
    // roles cannot escalate to gestor UI even if localStorage says so.
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (cancelled) return;
        const allowed = (data ?? []).some((r) =>
          ["admin", "medico"].includes(r.role as string),
        );
        setServerHasGestor(allowed);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (typeof window === "undefined") return false;
  if (role === "admin") return false;
  const accessProfile = localStorage.getItem("access_profile");
  if (accessProfile !== "gestor") return false;
  // Only honor the gestor UI if the server confirms the user has a legitimate role.
  return serverHasGestor === true;
}
