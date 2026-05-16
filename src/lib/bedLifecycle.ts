/**
 * src/lib/bedLifecycle.ts
 *
 * Fonte única de movimentações de leito.
 *
 * Separa CLARAMENTE:
 *   - ATO MÉDICO (Painel Clínico) — `signalClinicalDecision` / `revokeClinicalDecision`
 *     Apenas sinaliza no `patients.admission_status` e registra em `patient_movements`.
 *     NÃO toca `bed_number` / `sector` / dados clínicos.
 *
 *   - ATO ADMINISTRATIVO (Mapa de Leitos) — `executeBedRelease` /
 *     `executeOperationalRelocation`
 *     Libera o leito físico (zera dados clínicos do slot, preservando o
 *     prontuário longitudinal) ou move o paciente entre leitos por motivo
 *     operacional (sem decisão clínica), sempre com `repointPatientHistory`.
 *
 * Todos os movimentos gravam `metadata.flow_version = 'v2_unified'` para
 * facilitar auditoria e migração futura.
 */
import { supabase } from "@/integrations/supabase/client";
import { repointPatientHistory } from "@/lib/repointPatientHistory";

export type ClinicalDecisionKind =
  | "alta_medica"
  | "transf_interna"
  | "transf_externa"
  | "obito"
  | "evasao";

const KIND_TO_STATUS: Record<ClinicalDecisionKind, string> = {
  alta_medica: "alta_dada",
  transf_interna: "transferencia_interna_pendente",
  transf_externa: "transferencia_externa_pendente",
  obito: "obito",
  evasao: "evasao",
};

const KIND_TO_MOVEMENT_TYPE: Record<ClinicalDecisionKind, string> = {
  alta_medica: "ALTA_HOSPITALAR",
  transf_interna: "TRANSFERENCIA_INTERNA",
  transf_externa: "TRANSFERENCIA_EXTERNA",
  obito: "OBITO",
  evasao: "EVASAO",
};

export interface SignalDecisionPayload {
  patientId: string;
  patientName: string;
  patientBed?: string | null;
  patientSector?: string | null;
  hospitalUnitId: string;
  stateId: string;
  department?: string | null;
  /** Destino administrativo (interno: setor/leito; externo: instituição) */
  destination?: string | null;
  targetSector?: string | null;
  targetBed?: string | null;
  responsibleDoctor?: string | null;
  notes?: string | null;
  nirRequested?: boolean;
  patientSnapshot?: any;
}

export interface LifecycleResult {
  ok: boolean;
  movementId?: string;
  error?: string;
}

/** Painel Clínico → marca decisão. NÃO libera leito. */
export async function signalClinicalDecision(
  kind: ClinicalDecisionKind,
  payload: SignalDecisionPayload,
): Promise<LifecycleResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const movement = await supabase
      .from("patient_movements")
      .insert({
        patient_id: payload.patientId,
        patient_name: payload.patientName,
        patient_bed: payload.patientBed ?? null,
        patient_sector: payload.patientSector ?? null,
        movement_type: KIND_TO_MOVEMENT_TYPE[kind],
        destination: payload.destination ?? null,
        notes: payload.notes ?? null,
        responsible_doctor: payload.responsibleDoctor ?? null,
        created_by: user?.id ?? null,
        patient_snapshot: payload.patientSnapshot ?? null,
        department: payload.department ?? null,
        state_id: payload.stateId,
        hospital_unit_id: payload.hospitalUnitId,
        metadata: {
          flow_version: "v2_unified",
          stage: "signal",
          kind,
          signaled_by: user?.id ?? null,
          target_sector: payload.targetSector ?? null,
          target_bed: payload.targetBed ?? null,
          nir_requested: !!payload.nirRequested,
        } as any,
      })
      .select("id")
      .single();
    if (movement.error) throw movement.error;

    const { error: statusErr } = await supabase
      .from("patients")
      .update({
        admission_status: KIND_TO_STATUS[kind],
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.patientId);
    if (statusErr) throw statusErr;

    return { ok: true, movementId: movement.data?.id };
  } catch (err: any) {
    console.error("[signalClinicalDecision] erro", err);
    return { ok: false, error: err?.message ?? "Erro desconhecido" };
  }
}

