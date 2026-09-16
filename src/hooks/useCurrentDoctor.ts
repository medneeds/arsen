import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CurrentDoctor {
  fullName: string;
  crm: string;
  specialty: string;
  professionalType: string;
}

const EMPTY: CurrentDoctor = { fullName: "", crm: "", specialty: "", professionalType: "" };

/**
 * Hook centralizado para obter dados do médico/profissional logado
 * usado em todos os documentos PDF gerados (prescrição, guia ATM,
 * receituário, hemocomponentes, cultura, SAT, dieta, requisições etc).
 *
 * Sincroniza com `public.profissionais` (nome, numero_conselho como CRM).
 *
 * MIGRAÇÃO: `profiles` (morta) → `profissionais` por `user_id` (≠ profissionais.id).
 * Mapeamento: full_name→nome, crm→numero_conselho. `specialty` e
 * `professional_type` NÃO têm coluna em `profissionais` → DEGRADADOS: lidos do
 * `user_metadata` do auth quando presentes (senão ""). `professionalType` cai
 * também para `papel` como último recurso.
 */
export function useCurrentDoctor(): CurrentDoctor {
  const { user } = useAuth();
  const [doctor, setDoctor] = useState<CurrentDoctor>(EMPTY);

  useEffect(() => {
    if (!user?.id) {
      setDoctor(EMPTY);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profissionais")
        .select("nome, numero_conselho, papel")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const row = data as { nome?: string; numero_conselho?: string; papel?: string } | null;
      setDoctor({
        fullName: (row?.nome || meta.full_name || "").toString(),
        crm: (row?.numero_conselho || meta.crm || "").toString(),
        // MIGRAÇÃO: sem coluna specialty/professional_type em profissionais.
        specialty: (meta.specialty || "").toString(),
        professionalType: (meta.professional_type || row?.papel || "").toString(),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return doctor;
}
