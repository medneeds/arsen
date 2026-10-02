import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables, TablesInsert, Json } from "@/integrations/supabase/types";

/** Linha de `altas` lida/gravada por este hook (shape gerado do schema). */
type AltaRow = Tables<"altas">;

export type BoletimCarater = "eletivo" | "urgencia" | "emergencia";
export type BoletimDestino = "rpa" | "uti" | "enfermaria";

/**
 * Dados do Boletim Cirurgico. Shape plano: os campos clinicos do boletim sao
 * persistidos dentro de `altas.conteudo` (Json), no mesmo padrao de
 * atestado/relatorio/termo (useDocumentoMedico) e de cvc_checklist/opme.
 */
export interface BoletimCirurgicoData {
  id?: string;
  /** internacao_id — vinculo obrigatorio (altas.internacao_id NOT NULL). */
  internacao_id?: string | null;
  patient_name: string;
  patient_bed?: string | null;
  patient_sector?: string | null;
  patient_age?: string | null;
  patient_birth_date?: string | null;
  patient_medical_record?: string | null;
  // --- Campos clinicos do boletim (conteudo Json) ---
  procedimento_proposto?: string | null;
  /** Unico campo minimo obrigatorio. */
  procedimento_realizado: string;
  cirurgiao_principal?: string | null;
  auxiliares?: string | null;
  anestesista?: string | null;
  tipo_anestesia?: string | null;
  carater?: BoletimCarater | null;
  data_hora_inicio?: string | null;
  data_hora_fim?: string | null;
  achados_operatorios?: string | null;
  intercorrencias?: string | null;
  sangramento_estimado?: string | null;
  materiais_opme?: string | null;
  destino_pos_operatorio?: BoletimDestino | null;
  // --- Assinatura ---
  signed_by_name?: string | null;
  signed_by_crm?: string | null;
  created_at?: string;
}

/**
 * Hook para criar e listar Boletins Cirurgicos de um paciente.
 *
 * REUSO DE INFRA: `boletins_cirurgicos` NAO existe no schema — o boletim e mais
 * um documento medico persistido em `altas` (tipo:"boletim_cirurgico"), igual a
 * atestado/relatorio/termo (useDocumentoMedico) e cvc_checklist/opme. `patientId`
 * e `internacoes.id` → vinculo por internacao_id. Colunas de altas usadas: tipo,
 * conteudo(Json), crm_assinatura, assinado_por(FK profissionais.id), data_hora.
 *
 * Como `altas` nao tem colunas dedicadas para os campos clinicos do boletim nem
 * para identificacao do paciente/assinante, tudo isso e preservado dentro de
 * `conteudo` (Json). numero_documento NAO e persistido — segue o mesmo padrao dos
 * demais documentos (codigo do documento gerado na impressao via generateDocCode).
 *
 * Filtra os boletins pelo tipo deste hook — `altas` tambem guarda desfechos
 * (alta_hospitalar/obito) e outros documentos.
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
    return (data as { id?: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}

const BOLETIM_TIPO = "boletim_cirurgico";

/** Le um campo do conteudo (Json) como string ou null, sem assumir `any`. */
function cStr(v: unknown): string | null {
  return v == null ? null : String(v);
}

export function mapBoletimRow(r: AltaRow, fallbackName?: string | null): BoletimCirurgicoData {
  const c = (r.conteudo ?? {}) as Record<string, unknown>;
  return {
    id: r.id,
    internacao_id: r.internacao_id ?? null,
    patient_name: cStr(c.patient_name) ?? fallbackName ?? "",
    patient_bed: cStr(c.patient_bed),
    patient_sector: cStr(c.patient_sector),
    patient_age: cStr(c.patient_age),
    patient_birth_date: cStr(c.patient_birth_date),
    patient_medical_record: cStr(c.patient_medical_record),
    procedimento_proposto: cStr(c.procedimento_proposto),
    procedimento_realizado: cStr(c.procedimento_realizado) ?? "",
    cirurgiao_principal: cStr(c.cirurgiao_principal),
    auxiliares: cStr(c.auxiliares),
    anestesista: cStr(c.anestesista),
    tipo_anestesia: cStr(c.tipo_anestesia),
    carater: (c.carater as BoletimCarater | null | undefined) ?? null,
    data_hora_inicio: cStr(c.data_hora_inicio),
    data_hora_fim: cStr(c.data_hora_fim),
    achados_operatorios: cStr(c.achados_operatorios),
    intercorrencias: cStr(c.intercorrencias),
    sangramento_estimado: cStr(c.sangramento_estimado),
    materiais_opme: cStr(c.materiais_opme),
    destino_pos_operatorio: (c.destino_pos_operatorio as BoletimDestino | null | undefined) ?? null,
    signed_by_name: cStr(c.signed_by_name),
    signed_by_crm: r.crm_assinatura ?? null,
    created_at: r.criado_em ?? r.data_hora,
  };
}

