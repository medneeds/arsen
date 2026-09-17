import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { parseDiagnosesText } from "@/lib/diagnosesText";
import { toEvolucaoStatusDb, fromEvolucaoStatusDb } from "@/lib/evolucaoStatus";

// MIGRAÇÃO: clinical_evolutions → evolucoes.
// Colunas novas: id, internacao_id, profissional_id, data_hora, soap (Json),
// exame_fisico (Json), status, motivo_suspensao, criado_em, atualizado_em.
// O modelo antigo tinha dezenas de colunas dedicadas (patient_name/bed/sector,
// vital_signs, cid_*, validated_*, created_by*, evolution_type, archived_at, etc.)
// que NÃO existem em `evolucoes`. Elas foram degradadas: os dados são preservados
// dentro do JSON `soap` (chaves prefixadas com `__`), e os campos sem fonte
// retornam default. Ver MIGRACAO_DEGRADACOES.md.
// `patient_id` (antigo) == `internacao_id` (patientId == internacao.id).
// `profissional_id` referencia profissionais.id (≠ auth.uid) — resolvido via lookup.

export interface EvolutionRecord {
  id: string;
  patient_id: string | null;
  patient_registry_id?: string | null;
  archived_at?: string | null;
  archive_reason?: string | null;
  patient_name: string;
  patient_bed: string | null;
  patient_sector: string | null;
  soap_data: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  vital_signs: {
    pa: string;
    fc: string;
    fr: string;
    temp: string;
    spo2: string;
    glasgow: string;
    diurese: string;
    dor: string;
  };
  physical_exam: {
    general: string;
    cardiovascular: string;
    respiratory: string;
    abdomen: string;
    neurological: string;
    extremities: string;
    skin: string;
    other: string;
  };
  status: "draft" | "validated" | "suspended";
  evolution_type?: string;
  diagnostic_hypotheses?: string | null;
  cid_primary?: string | null;
  cid_secondary?: string[] | null;
  validated_at: string | null;
  validated_by: string | null;
  validated_by_name: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

const EMPTY_SOAP = { subjective: "", objective: "", assessment: "", plan: "" };
const EMPTY_VITALS = { pa: "", fc: "", fr: "", temp: "", spo2: "", glasgow: "", diurese: "", dor: "" };
const EMPTY_EXAM = { general: "", cardiovascular: "", respiratory: "", abdomen: "", neurological: "", extremities: "", skin: "", other: "" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const asUuid = (id: string | null): string | null => (id && UUID_RE.test(id) ? id : null);

/** Resolve profissionais.id a partir do auth user id (profissional_id ≠ auth.uid). */
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

/** Mapeia uma linha `evolucoes` para o view-model estável EvolutionRecord. */
function mapEvolution(d: any): EvolutionRecord {
  const soap = (d.soap as any) || {};
  return {
    id: d.id,
    patient_id: d.internacao_id ?? null,
    patient_registry_id: null, // MIGRAÇÃO: sem registry no schema novo
    archived_at: null, // MIGRAÇÃO: sem coluna archived_at em evolucoes
    archive_reason: null,
    patient_name: soap.__patient_name ?? "",
    patient_bed: soap.__patient_bed ?? null,
    patient_sector: soap.__patient_sector ?? null,
    // soap_data preserva TODAS as chaves do JSON (inclui diagnosticHypotheses,
    // planItems, pendenciasItems, antecedentes usados pelo PDF/consumidores).
    soap_data: { ...EMPTY_SOAP, ...soap },
    vital_signs: { ...EMPTY_VITALS, ...(soap.__vital_signs ?? {}) },
    physical_exam: { ...EMPTY_EXAM, ...((d.exame_fisico as any) ?? {}) },
    status: fromEvolucaoStatusDb(d.status),
    evolution_type: soap.__evolution_type ?? undefined,
    diagnostic_hypotheses: soap.__diagnostic_hypotheses ?? null,
    cid_primary: soap.__cid_primary ?? null,
    cid_secondary: soap.__cid_secondary ?? null,
    validated_at: soap.__validated_at ?? null,
    validated_by: soap.__validated_by ?? null,
    validated_by_name: soap.__validated_by_name ?? null,
    suspended_at: soap.__suspended_at ?? null,
    suspension_reason: d.motivo_suspensao ?? null,
    created_by: soap.__created_by ?? d.profissional_id ?? "",
    created_by_name: soap.__created_by_name ?? null,
    created_at: d.criado_em ?? d.data_hora,
    updated_at: d.atualizado_em ?? d.criado_em ?? d.data_hora,
  };
}

export function useEvolutions(
  patientId: string | null,
  fallback?: { patientName?: string; patientBed?: string; patientSector?: string }
) {
  const { user } = useAuth();
  const [evolutions, setEvolutions] = useState<EvolutionRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const safePatientId = asUuid(patientId);
  const fbName = fallback?.patientName?.trim() || null;
  const fbBed = fallback?.patientBed?.trim() || null;
  const fbSector = fallback?.patientSector?.trim() || null;

  const loadEvolutions = useCallback(async (silent: boolean = false) => {
    if (!safePatientId) {
      setEvolutions([]);
      return;
    }
    if (!silent) setLoading(true);
    try {
      // MIGRAÇÃO: evolucoes é ancorada por internacao_id (identidade da internação).
      // Toda a lógica antiga de registry/encounter/barreira-de-setor/leitos-históricos
      // (tabelas patient_registry, patient_encounters, admission_histories — mortas)
      // foi degradada: filtramos diretamente por internacao_id. evolucoes também não
      // tem colunas hospital_unit_id/state_id/archived_at, então esses filtros saíram.
      const { data, error } = await supabase
        .from("evolucoes")
        .select("*")
        .eq("internacao_id", safePatientId)
        .order("data_hora", { ascending: false });

      if (error) throw error;

      const mapped: EvolutionRecord[] = ((data as any[]) || []).map(mapEvolution);

      // Evolução virtual de admissão sintetizada a partir de `internacoes`
      // (substitui a antiga leitura de admission_histories, tabela morta).
      const hasAdmissionEvo = mapped.some((e) => e.evolution_type === "admission");
      if (!hasAdmissionEvo) {
        const { data: inter } = await supabase
          .from("internacoes")
          .select("*")
          .eq("id", safePatientId)
          .maybeSingle();
        if (inter) {
          const i = inter as any;
          const hasContent =
            i.queixa_principal || i.historia_clinica || i.hipotese_diagnostica || i.conduta_inicial;
          if (hasContent) {
            const virtual: EvolutionRecord = {
              id: `admission:${i.id}`,
              patient_id: i.id,
              patient_registry_id: null,
              archived_at: null,
              archive_reason: null,
              patient_name: fbName || "",
              patient_bed: fbBed,
              patient_sector: fbSector,
              soap_data: {
                subjective: i.historia_clinica || i.queixa_principal || "",
                objective: "",
                assessment: i.hipotese_diagnostica || "",
                plan: i.conduta_inicial || "",
              },
              vital_signs: { ...EMPTY_VITALS },
              physical_exam: { ...EMPTY_EXAM },
              status: "validated",
              evolution_type: "admission",
              diagnostic_hypotheses: i.hipotese_diagnostica ?? null,
              cid_primary: null,
              cid_secondary: null,
              validated_at: i.data_entrada || i.criado_em,
              validated_by: i.registrado_por ?? null,
              validated_by_name: null,
              suspended_at: null,
              suspension_reason: null,
              created_by: i.registrado_por ?? "",
              created_by_name: null,
              created_at: i.data_entrada || i.criado_em,
              updated_at: i.atualizado_em || i.criado_em,
            };
            mapped.push(virtual);
          }
        }
      }

      mapped.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setEvolutions(mapped);
    } catch (err: any) {
      console.error("Error fetching evolutions:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [safePatientId, fbName, fbBed, fbSector]);

  const fetchEvolutions = useCallback(() => loadEvolutions(false), [loadEvolutions]);
  const refreshSilently = useCallback(() => loadEvolutions(true), [loadEvolutions]);

  useEffect(() => {
    fetchEvolutions();
  }, [fetchEvolutions]);

  const createEvolution = async (
    patientName: string,
    patientBed: string,
    patientSector: string,
    soapData?: typeof EMPTY_SOAP,
    vitalSigns?: typeof EMPTY_VITALS,
    physicalExam?: typeof EMPTY_EXAM,
    diagnosticHypotheses?: string,
    cidPrimary?: string | null,
    cidSecondary?: string[] | null,
    antecedentes?: string[],
    planItems?: string[],
    pendenciasItems?: string[],
  ): Promise<EvolutionRecord | null> => {
    if (!user) {
      toast.error("Contexto de usuário não disponível");
      return null;
    }
    if (!safePatientId) {
      toast.error("Internação inválida para gravar evolução");
      return null;
    }
    try {
      const doctorName = user.user_metadata?.full_name || "Dr. Carlos Eduardo Mendes";
      const profissionalId = await resolveProfissionalId(user.id);
      if (!profissionalId) {
        toast.error("Profissional não encontrado para o usuário atual");
        return null;
      }

      const hypoArray = Array.isArray(diagnosticHypotheses)
        ? (diagnosticHypotheses as unknown as string[]).map((s) => String(s).trim()).filter(Boolean)
        : typeof diagnosticHypotheses === "string" && diagnosticHypotheses.trim()
          ? diagnosticHypotheses.split("\n").map((s) => s.trim()).filter(Boolean)
          : [];

      // MIGRAÇÃO: campos sem coluna dedicada em `evolucoes` são preservados dentro
      // do JSON `soap` (prefixo `__`). O exame físico vai na coluna `exame_fisico`.
      const soapPayload = {
        ...(soapData || EMPTY_SOAP),
        planItems: planItems?.filter(Boolean) ?? [],
        pendenciasItems: pendenciasItems?.filter(Boolean) ?? [],
        antecedentes: antecedentes?.filter(Boolean) ?? [],
        diagnosticHypotheses: hypoArray,
        __patient_name: patientName,
        __patient_bed: patientBed,
        __patient_sector: patientSector,
        __vital_signs: vitalSigns || EMPTY_VITALS,
        __diagnostic_hypotheses: diagnosticHypotheses ?? null,
        __cid_primary: cidPrimary ?? null,
        __cid_secondary: cidSecondary ?? null,
        __created_by: user.id,
        __created_by_name: doctorName,
        __evolution_type: (soapData as any)?.type ?? null,
      };

      const { data, error } = await supabase
        .from("evolucoes")
        .insert({
          internacao_id: safePatientId,
          profissional_id: profissionalId,
          data_hora: new Date().toISOString(),
          soap: soapPayload,
          exame_fisico: physicalExam || EMPTY_EXAM,
          status: toEvolucaoStatusDb("draft"),
        } as any)
        .select()
        .single();

      if (error) throw error;

      // 🔒 Sincronização com o card da internação (Painel Clínico).
      // MIGRAÇÃO: antes atualizava a tabela `patients`; agora escreve em `internacoes`.
      // Só sincroniza quando a evolução é de ROTINA (não complementar).
      const evoType = (soapData as any)?.type as string | undefined;
      const isComplementary =
        evoType === "intercurrence" || evoType === "vespertina" || evoType === "noturna";

      if (!isComplementary) {
        const interUpdates: Record<string, unknown> = {};

        // Hipóteses → internacoes.hipotese_diagnostica
        if (diagnosticHypotheses !== undefined) {
          const parsed = parseDiagnosesText(diagnosticHypotheses);
          interUpdates.hipotese_diagnostica = Array.isArray(parsed) ? parsed.join("\n") : parsed;
        }
        // Antecedentes → internacoes.historia_clinica
        if (antecedentes && antecedentes.length > 0) {
          interUpdates.historia_clinica = antecedentes.filter(Boolean).join("\n");
        }
        // Plano Terapêutico → internacoes.conduta_inicial
        if (planItems && planItems.length > 0) {
          interUpdates.conduta_inicial = planItems.filter(Boolean).join("\n");
        }
        // Pendências → internacoes.pendencias
        if (pendenciasItems && pendenciasItems.length > 0) {
          interUpdates.pendencias = pendenciasItems.filter(Boolean).join("\n");
        }

        if (Object.keys(interUpdates).length > 0) {
          try {
            await supabase
              .from("internacoes")
              .update(interUpdates as any)
              .eq("id", safePatientId);
          } catch (syncErr) {
            console.warn("[useEvolutions] sync internação error", syncErr);
          }
        }
      }

      toast.success("Evolução criada com sucesso");
      await refreshSilently();
      return mapEvolution(data);
    } catch (err: any) {
      toast.error("Erro ao criar evolução: " + err.message);
      return null;
    }
  };

  const updateEvolution = async (
    id: string,
    updates: {
      soap_data?: any;
      vital_signs?: any;
      physical_exam?: any;
      diagnostic_hypotheses?: string | null;
    }
  ) => {
    try {
      // MIGRAÇÃO: mescla no JSON `soap` (vital_signs/diagnostic_hypotheses não têm
      // coluna própria). Lê o soap atual para não sobrescrever chaves preservadas.
      const { data: existing } = await supabase
        .from("evolucoes")
        .select("soap")
        .eq("id", id)
        .maybeSingle();
      const mergedSoap: any = { ...(((existing as any)?.soap as any) || {}), ...(updates.soap_data || {}) };
      if (updates.vital_signs !== undefined) mergedSoap.__vital_signs = updates.vital_signs;
      if (updates.diagnostic_hypotheses !== undefined) {
        mergedSoap.__diagnostic_hypotheses = updates.diagnostic_hypotheses;
      }

      const payload: any = { soap: mergedSoap };
      if (updates.physical_exam !== undefined) payload.exame_fisico = updates.physical_exam;

      const { error } = await supabase
        .from("evolucoes")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
      toast.success("Evolução salva");
      await refreshSilently();
      return true;
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
      return false;
    }
  };

  const validateEvolution = async (id: string) => {
    if (!user) return false;
    try {
      const doctorName = user.user_metadata?.full_name || "Dr. Carlos Eduardo Mendes";
      // MIGRAÇÃO: validated_at/validated_by/validated_by_name não têm coluna →
      // preservados no JSON `soap`.
      const { data: existing } = await supabase
        .from("evolucoes")
        .select("soap")
        .eq("id", id)
        .maybeSingle();
      const mergedSoap: any = { ...(((existing as any)?.soap as any) || {}) };
      mergedSoap.__validated_at = new Date().toISOString();
      mergedSoap.__validated_by = user.id;
      mergedSoap.__validated_by_name = doctorName;

      const { error } = await supabase
        .from("evolucoes")
        .update({ status: toEvolucaoStatusDb("validated"), soap: mergedSoap } as any)
        .eq("id", id);
      if (error) throw error;
      toast.success("Evolução validada e assinada");
      await refreshSilently();
      return true;
    } catch (err: any) {
      toast.error("Erro ao validar: " + err.message);
      return false;
    }
  };

  const suspendEvolution = async (id: string, reason: string) => {
    if (!user) return false;
    try {
      // motivo_suspensao É coluna real em evolucoes. suspended_at fica no soap.
      const { data: existing } = await supabase
        .from("evolucoes")
        .select("soap")
        .eq("id", id)
        .maybeSingle();
      const mergedSoap: any = { ...(((existing as any)?.soap as any) || {}) };
      mergedSoap.__suspended_at = new Date().toISOString();
      mergedSoap.__suspended_by = user.id;

      const { error } = await supabase
        .from("evolucoes")
        .update({
          status: toEvolucaoStatusDb("suspended"),
          motivo_suspensao: reason,
          soap: mergedSoap,
        } as any)
        .eq("id", id);
      if (error) throw error;
      toast.success("Evolução suspensa");
      await refreshSilently();
      return true;
    } catch (err: any) {
      toast.error("Erro ao suspender: " + err.message);
      return false;
    }
  };

  const deleteEvolution = async (id: string) => {
    try {
      const { error } = await supabase
        .from("evolucoes")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Rascunho excluído");
      await refreshSilently();
      return true;
    } catch (err: any) {
      toast.error("Erro ao excluir: " + err.message);
      return false;
    }
  };

  const duplicateEvolution = async (
    source: EvolutionRecord,
    patientName: string,
    patientBed: string,
    patientSector: string
  ) => {
    return createEvolution(
      patientName,
      patientBed,
      patientSector,
      source.soap_data,
      source.vital_signs,
      source.physical_exam,
      source.diagnostic_hypotheses ?? undefined
    );
  };

  return {
    evolutions,
    loading,
    createEvolution,
    updateEvolution,
    validateEvolution,
    suspendEvolution,
    deleteEvolution,
    duplicateEvolution,
    refreshEvolutions: fetchEvolutions,
  };
}
