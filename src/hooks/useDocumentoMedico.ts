import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { useResolvedRegistryId } from "@/hooks/useResolvedRegistryId";
import { toast } from "sonner";
import { resolveActiveEncounterId } from "@/lib/resolveActiveEncounter";

export type DocumentoMedicoType = "atestado" | "relatorio" | "termo";

export interface DocumentoMedicoData {
  id?: string;
  type: DocumentoMedicoType;
  patient_id?: string | null;
  patient_name: string;
  patient_bed?: string;
  patient_sector?: string;
  body: string;
  /** Só atestado: dias de afastamento. */
  days?: number | null;
  /** CID incluído no momento da emissão (snapshot — não recalcula depois). */
  cid?: string | null;
  signed_by_name?: string;
  signed_by_crm?: string;
  created_at?: string;
}

/**
 * Hook para criar e listar atestados / relatórios / termos de um paciente.
 * Mesmo modelo de useReceituario — busca por patient_registry_id (vínculo
 * estável, segue o paciente entre leitos) com fallback para patient_id.
 *
 * Ao contrário de useReceituario, não precisa do fallback defensivo contra
 * "coluna ainda não existe" — documentos_medicos nasceu com
 * patient_registry_id desde o início (migration 20260819140000), sem linhas
 * legadas para migrar.
 */
export function useDocumentoMedico(
  patientId?: string | null,
  patientName?: string | null,
) {
  const { user } = useAuth();
  const { currentHospital } = useHospital();
  const { registryId: resolvedRegistryId } = useResolvedRegistryId(patientId || null);
  const [documentos, setDocumentos] = useState<DocumentoMedicoData[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!patientId && !patientName) return;
    setLoading(true);
    try {
      let q = supabase
        .from("documentos_medicos")
        .select("*")
        .order("created_at", { ascending: false });
      if (resolvedRegistryId && patientId) {
        q = q.or(`patient_registry_id.eq.${resolvedRegistryId},and(patient_registry_id.is.null,patient_id.eq.${patientId})`);
      } else if (patientId) {
        q = q.eq("patient_id", patientId);
      } else if (patientName) {
        q = q.ilike("patient_name", `%${patientName}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      setDocumentos((data ?? []) as unknown as DocumentoMedicoData[]);
    } catch (err: any) {
      toast.error("Erro ao carregar documentos médicos", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, [patientId, patientName, resolvedRegistryId]);

  useEffect(() => { fetch(); }, [fetch]);

  /** Salva um novo documento (atestado/relatório/termo). Retorna o id criado. */
  const save = useCallback(async (data: DocumentoMedicoData): Promise<string | null> => {
    try {
      if (!currentHospital?.id) {
        toast.error("Selecione a unidade hospitalar antes de salvar o documento");
        return null;
      }
      const payload: Record<string, any> = {
        type: data.type,
        hospital_unit_id: currentHospital.id,
        patient_id: data.patient_id ?? null,
        patient_name: data.patient_name,
        patient_bed: data.patient_bed ?? null,
        patient_sector: data.patient_sector ?? null,
        body: data.body,
        days: data.days ?? null,
        cid: data.cid ?? null,
        signed_by_name: data.signed_by_name ?? null,
        signed_by_crm: data.signed_by_crm ?? null,
        created_by: user?.id ?? null,
      };
      if (resolvedRegistryId) payload.patient_registry_id = resolvedRegistryId;
      if (data.patient_id) {
        const encId = await resolveActiveEncounterId(data.patient_id);
        if (encId) payload.encounter_id = encId;
      }

      const { data: row, error } = await supabase
        .from("documentos_medicos")
        .insert(payload as any)
        .select("id")
        .single();

      if (error) throw error;
      toast.success("Documento salvo");
      await fetch();
      return row?.id ?? null;
    } catch (err: any) {
      toast.error("Erro ao salvar documento", { description: err.message });
      return null;
    }
  }, [user, currentHospital, resolvedRegistryId, fetch]);

  return { documentos, loading, save, refresh: fetch };
}