export interface RevokeDecisionPayload {
  patientId: string;
  patientName: string;
  patientBed?: string | null;
  patientSector?: string | null;
  hospitalUnitId: string;
  stateId: string;
  department?: string | null;
  reason: string;
}

/** Painel Clínico → desfaz sinalização (paciente piorou, decisão revogada). */
export async function revokeClinicalDecision(
  payload: RevokeDecisionPayload,
): Promise<LifecycleResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const movement = await supabase
      .from("patient_movements")
      .insert({
        patient_id: payload.patientId,
        patient_name: payload.patientName,
        patient_bed: payload.patientBed ?? null,
        patient_sector: payload.patientSector ?? null,
        movement_type: "REVOGACAO_DECISAO",
        destination: null,
        notes: payload.reason,
        responsible_doctor: null,
        created_by: user?.id ?? null,
        department: payload.department ?? null,
        state_id: payload.stateId,
        hospital_unit_id: payload.hospitalUnitId,
        metadata: {
          flow_version: "v2_unified",
          stage: "revoke",
          revoked_by: user?.id ?? null,
        } as any,
      })
      .select("id")
      .single();
    if (movement.error) throw movement.error;

    // Volta para admitido — leito ainda não foi liberado, paciente segue ativo.
    const { error: statusErr } = await supabase
      .from("patients")
      .update({
        admission_status: "admitido",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.patientId);
    if (statusErr) throw statusErr;

    return { ok: true, movementId: movement.data?.id };
  } catch (err: any) {
    console.error("[revokeClinicalDecision] erro", err);
    return { ok: false, error: err?.message ?? "Erro desconhecido" };
  }
}

export interface OperationalRelocationPayload {
  sourcePatientId: string;
  targetPatientId: string;
  reason: string;
  hospitalUnitId: string;
  stateId: string;
  department?: string | null;
}

/**
 * Mapa de Leitos → remanejamento operacional (reforma, manutenção,
 * isolamento, conforto). SEM decisão clínica, MAS preserva 100% do
 * histórico via `repointPatientHistory`.
 */
