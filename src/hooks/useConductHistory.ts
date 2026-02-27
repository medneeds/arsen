import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";

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
  const { currentState, currentHospital } = useHospital();

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["conduct-history", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conduct_history")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        console.error("Error fetching conduct history:", error);
        return [];
      }
      return data as ConductHistoryEntry[];
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
      if (!currentHospital || !currentState) return;
      // Don't record if values are the same
      if (oldValue === newValue) return;

      const { error } = await supabase.from("conduct_history").insert({
        patient_id: patientId,
        field_name: fieldName,
        old_value: oldValue,
        new_value: newValue,
        changed_by: user?.id || null,
        changed_by_email: user?.email || null,
        hospital_unit_id: currentHospital.id,
        state_id: currentState.id,
      });

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
