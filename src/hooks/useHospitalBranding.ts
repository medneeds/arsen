import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useHospital } from "@/contexts/HospitalContext";

/**
 * Identidade visual do hospital atual (logo, sigla, slogan), lida de
 * `identidade_visual_hospital`. Usada pelo sidebar para exibir a logo enviada
 * pelo admin (coluna `logo_url`, que hoje guarda a imagem como data URL), com
 * fallback para a logo padrão quando não houver imagem cadastrada.
 *
 * Enquanto carrega ou quando não há hospital selecionado, `logoUrl` é null —
 * o consumidor deve cair na logo padrão nesses casos.
 */
export function useHospitalBranding() {
  const { currentHospital } = useHospital();
  const hospitalId = currentHospital?.id ?? null;

  const { data } = useQuery({
    queryKey: ["hospital-branding", hospitalId],
    enabled: !!hospitalId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("identidade_visual_hospital")
        .select("logo_url, sigla, slogan")
        .eq("hospital_id", hospitalId as string)
        .maybeSingle();
      if (error) throw error;
      return data as { logo_url: string | null; sigla: string | null; slogan: string | null } | null;
    },
  });

  return {
    logoUrl: data?.logo_url ?? null,
    sigla: data?.sigla ?? null,
    slogan: data?.slogan ?? null,
  };
}
