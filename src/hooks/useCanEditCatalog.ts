import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Determina se o usuário atual pode editar o catálogo clínico de medicamentos.
 * Roles permitidas: admin (inclui gestores) e farmacia.
 */
export function useCanEditCatalog(): boolean {
  const { user } = useAuth();
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) { setCanEdit(false); return; }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (cancelled) return;
        const allowed = (data ?? []).some((r) =>
          ["admin", "farmacia"].includes(r.role as string)
        );
        setCanEdit(allowed);
      });
    return () => { cancelled = true; };
  }, [user]);

  return canEdit;
}
