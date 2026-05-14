import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Patient } from "@/types/patient";

/**
 * Subscribes to a single patient row in real time.
 * Used by the clinical Cockpit so any change made in the
 * Painel Clínico (or elsewhere) reflects instantly on the
 * sidebar of /evolucao, /prescricao, etc.
 */
function rowToPatient(p: any): Patient {
  const splitLines = (v: string | null | undefined) =>
    v ? v.split("\n").filter(Boolean) : [];
  return {
    id: p.id,
    bedNumber: p.bed_number,
    name: p.name,
    age: p.age || "",
    sector: p.sector,
    diagnoses: splitLines(p.diagnoses),
    medicalHistory: splitLines(p.medical_history),
    relevantExams: splitLines(p.relevant_exams),
    pendencies: splitLines(p.pendencies),
    schedule: splitLines(p.schedule),
    admissionHistory: p.admission_history || "",
    admissionDate: p.admission_date || undefined,
    admittedAt: p.admitted_at || undefined,
    admissionStatus: p.admission_status || undefined,
    clinicalStatus: p.clinical_status || "regular",
    internmentStatus: p.internment_status || undefined,
    medicalResponsibility: p.medical_responsibility || undefined,
    utiAllergies: splitLines(p.uti_allergies),
    utiDevices: splitLines(p.uti_devices),
    utiDailyConducts: splitLines(p.uti_daily_conducts),
    utiDischargePrediction: splitLines(p.uti_discharge_prediction),
    utiCulturesAntibiotics: splitLines(p.uti_cultures_antibiotics),
    utiCurrentStatus: splitLines(p.uti_current_status),
    utiAdmissionDate: p.uti_admission_date || undefined,
    utiAdmissionReason: p.uti_admission_reason || undefined,
    utiOriginSector: p.uti_origin_sector || undefined,
    utiSpecialties: splitLines(p.uti_specialties),
  } as Patient;
}

export function usePatientLive(patientId: string | null) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchOnce = useCallback(async () => {
    if (!patientId) { setPatient(null); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("patients").select("*").eq("id", patientId).maybeSingle();
    if (!error && data) setPatient(rowToPatient(data));
    setLoading(false);
  }, [patientId]);

  useEffect(() => { fetchOnce(); }, [fetchOnce]);

  useEffect(() => {
    if (!patientId) return;
    const channel = supabase
      .channel(`patient-live-${patientId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "patients", filter: `id=eq.${patientId}` },
        (payload) => {
          if (payload.eventType === "DELETE") setPatient(null);
          else if (payload.new) setPatient(rowToPatient(payload.new));
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [patientId]);

  return { patient, loading, refresh: fetchOnce };
}
