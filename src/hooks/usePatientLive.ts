import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Patient } from "@/types/patient";
import { formatAge } from "@/lib/patientAge";

/**
 * Subscribes to a single patient row in real time.
 * Used by the clinical Cockpit so any change made in the
 * Painel Clínico (or elsewhere) reflects instantly on the
 * sidebar of /evolucao, /prescricao, etc.
 */
function rowToPatient(p: any, liveBirthDate?: string | null): Patient {
  const splitLines = (v: string | null | undefined) =>
    v ? v.split("\n").filter(Boolean) : [];
  return {
    id: p.id,
    bedNumber: p.bed_number,
    name: p.name,
    // Idade calculada a partir de patient_registry.birth_date (nunca fica
    // desatualizada) — patients.age (estático, congelado na admissão) só
    // entra como último recurso, para pacientes sem registry vinculado.
    age: formatAge(liveBirthDate) || p.age || "",
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
  // Cache do birth_date do patient_registry vinculado, por registryId.
  // patients.patient_registry_id não muda a toda atualização realtime,
  // então evitamos refetch de patient_registry a cada evento — só
  // buscamos de novo quando o vínculo muda.
  const birthDateCacheRef = useRef<{ registryId: string | null; birthDate: string | null }>({
    registryId: null,
    birthDate: null,
  });

  const resolveBirthDate = useCallback(async (registryId: string | null): Promise<string | null> => {
    if (!registryId) return null;
    if (birthDateCacheRef.current.registryId === registryId) {
      return birthDateCacheRef.current.birthDate;
    }
    try {
      const { data } = await supabase
        .from("patient_registry")
        .select("birth_date")
        .eq("id", registryId)
        .maybeSingle();
      const birthDate = data?.birth_date || null;
      birthDateCacheRef.current = { registryId, birthDate };
      return birthDate;
    } catch {
      return null;
    }
  }, []);

  const fetchOnce = useCallback(async () => {
    if (!patientId) { setPatient(null); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("patients").select("*").eq("id", patientId).maybeSingle();
    if (!error && data) {
      const birthDate = await resolveBirthDate(data.patient_registry_id || null);
      setPatient(rowToPatient(data, birthDate));
    }
    setLoading(false);
  }, [patientId, resolveBirthDate]);

  // 🔒 Reset imediato ao trocar de paciente — evita que dados stale do
  // paciente anterior apareçam no cockpit/cabeçalho durante o fetch.
  // O wrapper EvolucaoPageWrapper já força remontagem via key={patientId},
  // mas este reset protege outros contextos que usem usePatientLive.
  useEffect(() => {
    setPatient(null);
    setLoading(true);
  }, [patientId]);

  useEffect(() => { fetchOnce(); }, [fetchOnce]);

  useEffect(() => {
    if (!patientId) return;
    const channel = supabase
      .channel(`patient-live-${patientId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "patients", filter: `id=eq.${patientId}` },
        (payload) => {
          if (payload.eventType === "DELETE") { setPatient(null); return; }
          if (!payload.new) return;
          const row = payload.new as any;
          const registryId = row.patient_registry_id || null;
          if (birthDateCacheRef.current.registryId === registryId) {
            // Vínculo não mudou — usa o birth_date já em cache, sem round-trip.
            setPatient(rowToPatient(row, birthDateCacheRef.current.birthDate));
          } else {
            // Vínculo mudou (relocação/correção de cadastro) — resolve de novo.
            setPatient(rowToPatient(row, null));
            resolveBirthDate(registryId).then((birthDate) => {
              setPatient(rowToPatient(row, birthDate));
            });
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [patientId, resolveBirthDate]);

  return { patient, loading, refresh: fetchOnce };
}
