import { supabase } from "@/integrations/supabase/client";
import { repointPatientHistory } from "@/lib/repointPatientHistory";
import { classifyTransfer, requiresSaps, requiresNewAdmission, type TransferClassification } from "@/lib/sectorComplexity";
import { sectorLabelFromCode } from "@/lib/hospitalSectors";
import { invalidateResolvedRegistry } from "@/hooks/useResolvedRegistryId";
import type { Patient } from "@/types/patient";

// Detecta erros de RPC não encontrada (função ainda não deployada no banco).
// Código 42883 = undefined_function no PostgreSQL.
// Fallback automático para fluxo sequencial quando a migration não foi aplicada.
const isRpcMissing = (err: any): boolean =>
  (err as any)?.code === "42883" || (err?.message ?? "").includes("does not exist");

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
 *  ┌──────────────────────────────────────────────────────────────────┐
 *  │ Mesma complexidade  → SEM nova admissão, encounter mantido       │
 *  │ Desescalada         → SEM nova admissão, encounter mantido       │
 *  │ Escalada → Nível 3  → COM nova admissão (UCI 1), sem SAPS        │
 *  │ Escalada → Nível 1-2→ COM nova admissão + SAPS obrigatório       │
 *  └──────────────────────────────────────────────────────────────────┘
 *  Em QUALQUER transferência interna: o encounter permanece ABERTO.
 *  Regra de negócio: 1 internação = 1 número de atendimento até o
 *  desfecho final (alta, óbito ou transferência externa).
 *  A admission_history é preservada no snapshot e no patient_movements,
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
    // Executa os 4 passos da transferência dentro de uma única transação PostgreSQL:
    //   1. Popula leito destino com dados do paciente
    //   2. Repointa histórico clínico (repoint_patient_history v4)
    //   3. Esvazia leito de origem
    //   4. Registra auditoria em patient_movements
    //
    // Qualquer falha em qualquer passo causa ROLLBACK automático de tudo —
    // o banco nunca fica em estado inconsistente.
    const { data, error } = await (supabase as any).rpc("execute_internal_transfer_atomic", {
      p_source_patient_id:   source.id,
      p_target_patient_id:   targetBedRow.id,
      p_needs_saps:          needsSaps,
      p_needs_new_admission: needsNewAdmission,
      p_reason:              reason ?? `Transferência interna: ${source.bedNumber} → ${targetBedRow.bedNumber}`,
      p_created_by:          currentUserId ?? null,
      p_hospital_unit_id:    hospitalUnitId,
      p_state_id:            stateId,
      p_department:          department ?? null,
      p_classification:      classification,
    });

    if (error) throw error;
    if (!data?.success) throw new Error("Transferência não confirmada pelo banco de dados");

    invalidateResolvedRegistry(source.id);
    invalidateResolvedRegistry(targetBedRow.id);

    return { ok: true, classification, needsSaps };
  } catch (err: any) {
    console.error("[executeInternalTransfer] erro:", err);
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

  // ── Prepara dados para o RPC atômico ──────────────────────────────
  // Etapa 1: INSERT transfer_request + UPDATE patients (zera origem) — atômicos.
  // Fallback automático para o fluxo sequencial se o RPC não existir (42883).
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
    } catch (e) {
      console.warn("[signalInternalTransfer] falha ao buscar encounter_code (não-bloqueante):", e);
    }

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
    // Idempotência: verifica se já existe um request pendente para este paciente.
    // Cenário: sinalização anterior criou o request mas falhou ao zerar o leito.
    // O usuário tenta de novo — sem esta guarda, seria criado um segundo request.
    const { data: existingRequest } = await (supabase as any)
      .from("internal_transfer_requests")
      .select("id")
      .eq("source_patient_id", source.id)
      .eq("status", "pending")
      .maybeSingle();

    if (existingRequest?.id) {
      // Reutiliza o request existente — não cria duplicata.
      // O leito de origem pode já estar zerado (retry após falha parcial)
      // ou ainda ocupado (retry antes da zeragem). Em ambos os casos,
      // continua com o mesmo request para manter consistência.
      console.warn("[signalInternalTransfer] request pendente já existe para este paciente — reutilizando:", existingRequest.id);
      // Pula o INSERT e continua direto para zerar o leito (se ainda ocupado)
      // O código de zeragem abaixo é idempotente (zerar leito vazio não causa erro)
      const insertedId = existingRequest.id;

      // Regra de negócio: encounter não encerra em transferência interna.
      const { error: clearError } = await supabase
        .from("patients")
        .update({
          name: "", age: null, diagnoses: null, medical_history: null,
          relevant_exams: null, pendencies: null, schedule: null,
          admission_history: null, admission_date: null,
          highlighted_diagnoses: null, highlighted_medical_history: null,
          highlighted_pendencies: null, highlighted_conducts: null,
          uti_admission_date: null, uti_discharge_prediction: null,
          uti_allergies: null, uti_admission_reason: null,
          uti_current_status: null, uti_devices: null,
          uti_cultures_antibiotics: null, uti_specialties: null,
          uti_origin_sector: null, uti_daily_conducts: null,
          clinical_status: null, psm_status: null,
          admission_status: null, patient_registry_id: null,
          medical_record: null, is_vacant: true,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", source.id);
      if (clearError) throw clearError;

      invalidateResolvedRegistry(source.id);
      return { ok: true, requestId: insertedId, classification, needsSaps };
    }

    // Tenta RPC atômica: INSERT request + UPDATE patients (zero source) em uma transação.
    // Fallback automático se migration ainda não foi aplicada (erro 42883).
    const { data: atomicData, error: atomicErr } = await (supabase as any).rpc(
      "signal_internal_transfer_atomic",
      {
        p_source_patient_id:   source.id,
        p_snapshot:            snapshot,
        p_encounter_code:      encounterCode,
        p_target_sector_code:  targetSectorCode,
        p_target_sector_label: sectorLabelFromCode(targetSectorCode),
        p_classification:      classification,
        p_requires_saps:       needsSaps,
        p_reason:              reason ?? null,
        p_signaled_by:         currentUserId ?? null,
        p_hospital_unit_id:    hospitalUnitId,
        p_state_id:            stateId,
        p_department:          department ?? null,
      },
    );

    if (!atomicErr) {
      invalidateResolvedRegistry(source.id);
      return { ok: true, requestId: atomicData?.request_id, classification, needsSaps };
    }

    if (!isRpcMissing(atomicErr)) throw atomicErr;
    console.warn("[signalInternalTransfer] RPC atômica não encontrada — usando fluxo sequencial");

    // Fallback: INSERT + UPDATE sequenciais (migration ainda não aplicada)
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

    const { error: clearError } = await supabase
      .from("patients")
      .update({
        name: "", age: null, diagnoses: null, medical_history: null,
        relevant_exams: null, pendencies: null, schedule: null,
        admission_history: null, admission_date: null,
        highlighted_diagnoses: null, highlighted_medical_history: null,
        highlighted_pendencies: null, highlighted_conducts: null,
        uti_admission_date: null, uti_discharge_prediction: null,
        uti_allergies: null, uti_admission_reason: null,
        uti_current_status: null, uti_devices: null,
        uti_cultures_antibiotics: null, uti_specialties: null,
        uti_origin_sector: null, uti_daily_conducts: null,
        clinical_status: null, psm_status: null,
        admission_status: null, patient_registry_id: null,
        medical_record: null, is_vacant: true,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", source.id);
    if (clearError) throw clearError;

    invalidateResolvedRegistry(source.id);

    try {
      const { error: movErr } = await supabase.from("patient_movements").insert({
        patient_id: source.id, patient_name: source.name,
        patient_bed: source.bedNumber, patient_sector: source.sector,
        movement_type: "TRANSFERÊNCIA INTERNA — SINALIZADA",
        destination: sectorLabelFromCode(targetSectorCode),
        notes: `Etapa 1/2 — Sinalização para ${sectorLabelFromCode(targetSectorCode)} (${classification})` +
          (needsSaps ? " — escalada crítica: exigirá SAPS 3 após alocação" : "") +
          (reason ? ` | Motivo: ${reason}` : ""),
        created_by: currentUserId ?? null, patient_snapshot: snapshot as any,
        department: department ?? null, state_id: stateId, hospital_unit_id: hospitalUnitId,
      });
      if (movErr) console.error("[signalInternalTransfer] falha ao registrar patient_movements:", movErr);
    } catch (e) {
      console.error("[signalInternalTransfer] falha ao registrar patient_movements:", e);
    }

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

    // Regra de negócio: encounter não encerra em transferência interna.
    // O número de atendimento é preservado até alta, óbito ou transferência externa.

    const destinationAdmissionStatus = needsSaps
      ? "saps_pendente"
      : needsNewAdmission
      ? "pre_admitido"
      : (snapshot.admissionStatus ?? "admitido");

    const destinationAdmissionHistory = needsNewAdmission ? null : sourceAdmissionHistory;

    // Monta o JSONB com os campos pré-processados pelo TypeScript (arrays → texto, datas → ISO).
    // O SQL recebe tudo pronto e apenas executa as operações de banco atomicamente.
    const destinationFields = {
      name:                     snapshot.name,
      age:                      snapshot.age?.toString() || null,
      diagnoses:                snapshot.diagnoses?.join("\n") || null,
      medical_history:          snapshot.medicalHistory?.join("\n") || null,
      relevant_exams:           snapshot.relevantExams?.join("\n") || null,
      pendencies:               snapshot.pendencies?.join("\n") || null,
      schedule:                 snapshot.schedule?.join("\n") || null,
      admission_date:           coerceToIsoTimestamp(snapshot.admissionDate),
      highlighted_diagnoses:    toIntArray(snapshot.highlightedDiagnoses),
      highlighted_medical_history: toIntArray(snapshot.highlightedMedicalHistory),
      highlighted_pendencies:   toIntArray(snapshot.highlightedPendencies),
      highlighted_conducts:     toIntArray(snapshot.highlightedConducts),
      uti_admission_date:       coerceToIsoTimestamp(snapshot.utiAdmissionDate),
      uti_discharge_prediction: snapshot.utiDischargePrediction?.join("\n") || null,
      uti_allergies:            snapshot.utiAllergies?.join("\n") || null,
      uti_admission_reason:     snapshot.utiAdmissionReason?.join("\n") || null,
      uti_current_status:       snapshot.utiCurrentStatus?.join("\n") || null,
      uti_devices:              snapshot.utiDevices?.join("\n") || null,
      uti_cultures_antibiotics: snapshot.utiCulturesAntibiotics?.join("\n") || null,
      uti_specialties:          snapshot.utiSpecialties?.join("\n") || null,
      uti_origin_sector:        snapshot.utiOriginSector?.join("\n") || null,
      uti_daily_conducts:       snapshot.utiDailyConducts?.join("\n") || null,
      clinical_status:          snapshot.clinicalStatus || null,
      psm_status:               snapshot.psmStatus || null,
      admission_history:        destinationAdmissionHistory,
      admission_status:         destinationAdmissionStatus,
      admitted_at:              needsNewAdmission ? null : sourceAdmittedAt,
      patient_registry_id:      sourceRegistryId,
      medical_record:           sourceMedicalRecord,
    };

    // Tenta RPC atômica: UPDATE dest + repoint + UPDATE request status — em uma transação.
    // Fallback automático se migration ainda não foi aplicada (erro 42883).
    const { data: atomicData, error: atomicErr } = await (supabase as any).rpc(
      "complete_internal_transfer_atomic",
      {
        p_request_id:        requestId,
        p_target_patient_id: targetBedRow.id,
        p_destination:       destinationFields,
        p_repoint_reason:    `Transferência interna (etapa 2) → ${targetBedRow.bedNumber} (${sectorLabelFromCode(targetBedRow.sector)})`,
        p_current_user_id:   currentUserId ?? null,
        p_hospital_unit_id:  hospitalUnitId,
        p_state_id:          stateId,
        p_department:        department ?? null,
      },
    );

    if (!atomicErr) {
      invalidateResolvedRegistry(targetBedRow.id);
      invalidateResolvedRegistry(sourcePatientId);
      return { ok: true, classification, needsSaps };
    }

    if (!isRpcMissing(atomicErr)) throw atomicErr;
    console.warn("[completeInternalTransfer] RPC atômica não encontrada — usando fluxo sequencial");

    // Fallback: operações sequenciais (migration ainda não aplicada)
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
      throw new Error(repoint.error ?? "Falha ao migrar histórico clínico. Operação abortada.");
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

    // Falha aqui → throw: o repoint já aconteceu mas o status ficaria "pending",
    // permitindo dupla-conclusão em uma nova tentativa. Melhor expor o erro ao
    // chamador para que ele saiba que a operação não foi confirmada no banco.
    const { error: statusError } = await (supabase as any)
      .from("internal_transfer_requests")
      .update({
        status: "completed",
        completed_by: currentUserId ?? null,
        completed_at: new Date().toISOString(),
        completed_target_patient_id: targetBedRow.id,
      })
      .eq("id", requestId);
    if (statusError) throw statusError;

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
): Promise<{ ok: boolean; restoredSourceBed?: boolean; error?: string }> {
  try {
    // 1. Busca a solicitação pendente para obter snapshot e leito de origem.
    const { data: req, error: reqErr } = await (supabase as any)
      .from("internal_transfer_requests")
      .select("id, source_patient_id, patient_snapshot, status")
      .eq("id", requestId)
      .eq("status", "pending")
      .maybeSingle();
    if (reqErr) throw reqErr;
    if (!req) return { ok: false, error: "Solicitação não encontrada ou já processada" };

    const sourcePatientId: string = req.source_patient_id;
    const snapshot = (req.patient_snapshot ?? {}) as any;

    // 2. Verifica se o leito de origem ainda está vago antes de restaurar.
    // Se outro paciente já foi admitido no leito (is_vacant = false), não sobrescrevemos.
    let restoredSourceBed = false;
    const { data: sourceBed } = await supabase
      .from("patients")
      .select("is_vacant")
      .eq("id", sourcePatientId)
      .maybeSingle();

    if (sourceBed?.is_vacant === true) {
      const { error: restoreErr } = await supabase
        .from("patients")
        .update({
          name:                     snapshot.name ?? "",
          age:                      snapshot.age?.toString() || null,
          diagnoses:                Array.isArray(snapshot.diagnoses)
                                      ? snapshot.diagnoses.join("\n")
                                      : snapshot.diagnoses || null,
          medical_history:          Array.isArray(snapshot.medicalHistory)
                                      ? snapshot.medicalHistory.join("\n")
                                      : snapshot.medicalHistory || null,
          relevant_exams:           Array.isArray(snapshot.relevantExams)
                                      ? snapshot.relevantExams.join("\n")
                                      : snapshot.relevantExams || null,
          pendencies:               Array.isArray(snapshot.pendencies)
                                      ? snapshot.pendencies.join("\n")
                                      : snapshot.pendencies || null,
          schedule:                 Array.isArray(snapshot.schedule)
                                      ? snapshot.schedule.join("\n")
                                      : snapshot.schedule || null,
          admission_date:           coerceToIsoTimestamp(snapshot.admissionDate),
          highlighted_diagnoses:    snapshot.highlightedDiagnoses || null,
          highlighted_medical_history: snapshot.highlightedMedicalHistory || null,
          highlighted_pendencies:   snapshot.highlightedPendencies || null,
          highlighted_conducts:     snapshot.highlightedConducts || null,
          uti_admission_date:       coerceToIsoTimestamp(snapshot.utiAdmissionDate),
          uti_discharge_prediction: Array.isArray(snapshot.utiDischargePrediction)
                                      ? snapshot.utiDischargePrediction.join("\n")
                                      : snapshot.utiDischargePrediction || null,
          uti_allergies:            Array.isArray(snapshot.utiAllergies)
                                      ? snapshot.utiAllergies.join("\n")
                                      : snapshot.utiAllergies || null,
          uti_admission_reason:     Array.isArray(snapshot.utiAdmissionReason)
                                      ? snapshot.utiAdmissionReason.join("\n")
                                      : snapshot.utiAdmissionReason || null,
          uti_current_status:       Array.isArray(snapshot.utiCurrentStatus)
                                      ? snapshot.utiCurrentStatus.join("\n")
                                      : snapshot.utiCurrentStatus || null,
          uti_devices:              Array.isArray(snapshot.utiDevices)
                                      ? snapshot.utiDevices.join("\n")
                                      : snapshot.utiDevices || null,
          uti_cultures_antibiotics: Array.isArray(snapshot.utiCulturesAntibiotics)
                                      ? snapshot.utiCulturesAntibiotics.join("\n")
                                      : snapshot.utiCulturesAntibiotics || null,
          uti_specialties:          Array.isArray(snapshot.utiSpecialties)
                                      ? snapshot.utiSpecialties.join("\n")
                                      : snapshot.utiSpecialties || null,
          uti_origin_sector:        Array.isArray(snapshot.utiOriginSector)
                                      ? snapshot.utiOriginSector.join("\n")
                                      : snapshot.utiOriginSector || null,
          uti_daily_conducts:       Array.isArray(snapshot.utiDailyConducts)
                                      ? snapshot.utiDailyConducts.join("\n")
                                      : snapshot.utiDailyConducts || null,
          clinical_status:          snapshot.clinicalStatus || null,
          psm_status:               snapshot.psmStatus || null,
          admission_history:        snapshot._admissionHistory ?? null,
          admission_status:         snapshot.admissionStatus ?? "admitido",
          admitted_at:              coerceToIsoTimestamp(snapshot._admittedAt),
          patient_registry_id:      snapshot._registryId ?? null,
          medical_record:           snapshot._medicalRecord ?? null,
          is_vacant:                false,
          updated_at:               new Date().toISOString(),
        } as any)
        .eq("id", sourcePatientId);
      if (restoreErr) throw restoreErr;
      restoredSourceBed = true;
      invalidateResolvedRegistry(sourcePatientId);
    } else if (sourceBed && sourceBed.is_vacant === false) {
      // Leito de origem já tem outro paciente — não sobrescreve; apenas cancela a solicitação.
      console.warn(
        `[cancelInternalTransferRequest] leito de origem ${sourcePatientId} já está ocupado ` +
        `— restauração ignorada para evitar sobreposição de paciente.`
      );
    }

    // 3. Marca a solicitação como cancelada.
    const { error: cancelErr } = await (supabase as any)
      .from("internal_transfer_requests")
      .update({
        status: "cancelled",
        cancelled_by: currentUserId ?? null,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
      })
      .eq("id", requestId)
      .eq("status", "pending");
    if (cancelErr) throw cancelErr;

    return { ok: true, restoredSourceBed };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Erro" };
  }
}

