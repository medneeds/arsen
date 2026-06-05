
-- ════════════════════════════════════════════════════════════════════
-- signal_internal_transfer_atomic — Etapa 1 da transferência em 2 etapas
-- ════════════════════════════════════════════════════════════════════
--
-- PROBLEMA: signalInternalTransfer fazia:
--   ① INSERT internal_transfer_requests  ← commitado
--   ② UPDATE patients (zera origem)      ← commitado separado
--   Se ② falha após ①: request existe mas leito de origem continua
--   ocupado. Retry cria segundo request (duplicata).
--
-- SOLUÇÃO: ① e ② numa única transação.
--   Qualquer falha → rollback de ambos → estado limpo → retry seguro.
--
-- DEPLOY SEGURO: TypeScript detecta 42883 (função não existe) e
--   usa o fluxo sequencial original. Deploy em qualquer ordem.
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.signal_internal_transfer_atomic(
  p_source_patient_id   uuid,
  p_snapshot            jsonb,
  p_encounter_code      text    DEFAULT NULL,
  p_target_sector_code  text,
  p_target_sector_label text    DEFAULT NULL,
  p_classification      text    DEFAULT NULL,
  p_requires_saps       boolean DEFAULT false,
  p_reason              text    DEFAULT NULL,
  p_signaled_by         uuid    DEFAULT NULL,
  p_hospital_unit_id    uuid,
  p_state_id            uuid,
  p_department          text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_request_id uuid;
  v_source     public.patients%ROWTYPE;
BEGIN
  IF p_source_patient_id IS NULL THEN
    RAISE EXCEPTION 'source_patient_id é obrigatório';
  END IF;
  IF p_target_sector_code IS NULL OR p_target_sector_code = '' THEN
    RAISE EXCEPTION 'target_sector_code é obrigatório';
  END IF;

  -- Lê e bloqueia o leito de origem
  SELECT * INTO v_source
    FROM public.patients
   WHERE id = p_source_patient_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leito de origem não encontrado: %', p_source_patient_id;
  END IF;

  -- ── PASSO 1: Cria registro na fila virtual ────────────────────────
  INSERT INTO public.internal_transfer_requests (
    source_patient_id,
    source_bed,
    source_sector,
    patient_name,
    patient_snapshot,
    encounter_code,
    target_sector_code,
    target_sector_label,
    classification,
    requires_saps,
    reason,
    status,
    signaled_by,
    hospital_unit_id,
    state_id,
    department
  ) VALUES (
    p_source_patient_id,
    v_source.bed_number,
    v_source.sector,
    v_source.name,
    p_snapshot,
    p_encounter_code,
    p_target_sector_code,
    COALESCE(p_target_sector_label, p_target_sector_code),
    p_classification,
    p_requires_saps,
    p_reason,
    'pending',
    p_signaled_by,
    p_hospital_unit_id,
    p_state_id,
    p_department
  ) RETURNING id INTO v_request_id;

  -- ── PASSO 2: Zera leito de origem ─────────────────────────────────
  -- Falha aqui → rollback do INSERT (passo 1) → estado limpo.
  UPDATE public.patients SET
    name                     = '',
    age                      = NULL,
    diagnoses                = NULL,
    medical_history          = NULL,
    relevant_exams           = NULL,
    pendencies               = NULL,
    schedule                 = NULL,
    admission_history        = NULL,
    admission_date           = NULL,
    highlighted_diagnoses    = NULL,
    highlighted_medical_history = NULL,
    highlighted_pendencies   = NULL,
    highlighted_conducts     = NULL,
    uti_admission_date       = NULL,
    uti_discharge_prediction = NULL,
    uti_allergies            = NULL,
    uti_admission_reason     = NULL,
    uti_current_status       = NULL,
    uti_devices              = NULL,
    uti_cultures_antibiotics = NULL,
    uti_specialties          = NULL,
    uti_origin_sector        = NULL,
    uti_daily_conducts       = NULL,
    clinical_status          = NULL,
    psm_status               = NULL,
    admission_status         = NULL,
    patient_registry_id      = NULL,
    medical_record           = NULL,
    admitted_at              = NULL,
    is_vacant                = true,
    updated_at               = now()
  WHERE id = p_source_patient_id;

  -- ── PASSO 3: Auditoria (não-bloqueante) ───────────────────────────
  BEGIN
    INSERT INTO public.patient_movements (
      patient_id, patient_name, patient_bed, patient_sector,
      patient_registry_id, movement_type, destination, notes,
      created_by, department, state_id, hospital_unit_id, patient_snapshot
    ) VALUES (
      p_source_patient_id,
      v_source.name,
      v_source.bed_number,
      v_source.sector,
      v_source.patient_registry_id,
      'TRANSFERÊNCIA INTERNA — SINALIZADA',
      COALESCE(p_target_sector_label, p_target_sector_code),
      'Etapa 1/2 — Sinalização para ' || COALESCE(p_target_sector_label, p_target_sector_code)
        || ' (' || COALESCE(p_classification, 'N/A') || ')'
        || CASE WHEN p_requires_saps THEN ' — escalada crítica: exigirá SAPS 3 após alocação' ELSE '' END
        || COALESCE(' | Motivo: ' || p_reason, ''),
      p_signaled_by,
      p_department,
      p_state_id,
      p_hospital_unit_id,
      to_jsonb(v_source)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[signal_internal_transfer_atomic] falha ao registrar patient_movements: %', SQLERRM;
  END;

  RETURN jsonb_build_object(
    'success',     true,
    'request_id',  v_request_id,
    'source_id',   p_source_patient_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.signal_internal_transfer_atomic(
  uuid, jsonb, text, text, text, text, boolean, text, uuid, uuid, uuid, text
) TO authenticated;
