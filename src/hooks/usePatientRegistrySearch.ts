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
 * NFD normalization helper — strip accents for tolerant search.
 */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Busca em patient_registry por nome, CPF, CNS ou nº de prontuário.
 * Inclui pacientes COM e SEM internação ativa (alta/óbito também aparecem).
 * Limita a 12 resultados.
 */
export function usePatientRegistrySearch(searchTerm: string, enabled = true) {
  const term = (searchTerm ?? "").trim();
  const normTerm = normalize(term);
  const digitsOnly = term.replace(/\D/g, "");

  return useQuery({
    queryKey: ["patient-registry-search", normTerm, digitsOnly],
    enabled: enabled && term.length >= 2,
    staleTime: 30_000,
    queryFn: async (): Promise<PatientRegistryHit[]> => {
      // Monta filtro OR cobrindo nome normalizado, CPF/CNS (dígitos) e prontuário.
      const orClauses: string[] = [];
      if (normTerm) {
        orClauses.push(`full_name_normalized.ilike.%${normTerm}%`);
      }
      if (digitsOnly.length >= 3) {
        orClauses.push(`cpf.ilike.%${digitsOnly}%`);
        orClauses.push(`cns.ilike.%${digitsOnly}%`);
      }
      // Prontuário pode conter letras (legado) ou dígitos
      orClauses.push(`medical_record.ilike.%${term}%`);

      const { data, error } = await supabase
        .from("patient_registry")
        .select(
          "id, medical_record, full_name, social_name, cpf, cns, birth_date, is_unidentified, unidentified_code, hospital_unit_id, merged_into_registry_id"
        )
        .or(orClauses.join(","))
        .is("merged_into_registry_id", null)
        .limit(12);

      if (error) throw error;

      const registries = (data ?? []) as any[];
      if (registries.length === 0) return [];

      // Para cada registry, tenta resolver leito atual via patients
      const registryIds = registries.map((r) => r.id);
      const { data: activePatients } = await supabase
        .from("patients")
        .select("patient_registry_id, bed_number, sector, admission_status")
        .in("patient_registry_id", registryIds);

      const bedByRegistry = new Map<string, { bed: string; sector: string; status: string }>();
      (activePatients ?? []).forEach((p: any) => {
        if (p.patient_registry_id) {
          bedByRegistry.set(p.patient_registry_id, {
            bed: p.bed_number ?? "—",
            sector: p.sector ?? "—",
            status: p.admission_status ?? "—",
          });
        }
      });

      return registries.map((r) => {
        const bed = bedByRegistry.get(r.id);
        return {
          id: r.id,
          medical_record: r.medical_record,
          full_name: r.full_name,
          social_name: r.social_name,
          cpf: r.cpf,
          cns: r.cns,
          birth_date: r.birth_date,
          is_unidentified: r.is_unidentified,
          unidentified_code: r.unidentified_code,
          hospital_unit_id: r.hospital_unit_id,
          current_bed: bed?.bed ?? null,
          current_sector: bed?.sector ?? null,
          admission_status: bed?.status ?? null,
        };
      });
    },
  });
}
