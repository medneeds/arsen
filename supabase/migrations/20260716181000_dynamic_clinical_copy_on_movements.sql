-- ════════════════════════════════════════════════════════════════════════
-- PRESERVAÇÃO TOTAL DE DADOS DO PACIENTE NAS MOVIMENTAÇÕES
-- ════════════════════════════════════════════════════════════════════════
-- Complemento de 20260716180000 (leito vago = leito limpo). Auditoria de
-- 16/07/2026 mostrou que as listas de cópia manuais das RPCs divergiam entre
-- si e perdiam campos clínicos (medical_responsibility, uti_weight_kg,
-- internment_*, is_palliative, isolation_precautions,
-- hospital_discharge_prediction) em alguns fluxos.
--
-- Estratégia: cópia DINÂMICA (information_schema) de todas as colunas
-- não-estruturais — o paciente leva TUDO para o leito destino, inclusive
-- colunas criadas no futuro. A limpeza da origem passa a ser apenas
-- is_vacant = true (o trigger trg_enforce_vacant_bed_is_clean faz a
-- varredura completa).

-- ────────────────────────────────────────────────────────────────────────
-- 1) Helper: copia todas as colunas clínicas de um leito para outro
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.copy_bed_clinical_data(
  p_source_id uuid,
  p_target_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_set text;
BEGIN
  SELECT string_agg(format('%I = s.%I', column_name, column_name), ', ')
    INTO v_set
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = 'patients'
     AND column_name NOT IN (
       -- Estruturais do leito: nunca copiadas entre leitos
       'id', 'bed_number', 'sector', 'department',
       'state_id', 'hospital_unit_id',
       'is_vacant', 'is_active', 'is_blocked', 'block_reason',
       'bed_type', 'display_order',
       'created_at', 'updated_at', 'created_by'
     );

  EXECUTE format(
    'UPDATE public.patients t SET %s, is_vacant = false, updated_at = now()
       FROM public.patients s
      WHERE s.id = $1 AND t.id = $2',
    v_set
  ) USING p_source_id, p_target_id;
END;
$$;
REVOKE ALL ON FUNCTION public.copy_bed_clinical_data(uuid, uuid) FROM PUBLIC;
-- Chamada apenas por RPCs SECURITY DEFINER — sem grant a authenticated.

-- ────────────────────────────────────────────────────────────────────────
-- 2) execute_internal_transfer_atomic — cópia dinâmica + overrides de fluxo
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.execute_internal_transfer_atomic(
  p_source_patient_id   uuid,
  p_target_patient_id   uuid,
  p_needs_saps          boolean DEFAULT false,
  p_needs_new_admission boolean DEFAULT false,
  p_reason              text    DEFAULT 'INTERNAL_TRANSFER',
  p_created_by          uuid    DEFAULT NULL,
  p_hospital_unit_id    uuid    DEFAULT NULL,
  p_state_id            uuid    DEFAULT NULL,
  p_department          text    DEFAULT NULL,
  p_classification      text    DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_source              public.patients%ROWTYPE;
  v_target_bed_number   text;
  v_target_sector       text;
  v_destination_status  text;
BEGIN
  IF p_source_patient_id IS NULL OR p_target_patient_id IS NULL THEN
    RAISE EXCEPTION 'source e target são obrigatórios';
  END IF;
  IF p_source_patient_id = p_target_patient_id THEN
    RAISE EXCEPTION 'source e target devem ser leitos diferentes';
  END IF;
  SELECT * INTO v_source FROM public.patients WHERE id = p_source_patient_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Leito de origem não encontrado: %', p_source_patient_id; END IF;
  SELECT bed_number, sector INTO v_target_bed_number, v_target_sector
    FROM public.patients WHERE id = p_target_patient_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Leito de destino não encontrado: %', p_target_patient_id; END IF;

  v_destination_status := CASE
    WHEN p_needs_saps          THEN 'saps_pendente'
    WHEN p_needs_new_admission THEN 'pre_admitido'
    ELSE COALESCE(v_source.admission_status, 'admitido')
  END;

  -- Cópia dinâmica: TODAS as colunas clínicas (à prova de colunas futuras)
  PERFORM public.copy_bed_clinical_data(p_source_patient_id, p_target_patient_id);

  -- Overrides específicos do fluxo de transferência interna
  UPDATE public.patients SET
    admission_status  = v_destination_status,
    admission_history = CASE WHEN p_needs_new_admission THEN NULL ELSE v_source.admission_history END,
    admitted_at       = CASE WHEN p_needs_new_admission THEN NULL ELSE v_source.admitted_at END,
    updated_at        = now()
  WHERE id = p_target_patient_id;

  PERFORM public.repoint_patient_history(p_source_patient_id, p_target_patient_id, p_reason);

  -- Limpeza da origem: o trigger trg_enforce_vacant_bed_is_clean zera tudo
  UPDATE public.patients SET is_vacant = true, updated_at = now()
  WHERE id = p_source_patient_id;

  BEGIN
    INSERT INTO public.patient_movements (patient_id, patient_name, patient_bed, patient_sector,
      patient_registry_id, movement_type, destination, notes, created_by, department,
      state_id, hospital_unit_id, patient_snapshot)
    VALUES (p_target_patient_id, v_source.name, v_source.bed_number, v_source.sector,
      v_source.patient_registry_id, 'TRANSFERÊNCIA INTERNA',
      v_target_bed_number || ' (' || COALESCE(v_target_sector, '?') || ')',
      COALESCE(p_reason, 'Transferência interna')
        || ' — classificação: ' || COALESCE(p_classification, 'N/A')
        || CASE WHEN p_needs_saps THEN ' — SAPS 3 pendente.' ELSE '' END,
      p_created_by, p_department,
      COALESCE(p_state_id, v_source.state_id),
      COALESCE(p_hospital_unit_id, v_source.hospital_unit_id),
      to_jsonb(v_source));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[execute_internal_transfer_atomic] falha audit: % | source=% target=%',
      SQLERRM, p_source_patient_id, p_target_patient_id;
  END;

  RETURN jsonb_build_object('success', true, 'source_id', p_source_patient_id,
    'target_id', p_target_patient_id, 'classification', p_classification,
    'needs_saps', p_needs_saps, 'destination_status', v_destination_status);
END;
$$;
GRANT EXECUTE ON FUNCTION public.execute_internal_transfer_atomic(
  uuid, uuid, boolean, boolean, text, uuid, uuid, uuid, text, text
) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────
-- 3) execute_operational_relocation_atomic — cópia dinâmica
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.execute_operational_relocation_atomic(
  p_source_patient_id uuid,
  p_target_patient_id uuid,
  p_reason            text,
  p_hospital_unit_id  uuid,
  p_state_id          uuid,
  p_department        text DEFAULT NULL,
  p_created_by        uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_source            public.patients%ROWTYPE;
  v_target_bed_number text;
  v_target_sector     text;
  v_movement_id       uuid;
BEGIN
  IF p_source_patient_id IS NULL OR p_target_patient_id IS NULL THEN
    RAISE EXCEPTION 'source e target são obrigatórios';
  END IF;
  IF p_source_patient_id = p_target_patient_id THEN
    RAISE EXCEPTION 'Leito de origem e destino são iguais';
  END IF;
  SELECT * INTO v_source FROM public.patients WHERE id = p_source_patient_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Leito de origem não encontrado: %', p_source_patient_id; END IF;
  SELECT bed_number, sector INTO v_target_bed_number, v_target_sector
    FROM public.patients WHERE id = p_target_patient_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Leito de destino não encontrado: %', p_target_patient_id; END IF;

  -- Cópia dinâmica: o paciente leva TUDO para o leito destino
  PERFORM public.copy_bed_clinical_data(p_source_patient_id, p_target_patient_id);

  PERFORM public.repoint_patient_history(p_source_patient_id, p_target_patient_id,
    'Remanejamento operacional: ' || p_reason);
  PERFORM public.archive_patient_bed_data(p_source_patient_id, 'operational_relocation_source_release');

  -- Limpeza da origem via invariante (trigger zera tudo)
  UPDATE public.patients SET is_vacant = true, updated_at = now()
  WHERE id = p_source_patient_id;

  BEGIN
    INSERT INTO public.patient_movements (patient_id, patient_name, patient_bed, patient_sector,
      patient_registry_id, movement_type, destination, notes, created_by, department,
      state_id, hospital_unit_id, patient_snapshot)
    VALUES (p_target_patient_id, v_source.name, v_source.bed_number, v_source.sector,
      v_source.patient_registry_id, 'REMANEJAMENTO_OPERACIONAL',
      v_target_bed_number || ' (' || COALESCE(v_target_sector, '?') || ')',
      p_reason, p_created_by, p_department, p_state_id, p_hospital_unit_id, to_jsonb(v_source))
    RETURNING id INTO v_movement_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[execute_operational_relocation_atomic] falha audit: %', SQLERRM;
  END;

  RETURN jsonb_build_object('success', true, 'source_id', p_source_patient_id,
    'target_id', p_target_patient_id, 'movement_id', v_movement_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.execute_operational_relocation_atomic(
  uuid, uuid, text, uuid, uuid, text, uuid
) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────
-- 4) complete_internal_transfer_atomic — adiciona campos que faltavam no
--    JSONB de destino (a origem já foi esvaziada na etapa 1; os dados vêm
--    do snapshot enviado pelo front, que agora inclui a linha completa)
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.complete_internal_transfer_atomic(
  p_request_id uuid, p_target_patient_id uuid, p_destination jsonb,
  p_hospital_unit_id uuid, p_state_id uuid,
  p_repoint_reason text DEFAULT NULL::text,
  p_current_user_id uuid DEFAULT NULL::uuid,
  p_department text DEFAULT NULL::text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
  SELECT * INTO v_req FROM public.internal_transfer_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request não encontrado: %', p_request_id; END IF;
  IF v_req.status != 'pending' THEN RAISE EXCEPTION 'Request já está %', v_req.status; END IF;
  v_source_id := v_req.source_patient_id;
  v_classification := v_req.classification;
  v_needs_saps := v_req.requires_saps;
  UPDATE public.patients SET
    name = (p_destination->>'name'),
    age = (p_destination->>'age'),
    diagnoses = (p_destination->>'diagnoses'),
    medical_history = (p_destination->>'medical_history'),
    relevant_exams = (p_destination->>'relevant_exams'),
    pendencies = (p_destination->>'pendencies'),
    schedule = (p_destination->>'schedule'),
    admission_history = (p_destination->>'admission_history'),
    admission_date = CASE WHEN p_destination->>'admission_date' IS NOT NULL
                       AND p_destination->>'admission_date' != ''
                       THEN (p_destination->>'admission_date')::timestamptz ELSE NULL END,
    highlighted_diagnoses = CASE
      WHEN p_destination->'highlighted_diagnoses' IS NOT NULL
        AND jsonb_typeof(p_destination->'highlighted_diagnoses') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(p_destination->'highlighted_diagnoses')::integer)
      ELSE NULL END,
    highlighted_medical_history = CASE
      WHEN p_destination->'highlighted_medical_history' IS NOT NULL
        AND jsonb_typeof(p_destination->'highlighted_medical_history') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(p_destination->'highlighted_medical_history')::integer)
      ELSE NULL END,
    highlighted_pendencies = CASE
      WHEN p_destination->'highlighted_pendencies' IS NOT NULL
        AND jsonb_typeof(p_destination->'highlighted_pendencies') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(p_destination->'highlighted_pendencies')::integer)
      ELSE NULL END,
    highlighted_conducts = CASE
      WHEN p_destination->'highlighted_conducts' IS NOT NULL
        AND jsonb_typeof(p_destination->'highlighted_conducts') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(p_destination->'highlighted_conducts')::integer)
      ELSE NULL END,
    uti_admission_date = CASE WHEN p_destination->>'uti_admission_date' IS NOT NULL
                            AND p_destination->>'uti_admission_date' != ''
                            THEN (p_destination->>'uti_admission_date')::timestamptz ELSE NULL END,
    uti_discharge_prediction = (p_destination->>'uti_discharge_prediction'),
    uti_allergies = (p_destination->>'uti_allergies'),
    uti_admission_reason = (p_destination->>'uti_admission_reason'),
    uti_current_status = (p_destination->>'uti_current_status'),
    uti_devices = (p_destination->>'uti_devices'),
    uti_cultures_antibiotics = (p_destination->>'uti_cultures_antibiotics'),
    uti_specialties = (p_destination->>'uti_specialties'),
    uti_origin_sector = (p_destination->>'uti_origin_sector'),
    uti_daily_conducts = (p_destination->>'uti_daily_conducts'),
    clinical_status = (p_destination->>'clinical_status'),
    psm_status = (p_destination->>'psm_status'),
    admission_status = (p_destination->>'admission_status'),
    admitted_at = CASE WHEN p_destination->>'admitted_at' IS NOT NULL
                    AND p_destination->>'admitted_at' != ''
                    THEN (p_destination->>'admitted_at')::timestamptz ELSE NULL END,
    patient_registry_id = CASE WHEN p_destination->>'patient_registry_id' IS NOT NULL
                            THEN (p_destination->>'patient_registry_id')::uuid ELSE NULL END,
    medical_record = (p_destination->>'medical_record'),
    -- Campos adicionados pela auditoria de preservação (16/07/2026):
    medical_responsibility = (p_destination->>'medical_responsibility'),
    internment_status = (p_destination->>'internment_status'),
    internment_notes = (p_destination->>'internment_notes'),
    uti_weight_kg = CASE WHEN p_destination->>'uti_weight_kg' IS NOT NULL
                       AND p_destination->>'uti_weight_kg' != ''
                       THEN (p_destination->>'uti_weight_kg')::numeric ELSE NULL END,
    is_palliative = COALESCE((p_destination->>'is_palliative')::boolean, false),
    isolation_precautions = (p_destination->>'isolation_precautions'),
    hospital_discharge_prediction = (p_destination->>'hospital_discharge_prediction'),
    is_door_patient = COALESCE((p_destination->>'is_door_patient')::boolean, false),
    is_vacant = false, updated_at = now()
  WHERE id = p_target_patient_id;
  PERFORM public.repoint_patient_history(v_source_id, p_target_patient_id,
    COALESCE(p_repoint_reason, 'Transferência interna (etapa 2)'));
  UPDATE public.internal_transfer_requests
     SET status = 'completed', completed_by = p_current_user_id, completed_at = now(),
         completed_target_patient_id = p_target_patient_id
   WHERE id = p_request_id;
  BEGIN
    UPDATE public.admission_histories SET patient_id = p_target_patient_id, updated_at = now()
     WHERE patient_id = v_source_id AND archived_at IS NULL;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[complete_internal_transfer_atomic] falha admission_histories: %', SQLERRM;
  END;
  BEGIN
    INSERT INTO public.patient_movements (patient_id, patient_name, patient_bed, patient_sector,
      patient_registry_id, movement_type, destination, notes, created_by, department,
      state_id, hospital_unit_id, patient_snapshot)
    VALUES (p_target_patient_id, v_req.patient_name, v_req.source_bed, v_req.source_sector,
      (p_destination->>'patient_registry_id')::uuid,
      'TRANSFERÊNCIA INTERNA — CONCLUÍDA', p_target_patient_id::text,
      'Etapa 2/2 — Alocação concluída (' || COALESCE(v_classification, 'N/A') || ')'
        || CASE WHEN v_needs_saps THEN ' — SAPS 3 pendente no destino.' ELSE '' END,
      p_current_user_id, p_department, p_state_id, p_hospital_unit_id, v_req.patient_snapshot)
    RETURNING id INTO v_movement_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[complete_internal_transfer_atomic] falha audit: % | request=%',
      SQLERRM, p_request_id;
  END;
  RETURN jsonb_build_object('success', true, 'request_id', p_request_id,
    'source_id', v_source_id, 'target_id', p_target_patient_id,
    'classification', v_classification, 'needs_saps', v_needs_saps,
    'movement_id', v_movement_id);
END;
$$;
