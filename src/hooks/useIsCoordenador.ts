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
/**
 * Sub-tipo do coordenador a partir do cadastro (profissionais.conselho/cargo),
 * ja que o schema novo nao tem coluna propria. CRM ou cargo "medic..." =>
 * medico; COREN ou cargo "enferm..." => enfermagem; outro conselho => multi;
 * nada preenchido => null (tratado como NAO medico onde isso importa, ex.:
 * validacao de prescricao).
 */
export function deriveCoordKind(
  conselho?: string | null,
  cargo?: string | null,
): "medico" | "enfermagem" | "multi" | null {
  const norm = (v?: string | null) =>
    (v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const c = norm(conselho);
  const g = norm(cargo);
  if (/\bcrm\b/.test(c) || /medic/.test(g)) return "medico";
  if (/\bcoren\b/.test(c) || /enferm/.test(g)) return "enfermagem";
  if (c || g) return "multi";
  return null;
}

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
      .select("papel, conselho, cargo")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const row = data as { papel?: string; conselho?: string | null; cargo?: string | null } | null;
        const isCoord = row?.papel === "coordenador";
        setState({ isCoordenador: isCoord, kind: isCoord ? deriveCoordKind(row?.conselho, row?.cargo) : null });
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