export function useBoletimCirurgico(
  patientId?: string | null,
  patientName?: string | null,
) {
  const { user } = useAuth();
  const [boletins, setBoletins] = useState<BoletimCirurgicoData[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!patientId) {
      setBoletins([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("altas")
        .select("*")
        .eq("internacao_id", patientId)
        .eq("tipo", BOLETIM_TIPO)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      setBoletins((data ?? []).map((r) => mapBoletimRow(r, patientName)));
    } catch (err) {
      toast.error("Nao foi possivel carregar boletins cirurgicos", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }, [patientId, patientName]);

  useEffect(() => { fetch(); }, [fetch]);

  /** Salva um novo boletim cirurgico. Retorna o id criado. */
  const save = useCallback(async (data: BoletimCirurgicoData): Promise<string | null> => {
    try {
      const internacaoId = data.internacao_id ?? patientId ?? null;
      if (!internacaoId) {
        // altas.internacao_id e NOT NULL — sem internacao ativa nao ha onde vincular.
        toast.error("Selecione um paciente internado antes de salvar o boletim");
        return null;
      }
      if (!data.procedimento_realizado?.trim()) {
        toast.error("Informe o procedimento realizado");
        return null;
      }
      const assinadoPor = await resolveProfissionalId(user?.id);
      // Campos sem coluna dedicada em altas → preservados no conteudo (Json).
      const conteudo: Json = {
        patient_name: data.patient_name,
        patient_bed: data.patient_bed ?? null,
        patient_sector: data.patient_sector ?? null,
        patient_age: data.patient_age ?? null,
        patient_birth_date: data.patient_birth_date ?? null,
        patient_medical_record: data.patient_medical_record ?? null,
        procedimento_proposto: data.procedimento_proposto ?? null,
        procedimento_realizado: data.procedimento_realizado,
        cirurgiao_principal: data.cirurgiao_principal ?? null,
        auxiliares: data.auxiliares ?? null,
        anestesista: data.anestesista ?? null,
        tipo_anestesia: data.tipo_anestesia ?? null,
        carater: data.carater ?? null,
        data_hora_inicio: data.data_hora_inicio ?? null,
        data_hora_fim: data.data_hora_fim ?? null,
        achados_operatorios: data.achados_operatorios ?? null,
        intercorrencias: data.intercorrencias ?? null,
        sangramento_estimado: data.sangramento_estimado ?? null,
        materiais_opme: data.materiais_opme ?? null,
        destino_pos_operatorio: data.destino_pos_operatorio ?? null,
        signed_by_name: data.signed_by_name ?? null,
      };
      const payload: TablesInsert<"altas"> = {
        internacao_id: internacaoId,
        tipo: BOLETIM_TIPO,
        crm_assinatura: data.signed_by_crm ?? null,
        assinado_por: assinadoPor,
        conteudo,
      };

      const { data: row, error } = await supabase
        .from("altas")
        .insert(payload)
        .select("id")
        .single();

      if (error) throw error;
      toast.success("Boletim cirurgico salvo");
      await fetch();
      return row?.id ?? null;
    } catch (err) {
      toast.error("Nao foi possivel salvar boletim cirurgico", {
        description: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }, [user, patientId, fetch]);

  return { boletins, loading, save, refresh: fetch };
}
