import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PatientRegistryHit {
  id: string;
  medical_record: string | null;
  full_name: string;
  social_name: string | null;
  cpf: string | null;
  cns: string | null;
  birth_date: string | null;
  is_unidentified: boolean | null;
  unidentified_code: string | null;
  hospital_unit_id: string | null;
  /** Leito atual se o paciente estiver internado, senão "—" */
  current_bed: string | null;
  current_sector: string | null;
  admission_status: string | null;
}

/**
 * Busca em `pacientes` por nome, CPF, CNS ou nº de prontuário.
 * Inclui pacientes COM e SEM internação ativa.
 * Limita a 12 resultados.
 *
 * MIGRAÇÃO: patient_registry → pacientes. Colunas que não existem no schema
 * novo foram degradadas:
 * - full_name_normalized (busca sem acento) → busca direta em nome_completo;
 * - merged_into_registry_id (fusão) → filtro removido;
 * - is_unidentified / unidentified_code / hospital_unit_id → null.
 * O leito/setor atual vem de internacoes → leitos → setores.
 */
export function usePatientRegistrySearch(searchTerm: string, enabled = true) {
  const term = (searchTerm ?? "").trim();
  const digitsOnly = term.replace(/\D/g, "");

  return useQuery({
    queryKey: ["patient-registry-search", term, digitsOnly],
    enabled: enabled && term.length >= 2,
    staleTime: 30_000,
    queryFn: async (): Promise<PatientRegistryHit[]> => {
      // Monta filtro OR cobrindo nome, CPF/CNS (dígitos) e prontuário.
      // MIGRAÇÃO: sem coluna normalizada — busca acento-sensível em nome_completo.
      const orClauses: string[] = [];
      if (term) {
        orClauses.push(`nome_completo.ilike.%${term}%`);
      }
      if (digitsOnly.length >= 3) {
        orClauses.push(`cpf.ilike.%${digitsOnly}%`);
        orClauses.push(`cns.ilike.%${digitsOnly}%`);
      }
      // Prontuário pode conter letras (legado) ou dígitos
      orClauses.push(`prontuario.ilike.%${term}%`);

      const { data, error } = await supabase
        .from("pacientes")
        .select(
          "id, prontuario, nome_completo, nome_social, cpf, cns, data_nascimento"
        )
        .or(orClauses.join(","))
        .limit(12);

      if (error) throw error;

      const pacientes = (data ?? []) as any[];
      if (pacientes.length === 0) return [];

      // Para cada paciente, tenta resolver leito atual via internação ativa.
      const pacienteIds = pacientes.map((r) => r.id);
      const { data: internacoes } = await supabase
        .from("internacoes")
        .select("paciente_id, status, leito:leitos(numero, setor:setores(nome))")
        .in("paciente_id", pacienteIds)
        .is("data_alta", null);

      const bedByPaciente = new Map<string, { bed: string; sector: string; status: string }>();
      (internacoes ?? []).forEach((i: any) => {
        if (i.paciente_id && !bedByPaciente.has(i.paciente_id)) {
          bedByPaciente.set(i.paciente_id, {
            bed: i.leito?.numero ?? "—",
            sector: i.leito?.setor?.nome ?? "—",
            status: i.status ?? "—",
          });
        }
      });

      return pacientes.map((r) => {
        const bed = bedByPaciente.get(r.id);
        return {
          id: r.id,
          medical_record: r.prontuario,
          full_name: r.nome_completo,
          social_name: r.nome_social,
          cpf: r.cpf,
          cns: r.cns,
          birth_date: r.data_nascimento,
          // MIGRAÇÃO: sem colunas de NI/unidade em pacientes → null.
          is_unidentified: null,
          unidentified_code: null,
          hospital_unit_id: null,
          current_bed: bed?.bed ?? null,
          current_sector: bed?.sector ?? null,
          admission_status: bed?.status ?? null,
        };
      });
    },
  });
}
