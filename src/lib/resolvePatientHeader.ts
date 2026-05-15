/**
 * Resolução imperativa (Promise) da identidade do paciente para uso em
 * handlers de impressão de PDF (admissão, evolução, prescrição, requisições,
 * round). Compartilha a MESMA lógica do hook `usePatientIdentifiers`,
 * incluindo a guarda crítica anti-NI: se o paciente é "Não Identificado"
 * mas o `patient_registry` vinculado é de um identificado, descarta o
 * vínculo para evitar que o cabeçalho do PDF venha com dados de outro paciente.
 *
 * Use sempre este helper antes de chamar qualquer função `print*` —
 * jamais imprima usando `evo.patient_name`, `patient.name` snapshot
 * ou leitura ad-hoc de `patient_registry`.
 */
import { supabase } from "@/integrations/supabase/client";
import { detectUnidentified } from "@/lib/unidentifiedDetector";

export interface ResolvedPatientHeader {
  /** Nome canônico (registry.full_name → patient.name → fallback) */
  name: string;
  socialName: string | null;
  /** Número de Prontuário (ex: 26-001-000123-4) */
  prontuario: string | null;
  /** Código de Atendimento (12 dígitos) */
  atendimento: string | null;
  cpf: string | null;
  cns: string | null;
  /** ISO yyyy-mm-dd */
  birthDate: string | null;
  sex: string | null;
  motherName: string | null;
  /** Endereço composto (logradouro, bairro, cidade/UF) */
  address: string | null;
  phone: string | null;
  isUnidentified: boolean;
  unidentifiedCode: string | null;
  /** ID do registry vinculado (após guarda anti-NI) — null se descartado */
  registryId: string | null;
}

/**
 * Lê o leito + setor ATUAIS do paciente direto da tabela `patients`
 * (após qualquer relocação/transferência). Use SEMPRE este helper antes
 * de imprimir documentos clínicos — nunca confie em snapshots gravados em
 * evoluções/admissões antigas, pois o paciente pode ter mudado de leito
 * desde então.
 *
 * Retorna `{ bed: null, sector: null }` se o paciente não existir mais
 * (alta) ou se a consulta falhar — o caller deve aplicar fallback para
 * o snapshot que tiver em mãos.
 */
export async function resolveCurrentBedSector(
  patientId: string | null | undefined,
): Promise<{ bed: string | null; sector: string | null }> {
  if (!patientId) return { bed: null, sector: null };
  try {
    const { data } = await supabase
      .from("patients")
      .select("bed_number, sector")
      .eq("id", patientId)
      .maybeSingle();
    return {
      bed: (data?.bed_number as string) || null,
      sector: (data?.sector as string) || null,
    };
  } catch {
    return { bed: null, sector: null };
  }
}

export async function resolvePatientHeader(
  patientId: string | null | undefined,
  fallbackName: string | null | undefined,
  hospitalUnitId: string | null | undefined,
): Promise<ResolvedPatientHeader> {
  const empty: ResolvedPatientHeader = {
    name: fallbackName || "—",
    socialName: null,
    prontuario: null,
    atendimento: null,
    cpf: null,
    cns: null,
    birthDate: null,
    sex: null,
    motherName: null,
    address: null,
    phone: null,
    isUnidentified: false,
    unidentifiedCode: null,
    registryId: null,
  };

  if (!patientId && !fallbackName) return empty;

  let registryRow: any = null;
  let patientMedicalRecord: string | null = null;
  let patientRowName: string | null = null;

  // 1a) patients.patient_registry_id (vínculo direto da admissão)
  if (patientId) {
    const { data: pat } = await supabase
      .from("patients")
      .select("patient_registry_id, medical_record, name")
      .eq("id", patientId)
      .maybeSingle();
    if (pat?.medical_record) patientMedicalRecord = pat.medical_record;
    if (pat?.name) patientRowName = pat.name as string;
    if (pat?.patient_registry_id) {
      const { data: reg } = await supabase
        .from("patient_registry")
        .select("*")
        .eq("id", pat.patient_registry_id)
        .maybeSingle();
      if (reg) registryRow = reg;
    }
  }

  // 1b) medical_records.patient_id
  if (!registryRow && patientId) {
    const { data: mr } = await supabase
      .from("medical_records")
      .select("patient_registry_id")
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

  // 1c) Fallback por medical_record (legado/PIS) → registry
  if (!registryRow && patientMedicalRecord) {
    const { data: reg } = await supabase
      .from("patient_registry")
      .select("*")
      .eq("medical_record", patientMedicalRecord)
      .maybeSingle();
    if (reg) registryRow = reg;
  }

  // 1d) Por nome SOMENTE quando não temos patientId — e nunca para NI
  const candidateName = (patientRowName || fallbackName || "").trim();
  if (!registryRow && !patientId && candidateName && hospitalUnitId) {
    const { data } = await supabase
      .from("patient_registry")
      .select("*")
      .ilike("full_name", candidateName)
      .eq("hospital_unit_id", hospitalUnitId)
      .eq("is_unidentified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) registryRow = data;
  }

  // 1e) GUARDA CRÍTICA — paciente NI vinculado a identificado: descartar
  const niDetection = detectUnidentified(patientRowName || fallbackName || "");
  if (registryRow && niDetection.isUnidentified && !registryRow.is_unidentified) {
    registryRow = null;
  }

  // 2) Prontuário
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
  if (!prontuario && patientMedicalRecord) prontuario = patientMedicalRecord;

  // 3) Atendimento — só por patient_id ou registry_id, NUNCA por nome
  let atendimento: string | null = null;
  if (patientId || registryRow?.id) {
    let q = supabase
      .from("patient_encounters")
      .select("encounter_code, created_at")
      .order("created_at", { ascending: false })
      .limit(1);
    if (patientId) q = q.eq("patient_id", patientId);
    else if (registryRow?.id) q = q.eq("registry_id", registryRow.id);
    if (hospitalUnitId) q = q.eq("hospital_unit_id", hospitalUnitId);
    const { data: enc } = await q.maybeSingle();
    atendimento = (enc as any)?.encounter_code || null;
  }

  const composedAddress =
    [
      registryRow?.address,
      registryRow?.neighborhood,
      registryRow?.city && registryRow?.state
        ? `${registryRow.city}/${registryRow.state}`
        : registryRow?.city || registryRow?.state,
    ]
      .filter(Boolean)
      .join(" — ") || null;

  // Nome canônico:
  //  - se temos registry confiável, usa ele
  //  - senão, prioriza o nome atual da linha `patients` (mais recente que snapshot
  //    gravado em evoluções/prescrições antigas)
  //  - por último, fallback recebido pelo caller
  const canonicalName =
    registryRow?.full_name ||
    patientRowName ||
    fallbackName ||
    "—";

  return {
    name: canonicalName,
    socialName: registryRow?.social_name || null,
    prontuario,
    atendimento,
    cpf: registryRow?.cpf || null,
    cns: registryRow?.cns || null,
    birthDate: registryRow?.birth_date || null,
    sex: registryRow?.sex || null,
    motherName: registryRow?.mother_name || null,
    address: composedAddress,
    phone: registryRow?.phone || null,
    isUnidentified: !!registryRow?.is_unidentified,
    unidentifiedCode: registryRow?.unidentified_code || null,
    registryId: registryRow?.id || null,
  };
}
