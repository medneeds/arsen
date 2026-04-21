import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHospital } from "@/contexts/HospitalContext";
import { toast } from "sonner";

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

export function useEvolutions(patientId: string | null) {
  const { user } = useAuth();
  const { currentHospital, currentState } = useHospital();
  const [evolutions, setEvolutions] = useState<EvolutionRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const safePatientId = asUuid(patientId);

  const fetchEvolutions = useCallback(async () => {
    if (!patientId || !currentHospital || !currentState) return;
    // Mock/non-UUID patient ids cannot be queried against uuid columns.
    // Skip remote fetch and start with an empty list so the UI stays usable.
    if (!safePatientId) {
      setEvolutions([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("clinical_evolutions")
        .select("*")
        .eq("patient_id", safePatientId)
        .eq("hospital_unit_id", currentHospital.id)
        .eq("state_id", currentState.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEvolutions(
        (data || []).map((d: any) => ({
          ...d,
          soap_data: { ...EMPTY_SOAP, ...(d.soap_data as any) },
          vital_signs: { ...EMPTY_VITALS, ...(d.vital_signs as any) },
          physical_exam: { ...EMPTY_EXAM, ...(d.physical_exam as any) },
        }))
      );
    } catch (err: any) {
      console.error("Error fetching evolutions:", err);
    } finally {
      setLoading(false);
    }
  }, [patientId, safePatientId, currentHospital, currentState]);

  useEffect(() => {
    fetchEvolutions();
  }, [fetchEvolutions]);

  const createEvolution = async (
    patientName: string,
    patientBed: string,
    patientSector: string,
    soapData?: typeof EMPTY_SOAP,
    vitalSigns?: typeof EMPTY_VITALS,
    physicalExam?: typeof EMPTY_EXAM
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
          patient_id: patientId,
          patient_name: patientName,
          patient_bed: patientBed,
          patient_sector: patientSector,
          soap_data: soapData || EMPTY_SOAP,
          vital_signs: vitalSigns || EMPTY_VITALS,
          physical_exam: physicalExam || EMPTY_EXAM,
          hospital_unit_id: currentHospital.id,
          state_id: currentState.id,
          created_by: user.id,
          created_by_name: doctorName,
          status: "draft",
        } as any)
        .select()
        .single();

      if (error) throw error;
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
