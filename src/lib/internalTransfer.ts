import { supabase } from "@/integrations/supabase/client";
import { repointPatientHistory } from "@/lib/repointPatientHistory";
import { classifyTransfer, requiresSaps, type TransferClassification } from "@/lib/sectorComplexity";
import { sectorLabelFromCode } from "@/lib/hospitalSectors";
import type { Patient } from "@/types/patient";

/**
 * Executa uma TRANSFERÊNCIA INTERNA entre dois leitos do mesmo hospital,
 * preservando histórico clínico, prontuário e número de atendimento.
 *
 * Princípios:
 *  - 1 internação = 1 nº de atendimento até o desfecho final
 *    (alta, transferência externa, óbito). NÃO cria novo encounter.
 *  - Histórico clínico (evoluções, prescrições, exames, culturas, condutas,
 *    medical_records, patient_encounters) é repointado via RPC atômica
 *    `repoint_patient_history`.
 *  - Origem fica 100% vazia após a transferência (sem resíduo).
 *  - Em escalada para setor crítico (UTI/UCI 2 vindo de não-crítico),
 *    o destino entra com `admission_status = 'saps_pendente'`, disparando
 *    o fluxo SAPS 3 já existente (timer pós-alocação).
 *
 * NÃO usar para:
 *  - Alta / óbito / transferência externa (são desfechos finais)
 *  - Pré-admissão (transferência interna não passa por pré-cadastro)
 */
export interface InternalTransferResult {
  ok: boolean;
  classification?: TransferClassification;
  needsSaps?: boolean;
  error?: string;
}

export async function executeInternalTransfer(params: {
  source: Patient;
  /** Patient row do leito DESTINO (vazio, com bedNumber/sector preenchidos) */
  targetBedRow: Patient;
  currentUserId?: string | null;
  hospitalUnitId: string;
  stateId: string;
  department?: string | null;
  reason?: string;
}): Promise<InternalTransferResult> {
  const { source, targetBedRow, currentUserId, hospitalUnitId, stateId, department, reason } = params;

  if (!source?.id || !targetBedRow?.id) {
    return { ok: false, error: "source/target ausente" };
  }
  if (source.id === targetBedRow.id) {
    return { ok: false, error: "source = target" };
  }

  const classification = classifyTransfer(source.sector, targetBedRow.sector);
  const needsSaps = requiresSaps(classification);

  try {
    // 1. Preenche o leito destino com os dados do paciente.
    const destinationAdmissionStatus = needsSaps
      ? "saps_pendente"
      : (source.admissionStatus ?? "admitido");

    const { error: targetError } = await supabase
      .from("patients")
      .update({
        name: source.name,
        age: source.age?.toString() || null,
        diagnoses: source.diagnoses?.join("\n") || null,
        medical_history: source.medicalHistory?.join("\n") || null,
        relevant_exams: source.relevantExams?.join("\n") || null,
        pendencies: source.pendencies?.join("\n") || null,
        schedule: source.schedule?.join("\n") || null,
        admission_history: source.admissionHistory || null,
        admission_date: source.admissionDate || null,
        highlighted_diagnoses: source.highlightedDiagnoses || null,
        highlighted_medical_history: source.highlightedMedicalHistory || null,
        highlighted_pendencies: source.highlightedPendencies || null,
        highlighted_conducts: source.highlightedConducts || null,
        uti_admission_date: source.utiAdmissionDate?.join("\n") || null,
        uti_discharge_prediction: source.utiDischargePrediction?.join("\n") || null,
        uti_allergies: source.utiAllergies?.join("\n") || null,
        uti_admission_reason: source.utiAdmissionReason?.join("\n") || null,
        uti_current_status: source.utiCurrentStatus?.join("\n") || null,
        uti_devices: source.utiDevices?.join("\n") || null,
        uti_cultures_antibiotics: source.utiCulturesAntibiotics?.join("\n") || null,
        uti_specialties: source.utiSpecialties?.join("\n") || null,
        uti_origin_sector: source.utiOriginSector?.join("\n") || null,
        uti_daily_conducts: source.utiDailyConducts?.join("\n") || null,
        clinical_status: source.clinicalStatus || null,
        psm_status: source.psmStatus || null,
        admission_status: destinationAdmissionStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetBedRow.id);
    if (targetError) throw targetError;

    // 2. Repointa o histórico clínico (RPC atômica auditada).
    const repoint = await repointPatientHistory(
      source.id,
      targetBedRow.id,
      reason ?? `Transferência interna: ${source.bedNumber} → ${targetBedRow.bedNumber}`,
    );
    if (!repoint.ok) {
      throw new Error(`Falha ao migrar histórico clínico (${repoint.error}). Operação abortada.`);
    }

    // 3. Esvazia o leito de origem (100% limpo, sem resíduo).
    const { error: sourceError } = await supabase
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
        clinical_status: null,
        psm_status: null,
        admission_status: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", source.id);
    if (sourceError) throw sourceError;

    // 4. Registra a movimentação na timeline.
    await supabase.from("patient_movements").insert({
      patient_id: targetBedRow.id,
      patient_name: source.name,
      patient_bed: source.bedNumber,
      patient_sector: source.sector,
      movement_type: "TRANSFERÊNCIA INTERNA",
      destination: `${targetBedRow.sector} - Leito ${targetBedRow.bedNumber}`,
      notes:
        `Transferência interna (${classification}) de ${source.bedNumber} (${source.sector}) ` +
        `para ${targetBedRow.bedNumber} (${targetBedRow.sector})` +
        (needsSaps ? " — escalada crítica: SAPS 3 pendente no destino." : ""),
      created_by: currentUserId ?? null,
      patient_snapshot: source as any,
      department: department ?? null,
      state_id: stateId,
      hospital_unit_id: hospitalUnitId,
    });

    return { ok: true, classification, needsSaps };
  } catch (err: any) {
    console.error("[executeInternalTransfer] erro", err);
    return { ok: false, classification, needsSaps, error: err?.message ?? "Erro desconhecido" };
  }
}
