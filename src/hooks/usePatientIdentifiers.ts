import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { detectUnidentified } from "@/lib/unidentifiedDetector";
import { formatAge } from "@/lib/patientAge";
import { fetchInternacaoComPaciente } from "@/lib/internacaoComPaciente";

export interface PatientIdentifiers {
  /** Número de Prontuário (ex: 26-001-000123-4) */
  prontuario: string | null;
  /** Código de Atendimento (ex: 000000123456) */
  atendimento: string | null;
  /** Identificação do registro permanente do paciente */
  registry: {
    id: string | null;
    fullName: string | null;
    socialName: string | null;
    cpf: string | null;
    cns: string | null;
    birthDate: string | null;
    /** Calculada a partir de birthDate no momento da leitura — nunca fica desatualizada. */
    age: string | null;
    sex: string | null;
    motherName: string | null;
    phone: string | null;
    address: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
    bloodType: string | null;
    allergies: string | null;
    comorbidities: string | null;
    medicalRecord: string | null;
    isUnidentified: boolean;
    unidentifiedCode: string | null;
  } | null;
  loading: boolean;
}

/**
 * Loads the patient identifiers (prontuário) and the persistent patient
 * record, used by <PatientCockpit /> to surface "Prontuário" inline + a full
 * "Ver mais" panel.
 *
 * MIGRAÇÃO: `patientId` agora é `internacoes.id`. As tabelas patient_registry,
 * medical_records e patient_encounters não existem mais — o registro permanente
 * é `pacientes` (resolvido via internacoes.paciente_id), o prontuário é
 * `pacientes.prontuario`, e o atendimento é `internacoes.numero_atendimento`.
 */
export type PatientIdentifiersData = Omit<PatientIdentifiers, "loading">;

// queryKey canonica — compartilhada pelo hook e pelo prefetch (lib/prefetchPatient).
export const patientIdentifiersQueryKey = (patientId: string | null, patientName: string | null) =>
  ["patient-identifiers", patientId, patientName] as const;

// Busca prontuario + registro permanente do paciente. Extraida para o prefetch
// reutilizar (aquece o MESMO cache do hook). Nao depende de refs do hook.
export async function fetchPatientIdentifiers(
  patientId: string | null,
  patientName: string | null,
): Promise<PatientIdentifiersData> {
  let pacienteRow: any = null;
  let numeroAtendimento: string | null = null;

  // 1a) Via internação (patientId = internacoes.id) → pacientes
  if (patientId) {
    const internacao = await fetchInternacaoComPaciente(patientId);
    if (internacao.paciente) pacienteRow = internacao.paciente;
    numeroAtendimento = internacao.numeroAtendimento;
  }

  // 1b) Fallback por nome SOMENTE quando não temos patientId.
  if (!pacienteRow && !patientId && patientName) {
    const { data } = await supabase
      .from("pacientes")
      .select("*")
      .ilike("nome_completo", patientName.trim())
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) pacienteRow = data;
  }

  // 1c) GUARDA CRÍTICA: nome NI + registro com nome real -> vínculo errado.
  const niDetection = detectUnidentified(patientName || "");
  if (pacienteRow && niDetection.isUnidentified) {
    const rowNi = detectUnidentified(pacienteRow.nome_completo || "");
    if (!rowNi.isUnidentified) pacienteRow = null;
  }

  const prontuario: string | null = pacienteRow?.prontuario || null;
  // Atendimento: internacoes.numero_atendimento (gerado por trigger no INSERT).
  // Só vem da internação (patientId) — nunca do fallback por nome, para não
  // trazer o atendimento de outro paciente (NI com nomes iguais).
  const atendimento: string | null = numeroAtendimento;

  return {
    prontuario,
    atendimento,
    registry: pacienteRow
      ? {
          id: pacienteRow.id,
          fullName: pacienteRow.nome_completo,
          socialName: pacienteRow.nome_social,
          cpf: pacienteRow.cpf,
          cns: pacienteRow.cns,
          birthDate: pacienteRow.data_nascimento,
          age: formatAge(pacienteRow.data_nascimento),
          sex: pacienteRow.sexo,
          motherName: pacienteRow.nome_mae,
          phone: pacienteRow.telefone,
          address: pacienteRow.endereco,
          neighborhood: null,
          city: null,
          state: null,
          bloodType: pacienteRow.tipo_sanguineo,
          allergies: pacienteRow.alergias,
          comorbidities: pacienteRow.comorbidades,
          medicalRecord: pacienteRow.prontuario,
          isUnidentified: detectUnidentified(pacienteRow.nome_completo || "").isUnidentified,
          unidentifiedCode: null,
        }
      : null,
  };
}

export function usePatientIdentifiers(
  patientId: string | null,
  patientName: string | null,
  hospitalUnitId: string | null,
): PatientIdentifiers {
  const queryClient = useQueryClient();
  const pacienteIdRef = useRef<string | null>(null);

  // PERFORMANCE: react-query. Cache compartilhado por internacao_id + nome, aquecido
  // tambem pelo prefetch (lib/prefetchPatient). O realtime abaixo invalida a query.
  const query = useQuery({
    queryKey: patientIdentifiersQueryKey(patientId, patientName),
    enabled: !!(patientId || patientName),
    queryFn: () => fetchPatientIdentifiers(patientId, patientName),
  });

  // pacienteIdRef acompanha o id do paciente vinculado (filtro do realtime abaixo).
  useEffect(() => { pacienteIdRef.current = query.data?.registry?.id ?? null; }, [query.data]);

  // Realtime: invalida a query quando muda a internação ou o paciente vinculado.
  // MIGRAÇÃO: canais de patients/medical_records/patient_encounters removidos
  // (tabelas mortas); agora ouvimos internacoes (id) e pacientes (id vinculado).
  useEffect(() => {
    if (!patientId) return;
    const invalidate = () =>
      queryClient.invalidateQueries({ queryKey: ["patient-identifiers", patientId, patientName] });
    const channel = supabase
      .channel(`patient-identifiers-${patientId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "internacoes", filter: `id=eq.${patientId}` },
        invalidate)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "pacientes" },
        (payload: any) => {
          const row = (payload.new || payload.old) as any;
          if (row?.id && row.id === pacienteIdRef.current) invalidate();
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [patientId, patientName, queryClient]);

  return {
    prontuario: query.data?.prontuario ?? null,
    atendimento: query.data?.atendimento ?? null,
    registry: query.data?.registry ?? null,
    loading: query.isLoading,
  };
}
