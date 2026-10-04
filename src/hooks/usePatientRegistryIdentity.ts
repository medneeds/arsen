import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatAge } from "@/lib/patientAge";

export interface PatientRegistryIdentity {
  id: string;
  name: string;
  age: string | null;
  birthDate: string | null;
  prontuario: string | null;
}

/**
 * Identidade cadastral da PESSOA diretamente de `pacientes` (por id).
 *
 * Usado no Historico de paciente SEM atendimento ativo: nesse caso nao existe
 * internacao_id (patientId) para alimentar usePatientLive/usePatientIdentifiers,
 * entao a identidade (nome, idade, nascimento, prontuario) vem direto da pessoa.
 * Somente leitura; nao depende de internacao.
 */
export function usePatientRegistryIdentity(registryId: string | null): PatientRegistryIdentity | null {
  const { data } = useQuery({
    queryKey: ["patient-registry-identity", registryId],
    enabled: !!registryId,
    queryFn: async (): Promise<PatientRegistryIdentity | null> => {
      if (!registryId) return null;
      const { data, error } = await supabase
        .from("pacientes")
        .select("id, nome_completo, nome_social, data_nascimento, prontuario")
        .eq("id", registryId)
        .maybeSingle();
      if (error || !data) return null;
      const row = data as {
        id: string;
        nome_completo: string | null;
        nome_social: string | null;
        data_nascimento: string | null;
        prontuario: string | null;
      };
      const name = (row.nome_social && row.nome_social.trim()) || row.nome_completo || "Paciente";
      return {
        id: row.id,
        name,
        age: formatAge(row.data_nascimento),
        birthDate: row.data_nascimento ?? null,
        prontuario: row.prontuario ?? null,
      };
    },
  });
  return data ?? null;
}
