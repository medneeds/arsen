import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { detectUnidentified } from "@/lib/unidentifiedDetector";

export interface PatientIdentifiers {
  /** Número de Prontuário (ex: 26-001-000123-4) */
  prontuario: string | null;
  /** Código de Atendimento (ex: 000000123456) */
  atendimento: string | null;
  /** Identificação do registro permanente do paciente */
  registry: {
    id: string | null;
    fullName: string | null;
    socialName: string | null;
    cpf: string | null;
    cns: string | null;
    birthDate: string | null;
    sex: string | null;
    motherName: string | null;
    phone: string | null;
    address: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
    bloodType: string | null;
    allergies: string | null;
    comorbidities: string | null;
    medicalRecord: string | null;
    isUnidentified: boolean;
    unidentifiedCode: string | null;
  } | null;
  loading: boolean;
}

/**
 * Loads the patient identifiers (prontuário + atendimento ativo) and
 * the persistent patient_registry row, used by <PatientCockpit /> to
 * surface "Prontuário" and "Atendimento" inline + a full "Ver mais" panel.
 */
export function usePatientIdentifiers(
  patientId: string | null,
  patientName: string | null,
  hospitalUnitId: string | null,
): PatientIdentifiers {
  const [state, setState] = useState<PatientIdentifiers>({
    prontuario: null,
    atendimento: null,
    registry: null,
    loading: false,
  });

  const [reloadTick, setReloadTick] = useState(0);
  const registryIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!patientId && !patientName) {
      setState({ prontuario: null, atendimento: null, registry: null, loading: false });
      return;
    }

    const run = async () => {
      setState((s) => ({ ...s, loading: true }));

      // 1) Find patient_registry by patient_id (via medical_records) or by name+unit
      let registryRow: any = null;
      let patientMedicalRecord: string | null = null;

      // 1a) Read patients.patient_registry_id / medical_record (vínculo direto da admissão)
      if (patientId) {
        const { data: pat } = await supabase
          .from("patients")
          .select("patient_registry_id, medical_record")
          .eq("id", patientId)
          .maybeSingle();
        if (pat?.medical_record) patientMedicalRecord = pat.medical_record;
        if (pat?.patient_registry_id) {
          const { data: reg } = await supabase
            .from("patient_registry")
            .select("*")
            .eq("id", pat.patient_registry_id)
            .maybeSingle();
          if (reg) registryRow = reg;
        }
      }

      // 1b) Try by medical_records.patient_id
      if (!registryRow && patientId) {
        const { data: mr } = await supabase
          .from("medical_records")
          .select("patient_registry_id, numero_prontuario")
          .eq("patient_id", patientId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (mr?.patient_registry_id) {
          const { data: reg } = await supabase
            .from("patient_registry")
            .select("*")
            .eq("id", mr.patient_registry_id)
            .maybeSingle();
          if (reg) registryRow = reg;
        }
      }

      // 1c) Fallback por medical_record (prontuário PIS/legado) → registry
      if (!registryRow && patientMedicalRecord) {
        const { data: reg } = await supabase
          .from("patient_registry")
          .select("*")
          .eq("medical_record", patientMedicalRecord)
          .maybeSingle();
        if (reg) registryRow = reg;
      }

      // 1d) Fallback por nome SOMENTE quando não temos patientId.
      // ⚠️  Crítico: pacientes "Não Identificados" frequentemente compartilham
      // o mesmo nome ("NÃO IDENTIFICADO", "DESCONHECIDO", etc). Buscar por nome
      // quando temos patientId pode trazer o registry de OUTRO paciente NI.
      if (!registryRow && !patientId && patientName && hospitalUnitId) {
        const { data } = await supabase
          .from("patient_registry")
          .select("*")
          .ilike("full_name", patientName.trim())
          .eq("hospital_unit_id", hospitalUnitId)
          .eq("is_unidentified", false)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) registryRow = data;
      }

      // 1e) GUARDA CRÍTICA: se o paciente é NI (nome detectado como Não Identificado)
      // e o registryRow encontrado é de um paciente IDENTIFICADO (nome real),
      // então o vínculo está errado/obsoleto e NÃO devemos usar esse registry —
      // isso evita que o cabeçalho do PDF venha com dados de outro paciente.
      const niDetection = detectUnidentified(patientName || "");
      if (registryRow && niDetection.isUnidentified && !registryRow.is_unidentified) {
        registryRow = null;
      }

      // 2) Prontuário: prefer medical_records linked to registry
      let prontuario: string | null = null;
      if (registryRow?.id) {
        const { data: mr } = await supabase
          .from("medical_records")
          .select("numero_prontuario")
          .eq("patient_registry_id", registryRow.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        prontuario = mr?.numero_prontuario || registryRow.medical_record || null;
      } else if (patientId) {
        const { data: mr } = await supabase
          .from("medical_records")
          .select("numero_prontuario")
          .eq("patient_id", patientId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        prontuario = mr?.numero_prontuario || null;
      }
      // Último fallback: número do PIS gravado em patients.medical_record
      if (!prontuario && patientMedicalRecord) {
        prontuario = patientMedicalRecord;
      }

      // 3) Atendimento: latest active patient_encounter.
      // ⚠️  Só buscamos por patient_id ou registry_id — NUNCA por patient_name,
      // pois pacientes não identificados podem compartilhar o mesmo nome
      // e isso traria o atendimento de outro paciente.
      let atendimento: string | null = null;
      if (patientId || registryRow?.id) {
        let encounterQuery = supabase
          .from("patient_encounters")
          .select("encounter_code, status, created_at")
          .order("created_at", { ascending: false })
          .limit(1);

        if (patientId) {
          encounterQuery = encounterQuery.eq("patient_id", patientId);
        } else if (registryRow?.id) {
          encounterQuery = encounterQuery.eq("registry_id", registryRow.id);
        }
        if (hospitalUnitId) encounterQuery = encounterQuery.eq("hospital_unit_id", hospitalUnitId);

        const { data: enc } = await encounterQuery.maybeSingle();
        atendimento = enc?.encounter_code || null;
      }

      if (cancelled) return;

      registryIdRef.current = registryRow?.id || null;

      setState({
        prontuario,
        atendimento,
        registry: registryRow
          ? {
              id: registryRow.id,
              fullName: registryRow.full_name,
              socialName: registryRow.social_name,
              cpf: registryRow.cpf,
              cns: registryRow.cns,
              birthDate: registryRow.birth_date,
              sex: registryRow.sex,
              motherName: registryRow.mother_name,
              phone: registryRow.phone,
              address: registryRow.address,
              neighborhood: registryRow.neighborhood,
              city: registryRow.city,
              state: registryRow.state,
              bloodType: registryRow.blood_type,
              allergies: registryRow.allergies,
              comorbidities: registryRow.comorbidities,
              medicalRecord: registryRow.medical_record,
              isUnidentified: !!registryRow.is_unidentified,
              unidentifiedCode: registryRow.unidentified_code,
            }
          : null,
        loading: false,
      });
    };

    run().catch(() => {
      if (!cancelled) setState((s) => ({ ...s, loading: false }));
    });

    return () => {
      cancelled = true;
    };
  }, [patientId, patientName, hospitalUnitId, reloadTick]);

  // Realtime: refaz a query quando muda o paciente, prontuário, atendimento ou registry vinculado.
  useEffect(() => {
    if (!patientId) return;
    const bump = () => setReloadTick((t) => t + 1);
    const channel = supabase
      .channel(`patient-identifiers-${patientId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "patients", filter: `id=eq.${patientId}` },
        bump)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "medical_records", filter: `patient_id=eq.${patientId}` },
        bump)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "patient_encounters", filter: `patient_id=eq.${patientId}` },
        bump)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "patient_registry" },
        (payload: any) => {
          const row = (payload.new || payload.old) as any;
          if (row?.id && row.id === registryIdRef.current) bump();
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [patientId]);

  return state;
}
