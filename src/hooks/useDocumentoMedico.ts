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
 * MIGRAÇÃO: `documentos_medicos` não existe no schema novo → mapeado para
 * `altas` (per de-para). `patientId` é `internacoes.id` → vínculo por
 * internacao_id. Colunas de altas: tipo (atestado/relatorio/termo),
 * conteudo(Json), crm_assinatura, assinado_por(FK profissionais.id), data_hora.
 *
 * Como `altas` não tem colunas dedicadas para body, days, cid, patient e nome do
 * assinante, esses campos são preservados dentro de `conteudo` (Json). Filtra os
 * documentos pelos três tipos deste hook — `altas` também guarda desfechos
 * (alta_hospitalar/obito), tratados por usePatientDischargeDocs.
 *
 * DEGRADADO:
 * - Vínculo estável por paciente (patient_registry_id/paciente_id) removido:
 *   `altas` só referencia internacao_id → cross-internação não é possível aqui.
 * - Salvar exige internação ativa (altas.internacao_id NOT NULL); sem patientId
 *   não é possível emitir (antes documentos_medicos aceitava só patient_name).
 * - encounter_id / hospital_unit_id / created_by descontinuados (sem coluna).
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

const DOC_MEDICO_TIPOS = ["atestado", "relatorio", "termo"];

function mapRow(r: any, fallbackName?: string | null): DocumentoMedicoData {
  const c = (r.conteudo ?? {}) as Record<string, any>;
  return {
    id: r.id,
    type: r.tipo,
    patient_id: r.internacao_id ?? null,
    patient_name: c.patient_name ?? fallbackName ?? "",
    patient_bed: c.patient_bed ?? undefined,
    patient_sector: c.patient_sector ?? undefined,
    body: c.body ?? "",
    days: c.days ?? null,
    cid: c.cid ?? null,
    signed_by_name: c.signed_by_name ?? undefined,
    signed_by_crm: r.crm_assinatura ?? undefined,
    created_at: r.criado_em ?? r.data_hora,
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
        .from("altas")
        .select("*")
        .eq("internacao_id", patientId)
        .in("tipo", DOC_MEDICO_TIPOS)
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
      if (!internacaoId) {
        // MIGRAÇÃO: altas.internacao_id é NOT NULL — sem internação ativa não há
        // onde vincular o documento.
        toast.error("Selecione um paciente internado antes de salvar o documento");
        return null;
      }
      const assinadoPor = await resolveProfissionalId(user?.id);
      const payload: Record<string, any> = {
        internacao_id: internacaoId,
        tipo: data.type,
        crm_assinatura: data.signed_by_crm ?? null,
        assinado_por: assinadoPor,
        // Campos sem coluna dedicada em altas → preservados no conteudo (Json).
        conteudo: {
          body: data.body,
          days: data.days ?? null,
          cid: data.cid ?? null,
          patient_name: data.patient_name,
          patient_bed: data.patient_bed ?? null,
          patient_sector: data.patient_sector ?? null,
          signed_by_name: data.signed_by_name ?? null,
        },
      };

      const { data: row, error } = await supabase
        .from("altas")
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
