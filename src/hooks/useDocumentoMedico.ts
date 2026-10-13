import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type DocumentoMedicoType = "atestado" | "relatorio" | "termo";

export interface DocumentoMedicoData {
  id?: string;
  type: DocumentoMedicoType;
  patient_id?: string | null;
  patient_name: string;
  patient_bed?: string;
  patient_sector?: string;
  patient_birth_date?: string | null;
  patient_medical_record?: string | null;
  patient_age?: string | null;
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
 *
 * Persiste na tabela dedicada `documentos_medicos` (colunas: tipo, internacao_id,
 * paciente_id, paciente_nome/leito/setor, corpo, dias, cid, assinado_por(FK
 * profissionais.id), assinado_por_nome, crm_assinatura, criado_em). `internacao_id`
 * é NULLABLE — permite emitir documento de paciente não internado; `paciente_id`
 * é preenchido pelo banco a partir da internação (vínculo estável).
 *
 * `patientId` recebido pelo hook é `internacoes.id`. Em `DocumentoMedicoData`,
 * `patient_id` continua representando a internação (compatibilidade com os
 * componentes que consomem este hook).
 */

/** Resolve profissionais.id a partir do auth user id (assinado_por ≠ auth.uid). */
async function resolveProfissionalId(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data } = await supabase
      .from("profissionais")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    return (data as any)?.id ?? null;
  } catch {
    return null;
  }
}

export function mapRow(r: any, fallbackName?: string | null): DocumentoMedicoData {
  return {
    id: r.id,
    type: r.tipo,
    patient_id: r.internacao_id ?? null,
    patient_name: r.paciente_nome ?? fallbackName ?? "",
    patient_bed: r.paciente_leito ?? undefined,
    patient_sector: r.paciente_setor ?? undefined,
    body: r.corpo ?? "",
    days: r.dias ?? null,
    cid: r.cid ?? null,
    signed_by_name: r.assinado_por_nome ?? undefined,
    signed_by_crm: r.crm_assinatura ?? undefined,
    created_at: r.criado_em,
  };
}

export function useDocumentoMedico(
  patientId?: string | null,
  patientName?: string | null,
) {
  const { user } = useAuth();
  const [documentos, setDocumentos] = useState<DocumentoMedicoData[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!patientId) {
      setDocumentos([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("documentos_medicos")
        .select("*")
        .eq("internacao_id", patientId)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      setDocumentos((data ?? []).map((r) => mapRow(r, patientName)));
    } catch (err: any) {
      toast.error("Não foi possível carregar documentos médicos", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, [patientId, patientName]);

  useEffect(() => { fetch(); }, [fetch]);

  /** Salva um novo documento (atestado/relatório/termo). Retorna o id criado. */
  const save = useCallback(async (data: DocumentoMedicoData): Promise<string | null> => {
    try {
      const internacaoId = data.patient_id ?? patientId ?? null;
      if (!internacaoId && !data.patient_name) {
        toast.error("Informe o paciente antes de salvar o documento");
        return null;
      }
      const assinadoPor = await resolveProfissionalId(user?.id);
      const payload: Record<string, any> = {
        tipo: data.type,
        internacao_id: internacaoId,
        // paciente_id é preenchido pelo trigger a partir da internação.
        paciente_nome: data.patient_name,
        paciente_leito: data.patient_bed ?? null,
        paciente_setor: data.patient_sector ?? null,
        corpo: data.body,
        dias: data.days ?? null,
        cid: data.cid ?? null,
        assinado_por: assinadoPor,
        assinado_por_nome: data.signed_by_name ?? null,
        crm_assinatura: data.signed_by_crm ?? null,
      };

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
      toast.error("Não foi possível salvar documento", { description: err.message });
      return null;
    }
  }, [user, patientId, fetch]);

  return { documentos, loading, save, refresh: fetch };
}
