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
 * Sincroniza com `public.profiles` (full_name, crm, specialty, professional_type).
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
        .from("profiles")
        .select("full_name, crm, specialty, professional_type")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setDoctor({
        fullName: (data?.full_name || "").toString(),
        crm: (data?.crm || "").toString(),
        specialty: (data?.specialty || "").toString(),
        professionalType: (data?.professional_type || "").toString(),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return doctor;
}
