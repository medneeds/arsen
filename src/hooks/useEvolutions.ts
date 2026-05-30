import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { toast } from "sonner";
import { parseDiagnosesText } from "@/lib/diagnosesText";
import { useActiveEncounterId } from "@/hooks/useActiveEncounterId";
import { useResolvedRegistryId } from "@/hooks/useResolvedRegistryId";

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

export function useEvolutions(
  patientId: string | null,
  fallback?: { patientName?: string; patientBed?: string; patientSector?: string }
) {
  const { user } = useAuth();
  const { currentHospital, currentState } = useHospital();
  const [evolutions, setEvolutions] = useState<EvolutionRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const safePatientId = asUuid(patientId);
  const fbName = fallback?.patientName?.trim() || null;
  const fbBed = fallback?.patientBed?.trim() || null;
  const fbSector = fallback?.patientSector?.trim() || null;

  // Fase B.1 — filtro por atendimento ativo (encounter_id) para evitar
  // arrastar evoluções do ocupante anterior do leito.
  const { encounterId: activeEncounterId } = useActiveEncounterId(safePatientId);

  // 🔒 Documentação SEGUE O PACIENTE: resolvemos o patient_registry_id (identidade
  // clínica permanente) a partir do bed-row atual e priorizamos ele no filtro.
  // Assim, ao transferir ou realocar o paciente entre leitos, a timeline de
  // evoluções continua junto — independente do `patients.id` da linha do leito.
  const { registryId: resolvedRegistryId } = useResolvedRegistryId(safePatientId);

  const loadEvolutions = useCallback(async (silent: boolean = false) => {
    if (!currentHospital || !currentState) return;
    if (!silent) setLoading(true);
    try {
      // 🔒 BARREIRA DE SETOR: filtrar evoluções pelo setor esperado do paciente.
      // Impede que evoluções de outro setor vazem para o leito atual,
      // especialmente em casos de reassociação de leito ou registro legado.
      // fbSector pode ser o nome de exibição ("UTI 2") ou o código interno ("yellow").
      // Mapeamos ambos para garantir cobertura.
      const sectorCodeMap: Record<string, string> = {
        "UTI 1": "red", "UTI 2": "yellow", "UCI 1": "blue", "UCI 2": "outside",
        "red": "red", "yellow": "yellow", "blue": "blue", "outside": "outside",
      };
      const normalizedSector = fbSector ? (sectorCodeMap[fbSector] ?? fbSector) : null;

      let query = supabase
        .from("clinical_evolutions")
        .select("*")
        .eq("hospital_unit_id", currentHospital.id)
        .eq("state_id", currentState.id)
        // ⚠️ Nunca trazer evoluções arquivadas (paciente anterior do leito,
        // reverts de re-bind incorreto, etc). Auditoria preservada no banco.
        .is("archived_at", null)
        .order("created_at", { ascending: false });

      // 🔒 Aplicar barreira de setor se disponível.
      // OR cobre os dois formatos históricos: código interno ("yellow") e nome de exibição ("UTI 2"),
      // além de registros sem patient_sector (gravados antes da padronização do campo).
      const sectorDisplayNames: Record<string, string> = {
        "red": "UTI 1", "yellow": "UTI 2", "blue": "UCI 1", "outside": "UCI 2",
      };
      const sectorDisplayName = normalizedSector ? (sectorDisplayNames[normalizedSector] ?? normalizedSector) : null;
      if (normalizedSector && sectorDisplayName && normalizedSector !== sectorDisplayName) {
        query = query.or(
          `patient_sector.eq.${normalizedSector},patient_sector.eq.${sectorDisplayName},patient_sector.is.null`
        );
      } else if (normalizedSector) {
        query = query.or(`patient_sector.eq.${normalizedSector},patient_sector.is.null`);
      }

      if (resolvedRegistryId) {
        // 🔒 Quando temos registry_id como âncora, ele é suficiente para identificar
        // o paciente de forma segura. NÃO filtramos por encounter_id aqui porque:
        // - Evoluções D1-D6 podem ter encounter_id de um encounter antigo (fechado/reaberto)
        // - Evoluções gravadas antes do encounter ainda têm encounter_id = null
        // - O registry_id já garante isolamento — evoluções de outro paciente
        //   nunca compartilharão o mesmo registry_id.
        // OR adicional cobre legados sem patient_registry_id (vinculados só por patient_id).
        query = query.or(
          `patient_registry_id.eq.${resolvedRegistryId},and(patient_registry_id.is.null,patient_id.eq.${safePatientId})`
        );
      } else if (safePatientId && activeEncounterId) {
        // Sem registry: buscar por patient_id, cobrindo encounter ativo e legados sem encounter
        query = query
          .eq("patient_id", safePatientId)
          .or(`encounter_id.eq.${activeEncounterId},encounter_id.is.null`);
      } else if (safePatientId) {
        // ⚠️ Sem registry nem encounter resolvido: buscar por patient_id direto como
        // fallback defensivo. Isso evita que pacientes com patient_registry_id = NULL
        // (registros legados ou admitidos antes da implementação do registry) percam
        // o acesso às suas evoluções.
        // Barreira: filtramos apenas evoluções archived_at IS NULL (já aplicado acima)
        // e limitamos ao hospital_unit_id (também já aplicado) para evitar vazamento.
        console.warn('[useEvolutions] sem encounter/registry — usando fallback por patient_id');
        query = query.eq("patient_id", safePatientId);
      } else {
        setEvolutions([]);
        if (!silent) setLoading(false);
        return;
      }

      const { data, error } = await query;

      if (error) throw error;

      const mapped: EvolutionRecord[] = (data || []).map((d: any) => ({
        ...d,
        soap_data: { ...EMPTY_SOAP, ...(d.soap_data as any) },
        vital_signs: { ...EMPTY_VITALS, ...(d.vital_signs as any) },
        physical_exam: { ...EMPTY_EXAM, ...(d.physical_exam as any) },
      })).filter((e: any) => !e.archived_at);

      const hasAdmissionEvo = mapped.some(e => (e as any).evolution_type === "admission");
      if (!hasAdmissionEvo && safePatientId) {
        const { data: ah } = await supabase
          .from("admission_histories")
          .select("*")
          .eq("patient_id", safePatientId)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (ah) {
          const cidLine = [ah.cid_primary, ah.cid_secondary].filter(Boolean).join(" • ");
          const virtual: EvolutionRecord = {
            id: `admission:${ah.id}`,
            patient_id: ah.patient_id,
            patient_name: fbName || "",
            patient_bed: fbBed,
            patient_sector: fbSector,
            soap_data: {
              subjective: ah.clinical_history || ah.chief_complaint || "",
              objective: "",
              assessment: cidLine || ah.diagnostic_hypothesis || ah.macro_diagnosis || "",
              plan: ah.initial_conduct || "",
            },
            vital_signs: { ...EMPTY_VITALS },
            physical_exam: { ...EMPTY_EXAM },
            status: "validated",
            evolution_type: "admission",
            validated_at: ah.created_at,
            validated_by: ah.created_by ?? null,
            validated_by_name: null,
            suspended_at: null,
            suspension_reason: null,
            created_by: ah.created_by ?? "",
            created_by_name: null,
            created_at: ah.created_at,
            updated_at: ah.updated_at,
          };
          mapped.push(virtual);
        }
      }

      mapped.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setEvolutions(mapped);
    } catch (err: any) {
      console.error("Error fetching evolutions:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [safePatientId, fbName, fbBed, fbSector, currentHospital, currentState, activeEncounterId, resolvedRegistryId]);

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
    if (!user || !currentHospital || !currentState) {
      toast.error("Contexto hospitalar não disponível");
      return null;
    }
    try {
      const doctorName = user.user_metadata?.full_name || "Dr. Carlos Eduardo Mendes";
      const { data, error } = await supabase
        .from("clinical_evolutions")
        .insert({
          patient_id: safePatientId,
          // 🔒 Carimba a identidade clínica permanente (segue o paciente entre leitos).
          patient_registry_id: resolvedRegistryId ?? null,
          encounter_id: activeEncounterId ?? null,
          patient_name: patientName,
          patient_bed: patientBed,
          patient_sector: patientSector,
          soap_data: {
            ...(soapData || EMPTY_SOAP),
            // Campos por item — armazenados no JSON do soap_data
            planItems: planItems?.filter(Boolean) ?? [],
            pendenciasItems: pendenciasItems?.filter(Boolean) ?? [],
          },
          vital_signs: vitalSigns || EMPTY_VITALS,
          physical_exam: physicalExam || EMPTY_EXAM,
          diagnostic_hypotheses: diagnosticHypotheses ?? null,
          cid_primary: cidPrimary ?? null,
          cid_secondary: cidSecondary ?? null,
          hospital_unit_id: currentHospital.id,
          state_id: currentState.id,
          created_by: user.id,
          created_by_name: doctorName,
          status: "draft",
        } as any)
        .select()
        .single();

      if (error) throw error;

      // 🔒 Sincronização com o mapa de leitos
      if (safePatientId) {
        const patientUpdates: Record<string, unknown> = {};

        // Hipóteses → patients.diagnoses
        if (diagnosticHypotheses !== undefined) {
          patientUpdates.diagnoses = parseDiagnosesText(diagnosticHypotheses);
        }

        // Antecedentes → patients.medical_history
        if (antecedentes && antecedentes.length > 0) {
          patientUpdates.medical_history = antecedentes.filter(Boolean).join("\n");
        }

        // Pendências → patients.pendencies
        if (pendenciasItems && pendenciasItems.length > 0) {
          patientUpdates.pendencies = pendenciasItems.filter(Boolean).join("\n");
        }

        if (Object.keys(patientUpdates).length > 0) {
          try {
            await supabase
              .from("patients")
              .update(patientUpdates as any)
              .eq("id", safePatientId);
          } catch (syncErr) {
            console.warn("[useEvolutions] sync mapa error", syncErr);
          }
        }
      }

      toast.success("Evolução criada com sucesso");
      await refreshSilently();
      return {
        ...data,
        soap_data: { ...EMPTY_SOAP, ...(data.soap_data as any) },
        vital_signs: { ...EMPTY_VITALS, ...(data.vital_signs as any) },
        physical_exam: { ...EMPTY_EXAM, ...(data.physical_exam as any) },
      } as EvolutionRecord;
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
    const target = evolutions.find((e) => e.id === id);
    if (target?.archived_at) {
      toast.error("Evolução arquivada não pode ser editada");
      await refreshSilently();
      return false;
    }
    try {
      const { error } = await supabase
        .from("clinical_evolutions")
        .update(updates as any)
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
    const target = evolutions.find((e) => e.id === id);
    if (target?.archived_at) {
      toast.error("Evolução arquivada não pode ser validada");
      await refreshSilently();
      return false;
    }
    try {
      const doctorName = user.user_metadata?.full_name || "Dr. Carlos Eduardo Mendes";
      const { error } = await supabase
        .from("clinical_evolutions")
        .update({
          status: "validated",
          validated_at: new Date().toISOString(),
          validated_by: user.id,
          validated_by_name: doctorName,
        } as any)
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
      const { error } = await supabase
        .from("clinical_evolutions")
        .update({
          status: "suspended",
          suspended_at: new Date().toISOString(),
          suspended_by: user.id,
          suspension_reason: reason,
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
        .from("clinical_evolutions")
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
    if (source.archived_at) {
      toast.error("Evolução arquivada não pode ser duplicada");
      await refreshSilently();
      return null;
    }
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
