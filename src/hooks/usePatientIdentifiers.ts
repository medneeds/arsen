import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { detectUnidentified } from "@/lib/unidentifiedDetector";
import { formatAge } from "@/lib/patientAge";

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
 * `pacientes.prontuario`, e "atendimento"/encounter_code não tem coluna nova
 * (degradado para null).
 */
export function usePatientIdentifiers(
  patientId: string | null,
  patientName: string | null,
  hospitalUnitId: string | null,
): PatientIdentifiers {
  const queryClient = useQueryClient();
  const pacienteIdRef = useRef<string | null>(null);

  // PERFORMANCE: migrado para react-query. A identidade do paciente (prontuario +
  // registro permanente) fica no cache compartilhado (queryKey por internacao_id +
  // nome), entao alternar entre modulos reaproveita o load. O realtime abaixo
  // invalida a query quando a internacao/paciente muda.
  type IdsData = Omit<PatientIdentifiers, "loading">;
  const query = useQuery({
    queryKey: ["patient-identifiers", patientId, patientName],
    enabled: !!(patientId || patientName),
    queryFn: async (): Promise<IdsData> => {
      let pacienteRow: any = null;

      // 1a) Via internação (patientId = internacoes.id) → pacientes
      if (patientId) {
        const { data: internacao } = await supabase
          .from("internacoes")
          .select("paciente:pacientes(*)")
          .eq("id", patientId)
          .maybeSingle();
        if ((internacao as any)?.paciente) pacienteRow = (internacao as any).paciente;
      }

      // 1b) Fallback por nome SOMENTE quando não temos patientId.
      // ⚠️  Crítico: pacientes "Não Identificados" frequentemente compartilham
      // o mesmo nome ("NÃO IDENTIFICADO", etc). Buscar por nome quando temos
      // patientId poderia trazer OUTRO paciente NI.
      // MIGRAÇÃO: pacientes não tem hospital_unit_id nem is_unidentified —
      // filtro por unidade/NI removido; busca só por nome_completo.
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

      // 1c) GUARDA CRÍTICA: se o nome é NI (heurística) e o paciente encontrado
      // tem nome real, o vínculo está errado/obsoleto — não usa esse registro,
      // evitando cabeçalho de PDF com dados de outro paciente.
      // MIGRAÇÃO: sem coluna is_unidentified — NI é derivado da heurística do nome.
      const niDetection = detectUnidentified(patientName || "");
      if (pacienteRow && niDetection.isUnidentified) {
        const rowNi = detectUnidentified(pacienteRow.nome_completo || "");
        if (!rowNi.isUnidentified) pacienteRow = null;
      }

      // 2) Prontuário: pacientes.prontuario
      const prontuario: string | null = pacienteRow?.prontuario || null;

      // 3) Atendimento / encounter_code: sem coluna no schema novo.
      // MIGRAÇÃO: patient_encounters não existe; degradado para null.
      const atendimento: string | null = null;

      pacienteIdRef.current = pacienteRow?.id || null;

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
              // MIGRAÇÃO: pacientes.endereco é campo único — sem bairro/cidade/UF separados.
              neighborhood: null,
              city: null,
              state: null,
              bloodType: pacienteRow.tipo_sanguineo,
              allergies: pacienteRow.alergias,
              comorbidities: pacienteRow.comorbidades,
              medicalRecord: pacienteRow.prontuario,
              // MIGRAÇÃO: sem coluna is_unidentified/unidentified_code — NI derivado por heurística.
              isUnidentified: detectUnidentified(pacienteRow.nome_completo || "").isUnidentified,
              unidentifiedCode: null,
            }
          : null,
      };
    },
  });

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
