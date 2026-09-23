import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Determina se o usuário atual pode editar o catálogo clínico de medicamentos.
 * Roles permitidas: farmacia, admin, coordenador, super_admin, dev.
 *
 * MIGRAÇÃO: user_roles (morta) → profissionais.papel (via user_id ≠ auth.uid).
 * Não há mais múltiplas roles por usuário: `profissionais` tem um único `papel`.
 */
const ALLOWED_PAPEIS = ["farmacia", "admin", "coordenador", "super_admin", "dev"];

export function useCanEditCatalog(): boolean {
  const { user } = useAuth();
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) { setCanEdit(false); return; }
    supabase
      .from("profissionais")
      .select("papel")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setCanEdit(ALLOWED_PAPEIS.includes((data?.papel as string) ?? ""));
      });
    return () => { cancelled = true; };
  }, [user]);

  return canEdit;
}
