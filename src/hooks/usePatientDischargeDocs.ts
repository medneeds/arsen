import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DischargeDocType, DischargeDocPayload } from "@/lib/dischargeDocuments";

export interface DischargeDocRow {
  id: string;
  document_type: DischargeDocType;
  patient_name: string;
  signed_by_name: string | null;
  signed_by_crm: string | null;
  signed_at: string;
  content: DischargeDocPayload;
}

export function usePatientDischargeDocs(patientId?: string | null, patientName?: string | null) {
  return useQuery({
    queryKey: ["discharge-docs", patientId, patientName],
    enabled: !!(patientId || patientName),
    queryFn: async (): Promise<DischargeDocRow[]> => {
      let q = supabase
        .from("discharge_documents")
        .select("id, document_type, patient_name, signed_by_name, signed_by_crm, signed_at, content")
        .order("signed_at", { ascending: false })
        .limit(10);
      if (patientId) q = q.eq("patient_id", patientId);
      else if (patientName) q = q.eq("patient_name", patientName);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any;
    },
  });
}
