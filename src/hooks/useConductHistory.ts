import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";

// MIGRAÇÃO: conduct_history → logs_auditoria (tipo_evento='edicao_conduta').
// `patientId` é `internacoes.id`. Colunas antigas mapeadas:
//   patient_id→internacao_id/registro_id, field_name→campo_alterado,
//   old_value→valor_antigo, new_value→valor_novo, changed_by→ator_user_id,
//   changed_by_email→email_ator, created_at→criado_em.
// DEGRADADO (sem coluna): archived_at (trilha nunca é arquivada) e o
// isolamento por encounter (o "encounter" É a internação → internacao_id).
export interface ConductHistoryEntry {
  id: string;
  patient_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_by_email: string | null;
  created_at: string;
}

const FIELD_LABELS: Record<string, string> = {
  diagnoses: "Hipóteses/Diagnósticos",
  medicalHistory: "Antecedentes/Comorbidades",
  relevantExams: "Exames Relevantes",
  pendencies: "Programações/Pendências",
  schedule: "Plano Terapêutico",
  admissionHistory: "História da Admissão",
  name: "Nome",
  age: "Idade",
  sector: "Setor",
  bedNumber: "Leito",
};

export function getFieldLabel(fieldName: string): string {
  return FIELD_LABELS[fieldName] || fieldName;
}

export function useConductHistory(patientId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { currentHospital } = useHospital();

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["conduct-history", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("logs_auditoria")
        .select("*")
        .eq("tipo_evento", "edicao_conduta")
        .eq("internacao_id", patientId)
        .order("criado_em", { ascending: false })
        .limit(200);

      if (error) {
        console.error("Error fetching conduct history:", error);
        return [];
      }
      return ((data as any[]) || []).map((r): ConductHistoryEntry => ({
        id: r.id,
        patient_id: r.internacao_id ?? patientId,
        field_name: r.campo_alterado ?? "",
        old_value: r.valor_antigo ?? null,
        new_value: r.valor_novo ?? null,
        changed_by: r.ator_user_id ?? null,
        changed_by_email: r.email_ator ?? null,
        created_at: r.criado_em,
      }));
    },
    enabled: !!patientId,
    staleTime: 30000,
  });

  const recordChange = useMutation({
    mutationFn: async ({
      fieldName,
      oldValue,
      newValue,
    }: {
      fieldName: string;
      oldValue: string | null;
      newValue: string | null;
    }) => {
      // Don't record if values are the same
      if (oldValue === newValue) return;

      const { error } = await supabase.from("logs_auditoria").insert({
        tipo_evento: "edicao_conduta",
        nome_tabela: "internacoes",
        internacao_id: patientId,
        registro_id: patientId,
        campo_alterado: fieldName,
        valor_antigo: oldValue,
        valor_novo: newValue,
        ator_user_id: user?.id || null,
        email_ator: user?.email || null,
        hospital_id: currentHospital?.id || null,
      } as any);

      if (error) {
        console.error("Error recording conduct history:", error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conduct-history", patientId] });
    },
  });

  return {
    history,
    isLoading,
    recordChange: recordChange.mutate,
  };
}
