
-- ════════════════════════════════════════════════════════════════════
-- complete_internal_transfer_atomic — Etapa 2 da transferência em 2 etapas
-- ════════════════════════════════════════════════════════════════════
--
-- PROBLEMA: completeInternalTransfer fazia operações independentes:
--   ① UPDATE patients (popula destino)       ← commitado
--   ② CALL repoint_patient_history           ← commitado separado
--   ③ UPDATE request status='completed'      ← commitado separado
--   Se ② falha após ①: destino tem dados mas histórico não migrou.
--   Se ③ falha após ②: request fica 'pending' podendo ser re-completado.
--
-- SOLUÇÃO: ①, ② e ③ numa única transação.
--   Qualquer falha → rollback de todos → estado limpo → retry seguro.
--
-- DESIGN: TypeScript prepara todos os campos do paciente (lê snapshot,
--   converte arrays para texto, parseia datas) e os passa via JSONB.
--   O SQL apenas executa as operações de banco atomicamente.
--
-- DEPLOY SEGURO: TypeScript detecta 42883 e usa fluxo sequencial.
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.complete_internal_transfer_atomic(
  p_request_id        uuid,
  p_target_patient_id uuid,
  p_destination       jsonb,    -- campos do paciente pré-processados pelo TypeScript
  p_repoint_reason    text      DEFAULT NULL,
  p_current_user_id   uuid      DEFAULT NULL,
  p_hospital_unit_id  uuid,
  p_state_id          uuid,
  p_department        text      DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_req            record;
  v_source_id      uuid;
  v_classification text;
  v_needs_saps     boolean;
  v_movement_id    uuid;
BEGIN
  IF p_request_id IS NULL OR p_target_patient_id IS NULL THEN
    RAISE EXCEPTION 'request_id e target_patient_id são obrigatórios';
  END IF;

  -- Lê e bloqueia o request — valida que ainda está pendente
  SELECT * INTO v_req
    FROM public.internal_transfer_requests
   WHERE id = p_request_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request não encontrado: %', p_request_id;
  END IF;
  IF v_req.status != 'pending' THEN
    RAISE EXCEPTION 'Request já está %', v_req.status;
  END IF;

  v_source_id    := v_req.source_patient_id;
  v_classification := v_req.classification;
  v_needs_saps   := v_req.requires_saps;

  -- ── PASSO 1: Popula leito destino com os dados pré-processados ────
  -- O TypeScript já cuidou de: join arrays, coerce timestamps, etc.
  -- Aqui apenas gravamos os valores prontos no banco.
  UPDATE public.patients SET
    name                     = (p_destination->>'name'),
    age                      = (p_destination->>'age'),
    diagnoses                = (p_destination->>'diagnoses'),
    medical_history          = (p_destination->>'medical_history'),
    relevant_exams           = (p_destination->>'relevant_exams'),
    pendencies               = (p_destination->>'pendencies'),
    schedule                 = (p_destination->>'schedule'),
    admission_history        = (p_destination->>'admission_history'),
    admission_date           = CASE WHEN p_destination->>'admission_date' IS NOT NULL AND p_destination->>'admission_date' != ''
                                 THEN (p_destination->>'admission_date')::timestamptz ELSE NULL END,
    highlighted_diagnoses    = (p_destination->>'highlighted_diagnoses'),
    highlighted_medical_history = (p_destination->>'highlighted_medical_history'),
    highlighted_pendencies   = (p_destination->>'highlighted_pendencies'),
    highlighted_conducts     = (p_destination->>'highlighted_conducts'),
    uti_admission_date       = CASE WHEN p_destination->>'uti_admission_date' IS NOT NULL AND p_destination->>'uti_admission_date' != ''
                                 THEN (p_destination->>'uti_admission_date')::timestamptz ELSE NULL END,
    uti_discharge_prediction = (p_destination->>'uti_discharge_prediction'),
    uti_allergies            = (p_destination->>'uti_allergies'),
    uti_admission_reason     = (p_destination->>'uti_admission_reason'),
    uti_current_status       = (p_destination->>'uti_current_status'),
    uti_devices              = (p_destination->>'uti_devices'),
    uti_cultures_antibiotics = (p_destination->>'uti_cultures_antibiotics'),
    uti_specialties          = (p_destination->>'uti_specialties'),
    uti_origin_sector        = (p_destination->>'uti_origin_sector'),
    uti_daily_conducts       = (p_destination->>'uti_daily_conducts'),
    clinical_status          = (p_destination->>'clinical_status'),
    psm_status               = (p_destination->>'psm_status'),
    admission_history        = (p_destination->>'admission_history'),
    admission_status         = (p_destination->>'admission_status'),
    admitted_at              = CASE WHEN p_destination->>'admitted_at' IS NOT NULL AND p_destination->>'admitted_at' != ''
                                 THEN (p_destination->>'admitted_at')::timestamptz ELSE NULL END,
    patient_registry_id      = CASE WHEN p_destination->>'patient_registry_id' IS NOT NULL
                                 THEN (p_destination->>'patient_registry_id')::uuid ELSE NULL END,
    medical_record           = (p_destination->>'medical_record'),
    is_vacant                = false,
    updated_at               = now()
  WHERE id = p_target_patient_id;

  -- ── PASSO 2: Repointa histórico clínico ──────────────────────────
  -- Erros críticos (clinical_evolutions) propagam → rollback de ① e ②
  PERFORM public.repoint_patient_history(
    v_source_id,
    p_target_patient_id,
    COALESCE(p_repoint_reason, 'Transferência interna (etapa 2)')
  );

  -- ── PASSO 3: Marca request como concluído ─────────────────────────
  -- Dentro da mesma transação: se falhar, ① e ② também revertem.
  UPDATE public.internal_transfer_requests
     SET status            = 'completed',
         completed_by      = p_current_user_id,
         completed_at      = now(),
         completed_target_patient_id = p_target_patient_id
   WHERE id = p_request_id;

  -- ── PASSO 4: Sincroniza admission_histories (não-bloqueante) ──────
  BEGIN
    UPDATE public.admission_histories
       SET patient_id  = p_target_patient_id,
           updated_at  = now()
     WHERE patient_id  = v_source_id
       AND archived_at IS NULL;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[complete_internal_transfer_atomic] falha ao sincronizar admission_histories: %', SQLERRM;
  END;

  -- ── PASSO 5: Auditoria (não-bloqueante) ───────────────────────────
  BEGIN
    INSERT INTO public.patient_movements (
      patient_id, patient_name, patient_bed, patient_sector,
      patient_registry_id, movement_type, destination, notes,
      created_by, department, state_id, hospital_unit_id,
      patient_snapshot
    ) VALUES (
      p_target_patient_id,
      v_req.patient_name,
      v_req.source_bed,
      v_req.source_sector,
      (p_destination->>'patient_registry_id')::uuid,
      'TRANSFERÊNCIA INTERNA — CONCLUÍDA',
      p_target_patient_id::text,
      'Etapa 2/2 — Alocação concluída (' || COALESCE(v_classification, 'N/A') || ')'
        || CASE WHEN v_needs_saps THEN ' — SAPS 3 pendente no destino.' ELSE '' END,
      p_current_user_id,
      p_department,
      p_state_id,
      p_hospital_unit_id,
      v_req.patient_snapshot
    ) RETURNING id INTO v_movement_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[complete_internal_transfer_atomic] falha ao registrar patient_movements: % | request=%',
      SQLERRM, p_request_id;
  END;

  RETURN jsonb_build_object(
    'success',        true,
    'request_id',     p_request_id,
    'source_id',      v_source_id,
    'target_id',      p_target_patient_id,
    'classification', v_classification,
    'needs_saps',     v_needs_saps,
    'movement_id',    v_movement_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_internal_transfer_atomic(
  uuid, uuid, jsonb, text, uuid, uuid, uuid, text
) TO authenticated;
