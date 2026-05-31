import { supabase } from "@/integrations/supabase/client";
import { repointPatientHistory } from "@/lib/repointPatientHistory";
import { classifyTransfer, requiresSaps, requiresNewAdmission, type TransferClassification } from "@/lib/sectorComplexity";
import { sectorLabelFromCode } from "@/lib/hospitalSectors";
import { invalidateResolvedRegistry } from "@/hooks/useResolvedRegistryId";
import type { Patient } from "@/types/patient";

/**
 * Converte uma string solta (BR `DD/MM/AAAA[ HH:MM]`, ISO, ou já timestamp)
 * em ISO `YYYY-MM-DDTHH:mm:ss±HH:MM` aceito pelo Postgres em colunas
 * timestamptz. Retorna `null` se vazio ou não-parseável — evita o erro
 * `date/time field value out of range` ao alocar pacientes cujo snapshot
 * de origem trazia datas em formato brasileiro.
 */
function coerceToIsoTimestamp(value: unknown): string | null {
  if (value == null) return null;
  const raw = Array.isArray(value) ? value.join(" ").trim() : String(value).trim();
  if (!raw) return null;
  // ISO direto (com ou sem hora) — devolve como está
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw;
  // BR: DD/MM/AAAA [HH:MM]
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2}))?/);
  if (br) {
    const [, dd, mm, yyyy, hh = "00", mi = "00"] = br;
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}:00+00:00`;
  }
  // Fallback: tenta Date.parse
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

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
 *
 *  REGRAS DE ADMISSÃO POR NÍVEL DE COMPLEXIDADE:
 *  ┌─────────────────────────────────────────────────────────────┐
 *  │ Mesma complexidade  → SEM nova admissão, encounter mantido  │
 *  │ Desescalada         → SEM nova admissão, encounter mantido  │
 *  │ Escalada → Nível 3  → COM nova admissão (UCI 1), sem SAPS   │
 *  │ Escalada → Nível 1-2→ COM nova admissão + SAPS obrigatório  │
 *  └─────────────────────────────────────────────────────────────┘
 *  Em ESCALADA: o encounter anterior é FECHADO (ended_at = now()),
 *  a admission_history é preservada no snapshot e no patient_movements,
 *  e o destino recebe admission_status adequado ao nível de complexidade.
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
  const needsNewAdmission = requiresNewAdmission(classification);

  try {
    // 0. Busca identidade permanente (registry/prontuário/admissão) do leito origem
    //    para garantir que documentação clínica acompanhe o paciente no destino.
    const { data: sourceDbRow } = await supabase
      .from("patients")
      .select("patient_registry_id, medical_record, admitted_at, admission_history")
      .eq("id", source.id)
      .maybeSingle();

    const sourceRegistryId = (sourceDbRow as any)?.patient_registry_id ?? null;
    const sourceMedicalRecord = (sourceDbRow as any)?.medical_record ?? null;
    const sourceAdmittedAt = (sourceDbRow as any)?.admitted_at ?? null;
    const sourceAdmissionHistory = (sourceDbRow as any)?.admission_history ?? null;

    // 🔒 Em ESCALADA: fechar o encounter ativo do setor de origem antes de abrir
    // o novo no destino. Isso preserva a timeline correta (início e fim por setor)
    // e garante que evoluções antigas continuem vinculadas ao encounter correto.
    if (needsNewAdmission && sourceRegistryId) {
      await supabase
        .from("patient_encounters")
        .update({ status: "closed", ended_at: new Date().toISOString() })
        .eq("registry_id", sourceRegistryId)
        .neq("status", "closed");
    } else if (needsNewAdmission && source.id) {
      await supabase
        .from("patient_encounters")
        .update({ status: "closed", ended_at: new Date().toISOString() })
        .eq("patient_id", source.id)
        .neq("status", "closed");
    }

    // 1. Preenche o leito destino com os dados do paciente.
    // Em escalada: nova admissão → admission_history é resetada para o novo setor.
    // Em lateral/desescalada: mantém admission_history original (continuidade).
    const destinationAdmissionStatus = needsSaps
      ? "saps_pendente"
      : needsNewAdmission
      ? "pre_admitido"
      : (source.admissionStatus ?? "admitido");

    // Em escalada, a admission_history do setor anterior vai para o snapshot/histórico
    // mas o destino começa limpo para a nova admissão clínica.
    const destinationAdmissionHistory = needsNewAdmission
      ? null  // nova admissão: médico preenche no destino
      : sourceAdmissionHistory; // continuidade: preserva história

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
        admission_date: coerceToIsoTimestamp(source.admissionDate),
        highlighted_diagnoses: source.highlightedDiagnoses || null,
        highlighted_medical_history: source.highlightedMedicalHistory || null,
        highlighted_pendencies: source.highlightedPendencies || null,
        highlighted_conducts: source.highlightedConducts || null,
        uti_admission_date: coerceToIsoTimestamp(source.utiAdmissionDate),
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
        admission_history: destinationAdmissionHistory,
        admission_status: destinationAdmissionStatus,
        // Em escalada: admitted_at é null até concluir a admissão clínica no destino
        admitted_at: needsNewAdmission ? null : sourceAdmittedAt,
        patient_registry_id: sourceRegistryId,
        medical_record: sourceMedicalRecord,
        is_vacant: false,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", targetBedRow.id);
    if (targetError) throw targetError;

    // 2. Repointa o histórico clínico (RPC atômica auditada).
    // Em ESCALADA: o repoint preserva todas as evoluções/prescrições anteriores
    // vinculadas ao encounter fechado — ficam visíveis no histórico do paciente.
    const repoint = await repointPatientHistory(
      source.id,
      targetBedRow.id,
      reason ?? `Transferência interna: ${source.bedNumber} → ${targetBedRow.bedNumber}`,
    );
    if (!repoint.ok) {
      throw new Error(`Falha ao migrar histórico clínico (${repoint.error}). Operação abortada.`);
    }

    // Sincroniza admission_histories: garante que a admissão ativa segue o paciente
    // após transferência interna. Não arquiva — apenas aponta para o novo patient_id.
    try {
      await supabase
        .from("admission_histories")
        .update({ patient_id: targetBedRow.id, updated_at: new Date().toISOString() })
        .eq("patient_id", source.id)
        .is("archived_at", null);
    } catch (e) {
      console.warn("[internalTransfer] sync admission_histories:", e);
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
        patient_registry_id: null,
        medical_record: null,
        admitted_at: null,
        is_vacant: true,
        updated_at: new Date().toISOString(),
      } as any)
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

    invalidateResolvedRegistry(source.id);
    invalidateResolvedRegistry(targetBedRow.id);

    return { ok: true, classification, needsSaps };
  } catch (err: any) {
    console.error("[executeInternalTransfer] erro", err);
    return { ok: false, classification, needsSaps, error: err?.message ?? "Erro desconhecido" };
  }
}

// =====================================================================
// FLUXO DE 2 ETAPAS — Transferência Interna sinalizada (fila virtual)
// =====================================================================
// Etapa 1 (origem)  → signalInternalTransfer:
//   - cria registro em internal_transfer_requests (fila virtual do destino)
//   - esvazia leito de origem (libera no mapa)
//   - mantém o mesmo nº de atendimento (encounter) referente ao source_patient_id
// Etapa 2 (destino) → completeInternalTransfer:
//   - escolhe leito específico do destino
//   - popula bed row + repointPatientHistory(source → target)
//   - escalada crítica → admission_status='saps_pendente' (timer SAPS)
//   - desescalada / lateral → alocação direta sem nova admissão

export interface SignalInternalTransferParams {
  source: Patient;
  targetSectorCode: string;
  reason?: string;
  currentUserId?: string | null;
  hospitalUnitId: string;
  stateId: string;
  department?: string | null;
}

export interface SignalInternalTransferResult {
  ok: boolean;
  requestId?: string;
  classification?: TransferClassification;
  needsSaps?: boolean;
  error?: string;
}

export async function signalInternalTransfer(
  params: SignalInternalTransferParams,
): Promise<SignalInternalTransferResult> {
  const { source, targetSectorCode, reason, currentUserId, hospitalUnitId, stateId, department } = params;
  if (!source?.id) return { ok: false, error: "source ausente" };
  if (!targetSectorCode) return { ok: false, error: "setor destino ausente" };

  const classification = classifyTransfer(source.sector, targetSectorCode);
  const needsSaps = requiresSaps(classification);

  try {
    let encounterCode: string | null = null;
    try {
      const { data: enc } = await (supabase as any)
        .from("patient_encounters")
        .select("encounter_code")
        .eq("patient_id", source.id)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      encounterCode = enc?.encounter_code ?? null;
    } catch { /* não-bloqueante */ }

    // Busca identidade permanente ANTES de zerar o leito origem,
    // para que a Etapa 2 (completeInternalTransfer) possa restaurá-la
    // no leito destino mesmo após o clear feito aqui.
    const { data: sourceDbRowSignal } = await supabase
      .from("patients")
      .select("patient_registry_id, medical_record, admitted_at")
      .eq("id", source.id)
      .maybeSingle();

    const sourceRegistryIdSignal = (sourceDbRowSignal as any)?.patient_registry_id ?? null;
    const sourceMedicalRecordSignal = (sourceDbRowSignal as any)?.medical_record ?? null;
    const sourceAdmittedAtSignal = (sourceDbRowSignal as any)?.admitted_at ?? null;

    const snapshot = {
      ...source,
      _registryId: sourceRegistryIdSignal,
      _medicalRecord: sourceMedicalRecordSignal,
      _admittedAt: sourceAdmittedAtSignal,
      // Preserva admission_history do setor de origem para o histórico
      // (visível em HistoricoPacientePage e no painel do paciente)
      _admissionHistory: (source as any).admissionHistory ?? null,
    };
    const { data: inserted, error: insertError } = await (supabase as any)
      .from("internal_transfer_requests")
      .insert({
        source_patient_id: source.id,
        source_bed: source.bedNumber,
        source_sector: source.sector,
        patient_name: source.name,
        patient_snapshot: snapshot,
        encounter_code: encounterCode,
        target_sector_code: targetSectorCode,
        target_sector_label: sectorLabelFromCode(targetSectorCode),
        classification,
        requires_saps: needsSaps,
        reason: reason ?? null,
        status: "pending",
        signaled_by: currentUserId ?? null,
        hospital_unit_id: hospitalUnitId,
        state_id: stateId,
        department: department ?? null,
      })
      .select("id")
      .single();
    if (insertError) throw insertError;

    // 🔒 Em ESCALADA: fechar encounter ativo na Etapa 1 (sinalização).
    // O encounter do setor de origem é fechado aqui para que a timeline
    // registre o início e fim corretos por setor. O encounter do destino
    // será criado quando o médico concluir a admissão clínica no novo leito.
    const needsNewAdmissionSignal = requiresNewAdmission(classification);
    if (needsNewAdmissionSignal) {
      if (sourceRegistryIdSignal) {
        await supabase
          .from("patient_encounters")
          .update({ status: "closed", ended_at: new Date().toISOString() })
          .eq("registry_id", sourceRegistryIdSignal)
          .neq("status", "closed");
      }
      await supabase
        .from("patient_encounters")
        .update({ status: "closed", ended_at: new Date().toISOString() })
        .eq("patient_id", source.id)
        .neq("status", "closed");
    }

    const { error: clearError } = await supabase
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
        patient_registry_id: null,
        medical_record: null,
        is_vacant: true,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", source.id);
    if (clearError) throw clearError;

    // 🔒 Invalida o cache de registry do leito origem imediatamente após o clear,
    // evitando que o TTL de 30s propague dados do paciente anterior para um
    // próximo ocupante do mesmo leito enquanto o cache estiver quente.
    invalidateResolvedRegistry(source.id);

    await supabase.from("patient_movements").insert({
      patient_id: source.id,
      patient_name: source.name,
      patient_bed: source.bedNumber,
      patient_sector: source.sector,
      movement_type: "TRANSFERÊNCIA INTERNA — SINALIZADA",
      destination: sectorLabelFromCode(targetSectorCode),
      notes:
        `Etapa 1/2 — Sinalização para ${sectorLabelFromCode(targetSectorCode)} (${classification})` +
        (needsSaps ? " — escalada crítica: exigirá SAPS 3 após alocação" : "") +
        (reason ? ` | Motivo: ${reason}` : ""),
      created_by: currentUserId ?? null,
      patient_snapshot: snapshot as any,
      department: department ?? null,
      state_id: stateId,
      hospital_unit_id: hospitalUnitId,
    });

    return { ok: true, requestId: inserted?.id, classification, needsSaps };
  } catch (err: any) {
    console.error("[signalInternalTransfer] erro", err);
    return { ok: false, classification, needsSaps, error: err?.message ?? "Erro desconhecido" };
  }
}

export interface CompleteInternalTransferParams {
  requestId: string;
  targetBedRow: Patient;
  currentUserId?: string | null;
  hospitalUnitId: string;
  stateId: string;
  department?: string | null;
}

export async function completeInternalTransfer(
  params: CompleteInternalTransferParams,
): Promise<{ ok: boolean; classification?: TransferClassification; needsSaps?: boolean; error?: string }> {
  const { requestId, targetBedRow, currentUserId, hospitalUnitId, stateId, department } = params;
  if (!requestId) return { ok: false, error: "request ausente" };
  if (!targetBedRow?.id) return { ok: false, error: "leito destino ausente" };

  try {
    const { data: req, error: reqError } = await (supabase as any)
      .from("internal_transfer_requests")
      .select("*")
      .eq("id", requestId)
      .single();
    if (reqError) throw reqError;
    if (req.status !== "pending") {
      return { ok: false, error: `Request já está ${req.status}` };
    }

    const snapshot = req.patient_snapshot as Patient;
    const classification = req.classification as TransferClassification;
    const needsSaps: boolean = req.requires_saps;
    const needsNewAdmission = requiresNewAdmission(classification);
    const sourcePatientId: string = req.source_patient_id;

    // Identidade permanente (registry/prontuário/admissão) lida do snapshot
    // salvo na Etapa 1, pois o leito origem já foi zerado em signalInternalTransfer.
    // Fallback: tenta colunas dedicadas em internal_transfer_requests se existirem.
    const sourceRegistryId =
      (req as any).source_registry_id ??
      (snapshot as any)._registryId ??
      null;

    const sourceMedicalRecord =
      (req as any).source_medical_record ??
      (snapshot as any)._medicalRecord ??
      null;

    const sourceAdmittedAt =
      (req as any).source_admitted_at ??
      (snapshot as any)._admittedAt ??
      null;

    const sourceAdmissionHistory =
      (snapshot as any)._admissionHistory ??
      null;

    // 🔒 Em ESCALADA: o encounter do setor de origem já foi fechado na Etapa 1
    // (signalInternalTransfer). Aqui garantimos que não haja encounter aberto
    // residual vinculado ao sourcePatientId antes de criar o do destino.
    if (needsNewAdmission && sourcePatientId) {
      await supabase
        .from("patient_encounters")
        .update({ status: "closed", ended_at: new Date().toISOString() })
        .eq("patient_id", sourcePatientId)
        .neq("status", "closed");
      if (sourceRegistryId) {
        await supabase
          .from("patient_encounters")
          .update({ status: "closed", ended_at: new Date().toISOString() })
          .eq("registry_id", sourceRegistryId)
          .neq("status", "closed");
      }
    }

    const destinationAdmissionStatus = needsSaps
      ? "saps_pendente"
      : needsNewAdmission
      ? "pre_admitido"
      : (snapshot.admissionStatus ?? "admitido");

    // Em escalada: destino começa sem admission_history (nova admissão clínica)
    const destinationAdmissionHistory = needsNewAdmission ? null : sourceAdmissionHistory;

    const { error: targetError } = await supabase
      .from("patients")
      .update({
        name: snapshot.name,
        age: snapshot.age?.toString() || null,
        diagnoses: snapshot.diagnoses?.join("\n") || null,
        medical_history: snapshot.medicalHistory?.join("\n") || null,
        relevant_exams: snapshot.relevantExams?.join("\n") || null,
        pendencies: snapshot.pendencies?.join("\n") || null,
        schedule: snapshot.schedule?.join("\n") || null,
        
        admission_date: coerceToIsoTimestamp(snapshot.admissionDate),
        highlighted_diagnoses: snapshot.highlightedDiagnoses || null,
        highlighted_medical_history: snapshot.highlightedMedicalHistory || null,
        highlighted_pendencies: snapshot.highlightedPendencies || null,
        highlighted_conducts: snapshot.highlightedConducts || null,
        uti_admission_date: coerceToIsoTimestamp(snapshot.utiAdmissionDate),
        uti_discharge_prediction: snapshot.utiDischargePrediction?.join("\n") || null,
        uti_allergies: snapshot.utiAllergies?.join("\n") || null,
        uti_admission_reason: snapshot.utiAdmissionReason?.join("\n") || null,
        uti_current_status: snapshot.utiCurrentStatus?.join("\n") || null,
        uti_devices: snapshot.utiDevices?.join("\n") || null,
        uti_cultures_antibiotics: snapshot.utiCulturesAntibiotics?.join("\n") || null,
        uti_specialties: snapshot.utiSpecialties?.join("\n") || null,
        uti_origin_sector: snapshot.utiOriginSector?.join("\n") || null,
        uti_daily_conducts: snapshot.utiDailyConducts?.join("\n") || null,
        clinical_status: snapshot.clinicalStatus || null,
        psm_status: snapshot.psmStatus || null,
        admission_history: destinationAdmissionHistory,
        admission_status: destinationAdmissionStatus,
        admitted_at: needsNewAdmission ? null : sourceAdmittedAt,
        patient_registry_id: sourceRegistryId,
        medical_record: sourceMedicalRecord,
        is_vacant: false,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", targetBedRow.id);
    if (targetError) throw targetError;

    const repoint = await repointPatientHistory(
      sourcePatientId,
      targetBedRow.id,
      `Transferência interna (etapa 2) → ${targetBedRow.bedNumber} (${sectorLabelFromCode(targetBedRow.sector)})`,
    );
    if (!repoint.ok) {
      throw new Error(`Falha ao migrar histórico (${repoint.error}).`);
    }

    // Sincroniza admission_histories após repoint (Etapa 2)
    try {
      await supabase
        .from("admission_histories")
        .update({ patient_id: targetBedRow.id, updated_at: new Date().toISOString() })
        .eq("patient_id", sourcePatientId)
        .is("archived_at", null);
    } catch (e) {
      console.warn("[internalTransfer] sync admission_histories (complete):", e);
    }

    await (supabase as any)
      .from("internal_transfer_requests")
      .update({
        status: "completed",
        completed_by: currentUserId ?? null,
        completed_at: new Date().toISOString(),
        completed_target_patient_id: targetBedRow.id,
      })
      .eq("id", requestId);

    await supabase.from("patient_movements").insert({
      patient_id: targetBedRow.id,
      patient_name: snapshot.name,
      patient_bed: req.source_bed,
      patient_sector: req.source_sector,
      movement_type: "TRANSFERÊNCIA INTERNA — CONCLUÍDA",
      destination: `${sectorLabelFromCode(targetBedRow.sector)} - Leito ${targetBedRow.bedNumber}`,
      notes:
        `Etapa 2/2 — Alocação concluída (${classification})` +
        (needsSaps ? " — SAPS 3 pendente no destino." : ""),
      created_by: currentUserId ?? null,
      patient_snapshot: snapshot as any,
      department: department ?? null,
      state_id: stateId,
      hospital_unit_id: hospitalUnitId,
    });

    // 🔒 Invalida o cache TANTO do leito destino (que recebeu o paciente)
    // QUANTO do leito origem (que foi zerado na Etapa 1) — garante que
    // um próximo ocupante do leito de origem não herde o registry antigo.
    invalidateResolvedRegistry(targetBedRow.id);
    invalidateResolvedRegistry(sourcePatientId);

    return { ok: true, classification, needsSaps };
  } catch (err: any) {
    console.error("[completeInternalTransfer] erro", err);
    return { ok: false, error: err?.message ?? "Erro desconhecido" };
  }
}

export async function cancelInternalTransferRequest(
  requestId: string,
  reason: string,
  currentUserId?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await (supabase as any)
      .from("internal_transfer_requests")
      .update({
        status: "cancelled",
        cancelled_by: currentUserId ?? null,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
      })
      .eq("id", requestId)
      .eq("status", "pending");
    if (error) throw error;
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Erro" };
  }
}

