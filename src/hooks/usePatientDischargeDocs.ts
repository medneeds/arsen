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

// MIGRAÇÃO: discharge_documents → altas. `patientId` é `internacoes.id` →
// filtra por internacao_id. Colunas: document_type→tipo, signed_at→data_hora,
// content→conteudo, signed_by_crm→crm_assinatura. Filtra apenas tipos de
// desfecho (alta/óbito) — altas também guarda atestado/relatório/termo.
// DEGRADADO (sem coluna no schema novo): patient_name (recuperado do conteudo
// quando existir), signed_by_name (assinado_por é FK profissionais.id, não nome
// → null), suspended_at/archived_at/encounter_id (filtros removidos).
const DISCHARGE_TIPOS = ["alta_hospitalar", "alta_pedido", "obito"];

export function usePatientDischargeDocs(patientId?: string | null, patientName?: string | null) {
  return useQuery({
    queryKey: ["discharge-docs", patientId, patientName],
    enabled: !!patientId,
    queryFn: async (): Promise<DischargeDocRow[]> => {
      if (!patientId) return [];
      const { data, error } = await supabase
        .from("altas")
        .select("id, tipo, conteudo, crm_assinatura, data_hora")
        .eq("internacao_id", patientId)
        .in("tipo", DISCHARGE_TIPOS)
        .order("data_hora", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []).map((r: any): DischargeDocRow => {
        const conteudo = (r.conteudo ?? {}) as DischargeDocPayload;
        return {
          id: r.id,
          document_type: r.tipo as DischargeDocType,
          patient_name: conteudo?.patient_name ?? patientName ?? "",
          signed_by_name: null, // MIGRAÇÃO: sem coluna de nome do assinante em altas
          signed_by_crm: r.crm_assinatura ?? null,
          signed_at: r.data_hora,
          content: conteudo,
        };
      });
    },
  });
}