export async function executeOperationalRelocation(
  payload: OperationalRelocationPayload,
): Promise<LifecycleResult> {
  try {
    if (payload.sourcePatientId === payload.targetPatientId) {
      return { ok: false, error: "Leito de origem e destino são iguais." };
    }

    // 1) Buscar slot de origem (todos os campos clínicos)
    const { data: source, error: srcErr } = await supabase
      .from("patients")
      .select("*")
      .eq("id", payload.sourcePatientId)
      .maybeSingle();
    if (srcErr) throw srcErr;
    if (!source) throw new Error("Leito de origem não encontrado.");

    // 2) Copiar dados clínicos para slot destino
    const clinicalFields = {
      name: (source as any).name,
      age: (source as any).age ?? null,
      diagnoses: (source as any).diagnoses ?? null,
      medical_history: (source as any).medical_history ?? null,
      relevant_exams: (source as any).relevant_exams ?? null,
      pendencies: (source as any).pendencies ?? null,
      schedule: (source as any).schedule ?? null,
      admission_history: (source as any).admission_history ?? null,
      admission_date: (source as any).admission_date ?? null,
      highlighted_diagnoses: (source as any).highlighted_diagnoses ?? null,
      highlighted_medical_history: (source as any).highlighted_medical_history ?? null,
      highlighted_pendencies: (source as any).highlighted_pendencies ?? null,
      highlighted_conducts: (source as any).highlighted_conducts ?? null,
      medical_responsibility: (source as any).medical_responsibility ?? null,
      uti_admission_date: (source as any).uti_admission_date ?? null,
      uti_discharge_prediction: (source as any).uti_discharge_prediction ?? null,
      uti_allergies: (source as any).uti_allergies ?? null,
      uti_admission_reason: (source as any).uti_admission_reason ?? null,
      uti_current_status: (source as any).uti_current_status ?? null,
      uti_devices: (source as any).uti_devices ?? null,
      uti_cultures_antibiotics: (source as any).uti_cultures_antibiotics ?? null,
      uti_specialties: (source as any).uti_specialties ?? null,
      uti_origin_sector: (source as any).uti_origin_sector ?? null,
      uti_daily_conducts: (source as any).uti_daily_conducts ?? null,
      uti_weight_kg: (source as any).uti_weight_kg ?? null,
      internment_status: (source as any).internment_status ?? null,
      internment_notes: (source as any).internment_notes ?? null,
      clinical_status: (source as any).clinical_status ?? null,
      psm_status: (source as any).psm_status ?? null,
      patient_registry_id: (source as any).patient_registry_id ?? null,
      medical_record: (source as any).medical_record ?? null,
      admission_status: (source as any).admission_status ?? null,
      admitted_at: (source as any).admitted_at ?? null,
      is_vacant: false,
      updated_at: new Date().toISOString(),
    };

    const { error: tgtErr } = await supabase
      .from("patients")
      .update(clinicalFields)
      .eq("id", payload.targetPatientId);
    if (tgtErr) throw tgtErr;

    // 3) Repointar histórico (evoluções/prescrições/exames/etc.)
    const repoint = await repointPatientHistory(
      payload.sourcePatientId,
      payload.targetPatientId,
      `Remanejamento operacional: ${payload.reason}`,
    );
    if (!repoint.ok) {
      throw new Error(`Falha ao migrar histórico: ${repoint.error}`);
    }

    // 4) Zerar slot origem
    const { error: clearErr } = await supabase
      .from("patients")
      .update({
        name: "",
        age: null,
        diagnoses: null,
        medical_history: null,
        relevant_exams: null,
        pendencies: null,
        schedule: null,
        admission_history: null,
        admission_date: null,
        highlighted_diagnoses: null,
        highlighted_medical_history: null,
        highlighted_pendencies: null,
        highlighted_conducts: null,
        medical_responsibility: null,
        uti_admission_date: null,
        uti_discharge_prediction: null,
        uti_allergies: null,
        uti_admission_reason: null,
        uti_current_status: null,
        uti_devices: null,
        uti_cultures_antibiotics: null,
        uti_specialties: null,
        uti_origin_sector: null,
        uti_daily_conducts: null,
        uti_weight_kg: null,
        internment_status: null,
        internment_notes: null,
        clinical_status: null,
        psm_status: null,
        patient_registry_id: null,
        medical_record: null,
        admission_status: null,
        admitted_at: null,
        is_vacant: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.sourcePatientId);
    if (clearErr) throw clearErr;

    // 5) Auditoria
    const { data: { user } } = await supabase.auth.getUser();
    const { data: target } = await supabase
      .from("patients")
      .select("bed_number, sector")
      .eq("id", payload.targetPatientId)
      .maybeSingle();
    const movement = await supabase
      .from("patient_movements")
      .insert({
        patient_id: payload.targetPatientId,
        patient_name: (source as any).name,
        patient_bed: (source as any).bed_number,
        patient_sector: (source as any).sector,
        movement_type: "REMANEJAMENTO_OPERACIONAL",
        destination: target
          ? `${(target as any).sector} • Leito ${(target as any).bed_number}`
          : null,
        notes: payload.reason,
        created_by: user?.id ?? null,
        patient_snapshot: source as any,
        department: payload.department ?? null,
        state_id: payload.stateId,
        hospital_unit_id: payload.hospitalUnitId,
        metadata: {
          flow_version: "v2_unified",
          stage: "operational_relocation",
          source_bed: (source as any).bed_number,
          source_sector: (source as any).sector,
          target_bed: (target as any)?.bed_number ?? null,
          target_sector: (target as any)?.sector ?? null,
          executed_by: user?.id ?? null,
        } as any,
      })
      .select("id")
      .single();
    if (movement.error) throw movement.error;

    return { ok: true, movementId: movement.data?.id };
  } catch (err: any) {
    console.error("[executeOperationalRelocation] erro", err);
    return { ok: false, error: err?.message ?? "Erro desconhecido" };
  }
}
