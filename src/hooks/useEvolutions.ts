import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { toast } from "sonner";
import { parseDiagnosesText } from "@/lib/diagnosesText";

export interface EvolutionRecord {
  id: string;
  patient_id: string | null;
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

  const loadEvolutions = useCallback(async (silent: boolean = false) => {
    if (!currentHospital || !currentState) return;
    if (!silent) setLoading(true);
    try {
      let query = supabase
        .from("clinical_evolutions")
        .select("*")
        .eq("hospital_unit_id", currentHospital.id)
        .eq("state_id", currentState.id)
        .order("created_at", { ascending: false });

      if (safePatientId) {
        query = query.eq("patient_id", safePatientId);
      } else if (fbName) {
        query = query.is("patient_id", null).eq("patient_name", fbName);
        if (fbBed) query = query.eq("patient_bed", fbBed);
        if (fbSector) query = query.eq("patient_sector", fbSector);
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
      }));

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
  }, [safePatientId, fbName, fbBed, fbSector, currentHospital, currentState]);

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
    diagnosticHypotheses?: string
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
          patient_name: patientName,
          patient_bed: patientBed,
          patient_sector: patientSector,
          soap_data: soapData || EMPTY_SOAP,
          vital_signs: vitalSigns || EMPTY_VITALS,
          physical_exam: physicalExam || EMPTY_EXAM,
          diagnostic_hypotheses: diagnosticHypotheses ?? null,
          hospital_unit_id: currentHospital.id,
          state_id: currentState.id,
          created_by: user.id,
          created_by_name: doctorName,
          status: "draft",
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Sincroniza hipóteses → mapa de leitos (patients.diagnoses)
      if (safePatientId && diagnosticHypotheses !== undefined) {
        const arr = parseDiagnosesText(diagnosticHypotheses);
        try {
          await supabase
            .from("patients")
            .update({ diagnoses: arr } as any)
            .eq("id", safePatientId);
        } catch (syncErr) {
          console.warn("[useEvolutions] sync diagnoses error", syncErr);
        }
      }

      toast.success("Evolução criada com sucesso");
      await fetchEvolutions();
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
    }
  ) => {
    try {
      const { error } = await supabase
        .from("clinical_evolutions")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
      toast.success("Evolução salva");
      await fetchEvolutions();
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
      await fetchEvolutions();
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
      await fetchEvolutions();
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
      await fetchEvolutions();
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
      source.physical_exam
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
