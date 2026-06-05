-- ════════════════════════════════════════════════════════════════════
-- MIGRATION 1/8 — repoint_patient_history v3 (propaga erros críticos)
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.repoint_patient_history(
  p_source_patient_id uuid,
  p_target_patient_id uuid,
  p_reason            text DEFAULT 'INTERNAL_TRANSFER'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user                uuid := auth.uid();
  v_registry_id         uuid;
  v_source_encounter_id uuid;
  v_target_encounter_id uuid;
  v_dup_closed          int  := 0;
  v_counts              jsonb := '{}'::jsonb;
  v_n                   int;
BEGIN
  IF p_source_patient_id IS NULL OR p_target_patient_id IS NULL THEN
    RAISE EXCEPTION 'source e target patient_id são obrigatórios';
  END IF;
  IF p_source_patient_id = p_target_patient_id THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'source = target');
  END IF;
  SELECT patient_registry_id INTO v_registry_id FROM public.patients WHERE id = p_source_patient_id LIMIT 1;
  IF v_registry_id IS NULL THEN
    SELECT patient_registry_id INTO v_registry_id FROM public.patients WHERE id = p_target_patient_id LIMIT 1;
  END IF;
  SELECT id INTO v_source_encounter_id FROM public.patient_encounters
    WHERE (patient_id = p_source_patient_id OR registry_id = v_registry_id) AND status = 'active'
    ORDER BY admission_date DESC NULLS LAST, created_at DESC LIMIT 1;
  SELECT id INTO v_target_encounter_id FROM public.patient_encounters
    WHERE (patient_id = p_target_patient_id OR registry_id = v_registry_id) AND status = 'active'
    ORDER BY admission_date DESC NULLS LAST, created_at DESC LIMIT 1;
  IF v_target_encounter_id IS NULL THEN v_target_encounter_id := v_source_encounter_id; END IF;
  IF v_registry_id IS NOT NULL AND v_source_encounter_id IS NOT NULL AND v_target_encounter_id IS NOT NULL
     AND v_source_encounter_id <> v_target_encounter_id THEN
    BEGIN
      WITH dup AS (SELECT id FROM public.patient_encounters
         WHERE registry_id = v_registry_id AND status = 'active'
         AND id IN (v_source_encounter_id, v_target_encounter_id)
         ORDER BY admission_date ASC NULLS FIRST, created_at ASC LIMIT 1)
      UPDATE public.patient_encounters pe SET status = 'closed', updated_at = now()
        FROM dup WHERE pe.id = dup.id;
      GET DIAGNOSTICS v_dup_closed = ROW_COUNT;
      SELECT id INTO v_target_encounter_id FROM public.patient_encounters
        WHERE registry_id = v_registry_id AND status = 'active'
        ORDER BY admission_date DESC NULLS LAST, created_at DESC LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      v_counts := v_counts || jsonb_build_object('dup_close_error', SQLERRM);
    END;
  END IF;
  UPDATE public.clinical_evolutions
     SET patient_id = p_target_patient_id,
         encounter_id = COALESCE(v_target_encounter_id, encounter_id),
         updated_at = now()
   WHERE patient_id = p_source_patient_id
      OR (patient_registry_id = v_registry_id AND v_source_encounter_id IS NOT NULL
          AND encounter_id = v_source_encounter_id);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('clinical_evolutions', v_n);
  BEGIN
    UPDATE public.clinical_evolutions
       SET archived_at = NULL, patient_id = p_target_patient_id,
           encounter_id = COALESCE(v_target_encounter_id, encounter_id), updated_at = now()
     WHERE patient_registry_id = v_registry_id AND archived_at IS NOT NULL
       AND archived_at > (now() - interval '15 minutes');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('clinical_evolutions_unarchived', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('unarchive_error', SQLERRM); END;
  UPDATE public.prescriptions
     SET encounter_id = COALESCE(v_target_encounter_id, encounter_id),
         patient_data = jsonb_set(COALESCE(patient_data, '{}'::jsonb), '{id}', to_jsonb(p_target_patient_id::text), true),
         repointed_at = now(), repoint_reason = p_reason, updated_at = now()
   WHERE patient_registry_id = v_registry_id AND archived_at IS NULL
     AND ((patient_data->>'id') = p_source_patient_id::text
          OR (v_source_encounter_id IS NOT NULL AND encounter_id = v_source_encounter_id)
          OR encounter_id IS NULL);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('prescriptions', v_n);
  BEGIN UPDATE public.exam_requests SET patient_id = p_target_patient_id,
      encounter_id = COALESCE(v_target_encounter_id, encounter_id), updated_at = now()
     WHERE patient_id = p_source_patient_id OR (patient_registry_id = v_registry_id
        AND v_source_encounter_id IS NOT NULL AND encounter_id = v_source_encounter_id);
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('exam_requests', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('exam_requests_error', SQLERRM); END;
  BEGIN UPDATE public.culture_results SET patient_id = p_target_patient_id,
      encounter_id = COALESCE(v_target_encounter_id, encounter_id), updated_at = now()
     WHERE patient_id = p_source_patient_id OR (patient_registry_id = v_registry_id
        AND v_source_encounter_id IS NOT NULL AND encounter_id = v_source_encounter_id);
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('culture_results', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('culture_results_error', SQLERRM); END;
  BEGIN UPDATE public.admission_histories SET patient_id = p_target_patient_id, updated_at = now()
     WHERE patient_id = p_source_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('admission_histories', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('admission_histories_error', SQLERRM); END;
  BEGIN UPDATE public.vital_signs SET patient_id = p_target_patient_id,
      encounter_id = COALESCE(v_target_encounter_id, encounter_id), updated_at = now()
     WHERE patient_id = p_source_patient_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('vital_signs', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('vital_signs_error', SQLERRM); END;
  BEGIN UPDATE public.round_sessions SET patient_id = p_target_patient_id,
      encounter_id = COALESCE(v_target_encounter_id, encounter_id), updated_at = now()
     WHERE patient_id = p_source_patient_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('round_sessions', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('round_sessions_error', SQLERRM); END;
  BEGIN UPDATE public.discharge_documents SET patient_id = p_target_patient_id,
      encounter_id = COALESCE(v_target_encounter_id, encounter_id), updated_at = now()
     WHERE patient_id = p_source_patient_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('discharge_documents', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('discharge_documents_error', SQLERRM); END;
  BEGIN UPDATE public.conduct_history SET patient_id = p_target_patient_id WHERE patient_id = p_source_patient_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.medical_records SET patient_id = p_target_patient_id WHERE patient_id = p_source_patient_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.dhd_patients SET patient_id = p_target_patient_id WHERE patient_id = p_source_patient_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.pre_admissions SET patient_id = p_target_patient_id WHERE patient_id = p_source_patient_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.medical_record_edit_history SET patient_id = p_target_patient_id WHERE patient_id = p_source_patient_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.patient_admission_date_history SET patient_id = p_target_patient_id WHERE patient_id = p_source_patient_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.patient_encounters SET patient_id = p_target_patient_id, updated_at = now()
     WHERE patient_id = p_source_patient_id AND status = 'active';
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    INSERT INTO public.patient_movements (patient_id, patient_name, patient_bed, patient_sector,
      movement_type, destination, notes, created_by, department, hospital_unit_id, state_id,
      patient_registry_id, encounter_id, patient_snapshot)
    SELECT p_target_patient_id, COALESCE(t.name, s.name), t.bed_number, t.sector,
      'REPOINT_HISTORY_V3',
      'Histórico clínico migrado de ' || COALESCE(s.bed_number,'?') || ' (' || COALESCE(s.sector,'?')
        || ') para ' || COALESCE(t.bed_number,'?') || ' (' || COALESCE(t.sector,'?') || ')',
      p_reason, v_user, t.department, t.hospital_unit_id, t.state_id,
      v_registry_id, v_target_encounter_id,
      jsonb_build_object('source_patient_id', p_source_patient_id, 'target_patient_id', p_target_patient_id,
        'source_encounter', v_source_encounter_id, 'target_encounter', v_target_encounter_id,
        'registry_id', v_registry_id, 'duplicate_encounters_closed', v_dup_closed,
        'counts', v_counts, 'source', to_jsonb(s), 'target', to_jsonb(t), 'version', 'v3')
    FROM public.patients t LEFT JOIN public.patients s ON s.id = p_source_patient_id
    WHERE t.id = p_target_patient_id;
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('audit_error', SQLERRM); END;
  RETURN jsonb_build_object('success', true, 'source_id', p_source_patient_id,
    'target_id', p_target_patient_id, 'registry_id', v_registry_id,
    'source_encounter', v_source_encounter_id, 'target_encounter', v_target_encounter_id,
    'duplicate_encounters_closed', v_dup_closed, 'counts', v_counts,
    'performed_by', v_user, 'performed_at', now(), 'version', 'v3');
END;
$$;

-- ════════════════════════════════════════════════════════════════════
-- MIGRATION 2/8 — repoint_patient_history v4 (cobre patient_id = null)
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.repoint_patient_history(
  p_source_patient_id uuid,
  p_target_patient_id uuid,
  p_reason            text DEFAULT 'INTERNAL_TRANSFER'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user                uuid := auth.uid();
  v_registry_id         uuid;
  v_source_encounter_id uuid;
  v_target_encounter_id uuid;
  v_dup_closed          int  := 0;
  v_counts              jsonb := '{}'::jsonb;
  v_n                   int;
BEGIN
  IF p_source_patient_id IS NULL OR p_target_patient_id IS NULL THEN
    RAISE EXCEPTION 'source e target patient_id são obrigatórios';
  END IF;
  IF p_source_patient_id = p_target_patient_id THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'source = target');
  END IF;
  SELECT patient_registry_id INTO v_registry_id FROM public.patients WHERE id = p_source_patient_id LIMIT 1;
  IF v_registry_id IS NULL THEN
    SELECT patient_registry_id INTO v_registry_id FROM public.patients WHERE id = p_target_patient_id LIMIT 1;
  END IF;
  SELECT id INTO v_source_encounter_id FROM public.patient_encounters
    WHERE (patient_id = p_source_patient_id OR registry_id = v_registry_id) AND status = 'active'
    ORDER BY admission_date DESC NULLS LAST, created_at DESC LIMIT 1;
  SELECT id INTO v_target_encounter_id FROM public.patient_encounters
    WHERE (patient_id = p_target_patient_id OR registry_id = v_registry_id) AND status = 'active'
    ORDER BY admission_date DESC NULLS LAST, created_at DESC LIMIT 1;
  IF v_target_encounter_id IS NULL THEN v_target_encounter_id := v_source_encounter_id; END IF;
  IF v_registry_id IS NOT NULL AND v_source_encounter_id IS NOT NULL AND v_target_encounter_id IS NOT NULL
     AND v_source_encounter_id <> v_target_encounter_id THEN
    BEGIN
      WITH dup AS (SELECT id FROM public.patient_encounters
         WHERE registry_id = v_registry_id AND status = 'active'
         AND id IN (v_source_encounter_id, v_target_encounter_id)
         ORDER BY admission_date ASC NULLS FIRST, created_at ASC LIMIT 1)
      UPDATE public.patient_encounters pe SET status = 'closed', updated_at = now()
        FROM dup WHERE pe.id = dup.id;
      GET DIAGNOSTICS v_dup_closed = ROW_COUNT;
      SELECT id INTO v_target_encounter_id FROM public.patient_encounters
        WHERE registry_id = v_registry_id AND status = 'active'
        ORDER BY admission_date DESC NULLS LAST, created_at DESC LIMIT 1;
    EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('dup_close_error', SQLERRM); END;
  END IF;
  -- v4: terceira condição OR para patient_id = null
  UPDATE public.clinical_evolutions
     SET patient_id = p_target_patient_id,
         encounter_id = COALESCE(v_target_encounter_id, encounter_id), updated_at = now()
   WHERE patient_id = p_source_patient_id
      OR (patient_registry_id = v_registry_id AND v_source_encounter_id IS NOT NULL
          AND encounter_id = v_source_encounter_id)
      OR (patient_registry_id = v_registry_id AND patient_id IS NULL);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('clinical_evolutions', v_n);
  BEGIN
    UPDATE public.clinical_evolutions
       SET archived_at = NULL, patient_id = p_target_patient_id,
           encounter_id = COALESCE(v_target_encounter_id, encounter_id), updated_at = now()
     WHERE patient_registry_id = v_registry_id AND archived_at IS NOT NULL
       AND archived_at > (now() - interval '15 minutes');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('clinical_evolutions_unarchived', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('unarchive_error', SQLERRM); END;
  UPDATE public.prescriptions
     SET encounter_id = COALESCE(v_target_encounter_id, encounter_id),
         patient_data = jsonb_set(COALESCE(patient_data, '{}'::jsonb), '{id}', to_jsonb(p_target_patient_id::text), true),
         repointed_at = now(), repoint_reason = p_reason, updated_at = now()
   WHERE patient_registry_id = v_registry_id AND archived_at IS NULL
     AND ((patient_data->>'id') = p_source_patient_id::text
          OR (v_source_encounter_id IS NOT NULL AND encounter_id = v_source_encounter_id)
          OR encounter_id IS NULL);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('prescriptions', v_n);
  BEGIN UPDATE public.exam_requests SET patient_id = p_target_patient_id,
      encounter_id = COALESCE(v_target_encounter_id, encounter_id), updated_at = now()
     WHERE patient_id = p_source_patient_id OR (patient_registry_id = v_registry_id
        AND v_source_encounter_id IS NOT NULL AND encounter_id = v_source_encounter_id);
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('exam_requests', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('exam_requests_error', SQLERRM); END;
  BEGIN UPDATE public.culture_results SET patient_id = p_target_patient_id,
      encounter_id = COALESCE(v_target_encounter_id, encounter_id), updated_at = now()
     WHERE patient_id = p_source_patient_id OR (patient_registry_id = v_registry_id
        AND v_source_encounter_id IS NOT NULL AND encounter_id = v_source_encounter_id);
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('culture_results', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('culture_results_error', SQLERRM); END;
  BEGIN UPDATE public.admission_histories SET patient_id = p_target_patient_id, updated_at = now()
     WHERE patient_id = p_source_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('admission_histories', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('admission_histories_error', SQLERRM); END;
  BEGIN UPDATE public.vital_signs SET patient_id = p_target_patient_id,
      encounter_id = COALESCE(v_target_encounter_id, encounter_id), updated_at = now()
     WHERE patient_id = p_source_patient_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('vital_signs', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('vital_signs_error', SQLERRM); END;
  BEGIN UPDATE public.round_sessions SET patient_id = p_target_patient_id,
      encounter_id = COALESCE(v_target_encounter_id, encounter_id), updated_at = now()
     WHERE patient_id = p_source_patient_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('round_sessions', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('round_sessions_error', SQLERRM); END;
  BEGIN UPDATE public.discharge_documents SET patient_id = p_target_patient_id,
      encounter_id = COALESCE(v_target_encounter_id, encounter_id), updated_at = now()
     WHERE patient_id = p_source_patient_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('discharge_documents', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('discharge_documents_error', SQLERRM); END;
  BEGIN UPDATE public.conduct_history SET patient_id = p_target_patient_id WHERE patient_id = p_source_patient_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.medical_records SET patient_id = p_target_patient_id WHERE patient_id = p_source_patient_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.dhd_patients SET patient_id = p_target_patient_id WHERE patient_id = p_source_patient_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.pre_admissions SET patient_id = p_target_patient_id WHERE patient_id = p_source_patient_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.medical_record_edit_history SET patient_id = p_target_patient_id WHERE patient_id = p_source_patient_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.patient_admission_date_history SET patient_id = p_target_patient_id WHERE patient_id = p_source_patient_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.patient_encounters SET patient_id = p_target_patient_id, updated_at = now()
     WHERE patient_id = p_source_patient_id AND status = 'active';
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    INSERT INTO public.patient_movements (patient_id, patient_name, patient_bed, patient_sector,
      movement_type, destination, notes, created_by, department, hospital_unit_id, state_id,
      patient_registry_id, encounter_id, patient_snapshot)
    SELECT p_target_patient_id, COALESCE(t.name, s.name), t.bed_number, t.sector,
      'REPOINT_HISTORY_V4',
      'Histórico clínico migrado de ' || COALESCE(s.bed_number,'?') || ' (' || COALESCE(s.sector,'?')
        || ') para ' || COALESCE(t.bed_number,'?') || ' (' || COALESCE(t.sector,'?') || ')',
      p_reason, v_user, t.department, t.hospital_unit_id, t.state_id,
      v_registry_id, v_target_encounter_id,
      jsonb_build_object('source_patient_id', p_source_patient_id, 'target_patient_id', p_target_patient_id,
        'source_encounter', v_source_encounter_id, 'target_encounter', v_target_encounter_id,
        'registry_id', v_registry_id, 'duplicate_encounters_closed', v_dup_closed,
        'counts', v_counts, 'source', to_jsonb(s), 'target', to_jsonb(t), 'version', 'v4')
    FROM public.patients t LEFT JOIN public.patients s ON s.id = p_source_patient_id
    WHERE t.id = p_target_patient_id;
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('audit_error', SQLERRM); END;
  RETURN jsonb_build_object('success', true, 'source_id', p_source_patient_id,
    'target_id', p_target_patient_id, 'registry_id', v_registry_id,
    'source_encounter', v_source_encounter_id, 'target_encounter', v_target_encounter_id,
    'duplicate_encounters_closed', v_dup_closed, 'counts', v_counts,
    'performed_by', v_user, 'performed_at', now(), 'version', 'v4');
END;
$$;

-- ════════════════════════════════════════════════════════════════════
-- MIGRATION 3/8 — archive_patient_bed_data v2 (não fecha encounters)
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.archive_patient_bed_data(
  p_patient_id uuid,
  p_reason text DEFAULT 'bed_vacated'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_counts jsonb := '{}'::jsonb;
  v_n int;
  v_now timestamptz := now();
BEGIN
  IF p_patient_id IS NULL THEN RAISE EXCEPTION 'p_patient_id é obrigatório'; END IF;
  BEGIN UPDATE public.prescriptions SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE archived_at IS NULL AND (patient_data->>'id')::uuid = p_patient_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('prescriptions', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('prescriptions_error', SQLERRM); END;
  BEGIN UPDATE public.clinical_evolutions SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE patient_id = p_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('clinical_evolutions', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('clinical_evolutions_error', SQLERRM); END;
  BEGIN UPDATE public.vital_signs SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE patient_id = p_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('vital_signs', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('vital_signs_error', SQLERRM); END;
  BEGIN UPDATE public.exam_requests SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE patient_id = p_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('exam_requests', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('exam_requests_error', SQLERRM); END;
  BEGIN UPDATE public.culture_results SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE patient_id = p_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('culture_results', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('culture_results_error', SQLERRM); END;
  BEGIN UPDATE public.medical_records SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE patient_id = p_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('medical_records', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('medical_records_error', SQLERRM); END;
  BEGIN UPDATE public.saps3_assessments SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE patient_id = p_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('saps3_assessments', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('saps3_assessments_error', SQLERRM); END;
  BEGIN UPDATE public.conduct_history SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE patient_id = p_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('conduct_history', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('conduct_history_error', SQLERRM); END;
  BEGIN UPDATE public.round_sessions SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE patient_id = p_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('round_sessions', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('round_sessions_error', SQLERRM); END;
  BEGIN UPDATE public.admission_histories SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE patient_id = p_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('admission_histories', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('admission_histories_error', SQLERRM); END;
  BEGIN UPDATE public.discharge_documents SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE patient_id = p_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('discharge_documents', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('discharge_documents_error', SQLERRM); END;
  BEGIN UPDATE public.sepsis_protocols SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE patient_id = p_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('sepsis_protocols', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('sepsis_protocols_error', SQLERRM); END;
  -- v2: bloco patient_encounters removido intencionalmente
  BEGIN
    INSERT INTO public.audit_logs (action, table_name, record_id, performed_by, performed_at, metadata)
    VALUES ('ARCHIVE_PATIENT_BED_DATA', 'patients', p_patient_id, auth.uid(), v_now,
            jsonb_build_object('reason', p_reason, 'counts', v_counts));
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN jsonb_build_object('success', true, 'patient_id', p_patient_id,
    'archived_at', v_now, 'reason', p_reason, 'counts', v_counts);
END;
$$;
GRANT EXECUTE ON FUNCTION public.archive_patient_bed_data(uuid, text) TO authenticated;

-- ════════════════════════════════════════════════════════════════════
-- MIGRATION 4/8 — execute_internal_transfer_atomic (NOVA)
-- ════════════════════════════════════════════════════════════════════
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
  UPDATE public.patients SET
    name = v_source.name, age = v_source.age, diagnoses = v_source.diagnoses,
    medical_history = v_source.medical_history, relevant_exams = v_source.relevant_exams,
    pendencies = v_source.pendencies, schedule = v_source.schedule,
    admission_date = v_source.admission_date,
    highlighted_diagnoses = v_source.highlighted_diagnoses,
    highlighted_medical_history = v_source.highlighted_medical_history,
    highlighted_pendencies = v_source.highlighted_pendencies,
    highlighted_conducts = v_source.highlighted_conducts,
    uti_admission_date = v_source.uti_admission_date,
    uti_discharge_prediction = v_source.uti_discharge_prediction,
    uti_allergies = v_source.uti_allergies,
    uti_admission_reason = v_source.uti_admission_reason,
    uti_current_status = v_source.uti_current_status,
    uti_devices = v_source.uti_devices,
    uti_cultures_antibiotics = v_source.uti_cultures_antibiotics,
    uti_specialties = v_source.uti_specialties,
    uti_origin_sector = v_source.uti_origin_sector,
    uti_daily_conducts = v_source.uti_daily_conducts,
    clinical_status = v_source.clinical_status,
    psm_status = v_source.psm_status,
    admission_history = CASE WHEN p_needs_new_admission THEN NULL ELSE v_source.admission_history END,
    patient_registry_id = v_source.patient_registry_id,
    medical_record = v_source.medical_record,
    admission_status = v_destination_status,
    admitted_at = CASE WHEN p_needs_new_admission THEN NULL ELSE v_source.admitted_at END,
    is_vacant = false, updated_at = now()
  WHERE id = p_target_patient_id;
  PERFORM public.repoint_patient_history(p_source_patient_id, p_target_patient_id, p_reason);
  UPDATE public.patients SET
    name = '', age = NULL, diagnoses = NULL, medical_history = NULL, relevant_exams = NULL,
    pendencies = NULL, schedule = NULL, admission_history = NULL, admission_date = NULL,
    highlighted_diagnoses = NULL, highlighted_medical_history = NULL,
    highlighted_pendencies = NULL, highlighted_conducts = NULL,
    uti_admission_date = NULL, uti_discharge_prediction = NULL, uti_allergies = NULL,
    uti_admission_reason = NULL, uti_current_status = NULL, uti_devices = NULL,
    uti_cultures_antibiotics = NULL, uti_specialties = NULL, uti_origin_sector = NULL,
    uti_daily_conducts = NULL, clinical_status = NULL, psm_status = NULL,
    admission_status = NULL, patient_registry_id = NULL, medical_record = NULL,
    admitted_at = NULL, is_vacant = true, updated_at = now()
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

-- ════════════════════════════════════════════════════════════════════
-- MIGRATION 5/8 — execute_operational_relocation_atomic (NOVA)
-- ════════════════════════════════════════════════════════════════════
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
  UPDATE public.patients SET
    name = v_source.name, age = v_source.age, diagnoses = v_source.diagnoses,
    medical_history = v_source.medical_history, relevant_exams = v_source.relevant_exams,
    pendencies = v_source.pendencies, schedule = v_source.schedule,
    admission_history = v_source.admission_history, admission_date = v_source.admission_date,
    highlighted_diagnoses = v_source.highlighted_diagnoses,
    highlighted_medical_history = v_source.highlighted_medical_history,
    highlighted_pendencies = v_source.highlighted_pendencies,
    highlighted_conducts = v_source.highlighted_conducts,
    medical_responsibility = v_source.medical_responsibility,
    uti_admission_date = v_source.uti_admission_date,
    uti_discharge_prediction = v_source.uti_discharge_prediction,
    uti_allergies = v_source.uti_allergies, uti_admission_reason = v_source.uti_admission_reason,
    uti_current_status = v_source.uti_current_status, uti_devices = v_source.uti_devices,
    uti_cultures_antibiotics = v_source.uti_cultures_antibiotics,
    uti_specialties = v_source.uti_specialties, uti_origin_sector = v_source.uti_origin_sector,
    uti_daily_conducts = v_source.uti_daily_conducts, uti_weight_kg = v_source.uti_weight_kg,
    internment_status = v_source.internment_status, internment_notes = v_source.internment_notes,
    clinical_status = v_source.clinical_status, psm_status = v_source.psm_status,
    patient_registry_id = v_source.patient_registry_id, medical_record = v_source.medical_record,
    admission_status = v_source.admission_status, admitted_at = v_source.admitted_at,
    is_vacant = false, updated_at = now()
  WHERE id = p_target_patient_id;
  PERFORM public.repoint_patient_history(p_source_patient_id, p_target_patient_id,
    'Remanejamento operacional: ' || p_reason);
  PERFORM public.archive_patient_bed_data(p_source_patient_id, 'operational_relocation_source_release');
  UPDATE public.patients SET
    name = '', age = NULL, diagnoses = NULL, medical_history = NULL, relevant_exams = NULL,
    pendencies = NULL, schedule = NULL, admission_history = NULL, admission_date = NULL,
    highlighted_diagnoses = NULL, highlighted_medical_history = NULL,
    highlighted_pendencies = NULL, highlighted_conducts = NULL, medical_responsibility = NULL,
    uti_admission_date = NULL, uti_discharge_prediction = NULL, uti_allergies = NULL,
    uti_admission_reason = NULL, uti_current_status = NULL, uti_devices = NULL,
    uti_cultures_antibiotics = NULL, uti_specialties = NULL, uti_origin_sector = NULL,
    uti_daily_conducts = NULL, uti_weight_kg = NULL, internment_status = NULL,
    internment_notes = NULL, clinical_status = NULL, psm_status = NULL,
    patient_registry_id = NULL, medical_record = NULL, admission_status = NULL,
    admitted_at = NULL, is_vacant = true, updated_at = now()
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

-- ════════════════════════════════════════════════════════════════════
-- MIGRATION 6/8 — signal_internal_transfer_atomic (NOVA)
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.signal_internal_transfer_atomic(
  p_source_patient_id   uuid,
  p_snapshot            jsonb,
  p_target_sector_code  text,
  p_hospital_unit_id    uuid,
  p_state_id            uuid,
  p_encounter_code      text    DEFAULT NULL,
  p_target_sector_label text    DEFAULT NULL,
  p_classification      text    DEFAULT NULL,
  p_requires_saps       boolean DEFAULT false,
  p_reason              text    DEFAULT NULL,
  p_signaled_by         uuid    DEFAULT NULL,
  p_department          text    DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_request_id uuid;
  v_source     public.patients%ROWTYPE;
BEGIN
  IF p_source_patient_id IS NULL THEN RAISE EXCEPTION 'source_patient_id é obrigatório'; END IF;
  IF p_target_sector_code IS NULL OR p_target_sector_code = '' THEN
    RAISE EXCEPTION 'target_sector_code é obrigatório';
  END IF;
  SELECT * INTO v_source FROM public.patients WHERE id = p_source_patient_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Leito de origem não encontrado: %', p_source_patient_id; END IF;
  INSERT INTO public.internal_transfer_requests (source_patient_id, source_bed, source_sector,
    patient_name, patient_snapshot, encounter_code, target_sector_code, target_sector_label,
    classification, requires_saps, reason, status, signaled_by, hospital_unit_id, state_id, department)
  VALUES (p_source_patient_id, v_source.bed_number, v_source.sector, v_source.name, p_snapshot,
    p_encounter_code, p_target_sector_code, COALESCE(p_target_sector_label, p_target_sector_code),
    p_classification, p_requires_saps, p_reason, 'pending', p_signaled_by,
    p_hospital_unit_id, p_state_id, p_department)
  RETURNING id INTO v_request_id;
  UPDATE public.patients SET
    name = '', age = NULL, diagnoses = NULL, medical_history = NULL, relevant_exams = NULL,
    pendencies = NULL, schedule = NULL, admission_history = NULL, admission_date = NULL,
    highlighted_diagnoses = NULL, highlighted_medical_history = NULL,
    highlighted_pendencies = NULL, highlighted_conducts = NULL,
    uti_admission_date = NULL, uti_discharge_prediction = NULL, uti_allergies = NULL,
    uti_admission_reason = NULL, uti_current_status = NULL, uti_devices = NULL,
    uti_cultures_antibiotics = NULL, uti_specialties = NULL, uti_origin_sector = NULL,
    uti_daily_conducts = NULL, clinical_status = NULL, psm_status = NULL,
    admission_status = NULL, patient_registry_id = NULL, medical_record = NULL,
    admitted_at = NULL, is_vacant = true, updated_at = now()
  WHERE id = p_source_patient_id;
  BEGIN
    INSERT INTO public.patient_movements (patient_id, patient_name, patient_bed, patient_sector,
      patient_registry_id, movement_type, destination, notes, created_by, department,
      state_id, hospital_unit_id, patient_snapshot)
    VALUES (p_source_patient_id, v_source.name, v_source.bed_number, v_source.sector,
      v_source.patient_registry_id, 'TRANSFERÊNCIA INTERNA — SINALIZADA',
      COALESCE(p_target_sector_label, p_target_sector_code),
      'Etapa 1/2 — Sinalização para ' || COALESCE(p_target_sector_label, p_target_sector_code)
        || ' (' || COALESCE(p_classification, 'N/A') || ')'
        || CASE WHEN p_requires_saps THEN ' — escalada crítica: exigirá SAPS 3 após alocação' ELSE '' END
        || COALESCE(' | Motivo: ' || p_reason, ''),
      p_signaled_by, p_department, p_state_id, p_hospital_unit_id, to_jsonb(v_source));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[signal_internal_transfer_atomic] falha audit: %', SQLERRM;
  END;
  RETURN jsonb_build_object('success', true, 'request_id', v_request_id, 'source_id', p_source_patient_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.signal_internal_transfer_atomic(
  uuid, jsonb, text, uuid, uuid, text, text, text, boolean, text, uuid, text
) TO authenticated;

-- ════════════════════════════════════════════════════════════════════
-- MIGRATION 7/8 — complete_internal_transfer_atomic (NOVA)
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.complete_internal_transfer_atomic(
  p_request_id        uuid,
  p_target_patient_id uuid,
  p_destination       jsonb,
  p_hospital_unit_id  uuid,
  p_state_id          uuid,
  p_repoint_reason    text DEFAULT NULL,
  p_current_user_id   uuid DEFAULT NULL,
  p_department        text DEFAULT NULL
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
    highlighted_diagnoses = (p_destination->>'highlighted_diagnoses'),
    highlighted_medical_history = (p_destination->>'highlighted_medical_history'),
    highlighted_pendencies = (p_destination->>'highlighted_pendencies'),
    highlighted_conducts = (p_destination->>'highlighted_conducts'),
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
GRANT EXECUTE ON FUNCTION public.complete_internal_transfer_atomic(
  uuid, uuid, jsonb, uuid, uuid, text, uuid, text
) TO authenticated;

-- ════════════════════════════════════════════════════════════════════
-- MIGRATION 8/8 — fix merge_patient_registries (restaura repoints)
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.merge_patient_registries(
  p_winner_id uuid,
  p_loser_id uuid,
  p_predominant_medical_record_id uuid,
  p_field_choices jsonb,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_winner public.patient_registry%ROWTYPE;
  v_loser  public.patient_registry%ROWTYPE;
  v_winner_patients int;
  v_loser_patients int;
  v_counts jsonb := '{}'::jsonb;
  v_n int;
  v_caller_role text;
  v_caller_profile text;
  v_allowed boolean;
  v_field text;
  v_choice text;
  v_old text;
  v_winner_val jsonb;
  v_loser_val  jsonb;
  v_final_val  text;
  v_archived jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT role::text INTO v_caller_role FROM public.user_roles WHERE user_id = v_user LIMIT 1;
  SELECT access_profile INTO v_caller_profile FROM public.profiles WHERE id = v_user LIMIT 1;
  v_allowed := (v_caller_role = 'admin'
    OR v_caller_profile IN ('gestor','recepcao','recepcionista')
    OR public.is_developer_profile(v_user));
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Operação restrita a admin, gestor ou recepção' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_winner_id IS NULL OR p_loser_id IS NULL THEN RAISE EXCEPTION 'winner_id e loser_id são obrigatórios'; END IF;
  IF p_winner_id = p_loser_id THEN RAISE EXCEPTION 'Vencedor e perdedor não podem ser o mesmo registro'; END IF;
  IF COALESCE(length(trim(p_reason)), 0) < 10 THEN RAISE EXCEPTION 'Motivo obrigatório (mínimo 10 caracteres)'; END IF;
  SELECT * INTO v_winner FROM public.patient_registry WHERE id = p_winner_id FOR UPDATE;
  SELECT * INTO v_loser  FROM public.patient_registry WHERE id = p_loser_id FOR UPDATE;
  IF v_winner.id IS NULL OR v_loser.id IS NULL THEN RAISE EXCEPTION 'Registry não encontrado'; END IF;
  IF v_winner.merged_into_registry_id IS NOT NULL OR v_loser.merged_into_registry_id IS NOT NULL THEN
    RAISE EXCEPTION 'Um dos registros já foi mesclado anteriormente';
  END IF;
  SELECT count(*) INTO v_winner_patients FROM public.patients
    WHERE patient_registry_id = p_winner_id AND bed_number IS NOT NULL AND bed_number <> '';
  SELECT count(*) INTO v_loser_patients FROM public.patients
    WHERE patient_registry_id = p_loser_id AND bed_number IS NOT NULL AND bed_number <> '';
  IF v_winner_patients > 0 AND v_loser_patients > 0 THEN
    RAISE EXCEPTION 'Ambos os registros têm paciente alocado em leito. Libere um antes de mesclar.';
  END IF;
  SELECT email INTO v_email FROM public.profiles WHERE id = v_user;
  IF p_field_choices IS NOT NULL THEN
    FOR v_field, v_choice IN SELECT key, value::text FROM jsonb_each_text(p_field_choices) LOOP
      EXECUTE format('SELECT to_jsonb(%I) FROM public.patient_registry WHERE id = $1', v_field) INTO v_winner_val USING p_winner_id;
      EXECUTE format('SELECT to_jsonb(%I) FROM public.patient_registry WHERE id = $1', v_field) INTO v_loser_val USING p_loser_id;
      v_old := v_winner_val #>> '{}';
      IF v_choice = 'loser' THEN v_final_val := v_loser_val #>> '{}';
      ELSIF v_choice = 'empty' THEN v_final_val := NULL;
      ELSE v_final_val := v_winner_val #>> '{}'; END IF;
      IF v_choice IN ('loser','empty') AND v_old IS DISTINCT FROM v_final_val THEN
        IF v_field IN ('cpf','cns') AND v_final_val IS NOT NULL THEN
          EXECUTE format('UPDATE public.patient_registry SET %I = NULL WHERE id = $1', v_field) USING p_loser_id;
        END IF;
        EXECUTE format('UPDATE public.patient_registry SET %I = $1, updated_at = now() WHERE id = $2', v_field) USING v_final_val, p_winner_id;
        INSERT INTO public.patient_registry_edit_history (patient_registry_id, field_changed, old_value, new_value, reason, source, changed_by, changed_by_email)
        VALUES (p_winner_id, v_field, v_old, v_final_val, 'merge:' || p_reason, 'merge', v_user, v_email);
      END IF;
    END LOOP;
  END IF;
  UPDATE public.patients SET patient_registry_id = p_winner_id WHERE patient_registry_id = p_loser_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('patients', v_n);
  UPDATE public.clinical_evolutions SET patient_registry_id = p_winner_id WHERE patient_registry_id = p_loser_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('evolutions', v_n);
  UPDATE public.prescriptions SET patient_registry_id = p_winner_id WHERE patient_registry_id = p_loser_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('prescriptions', v_n);
  UPDATE public.exam_requests SET patient_registry_id = p_winner_id WHERE patient_registry_id = p_loser_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('exams', v_n);
  UPDATE public.culture_results SET patient_registry_id = p_winner_id WHERE patient_registry_id = p_loser_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('cultures', v_n);
  UPDATE public.admission_histories SET patient_registry_id = p_winner_id WHERE patient_registry_id = p_loser_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('admission_histories', v_n);
  UPDATE public.conduct_history SET patient_registry_id = p_winner_id WHERE patient_registry_id = p_loser_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('conduct_history', v_n);
  UPDATE public.patient_movements SET patient_registry_id = p_winner_id WHERE patient_registry_id = p_loser_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('movements', v_n);
  UPDATE public.dhd_patients SET patient_registry_id = p_winner_id WHERE patient_registry_id = p_loser_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('dhd', v_n);
  UPDATE public.pre_admissions SET patient_registry_id = p_winner_id WHERE patient_registry_id = p_loser_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('pre_admissions', v_n);
  UPDATE public.discharge_documents SET patient_registry_id = p_winner_id WHERE patient_registry_id = p_loser_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('discharge_documents', v_n);
  UPDATE public.patient_encounters SET registry_id = p_winner_id WHERE registry_id = p_loser_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('encounters', v_n);
  UPDATE public.medical_records SET patient_registry_id = p_winner_id WHERE patient_registry_id = p_loser_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('medical_records', v_n);
  UPDATE public.medical_record_edit_history SET patient_registry_id = p_winner_id WHERE patient_registry_id = p_loser_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('medical_record_history', v_n);
  UPDATE public.patient_registry_edit_history SET patient_registry_id = p_winner_id WHERE patient_registry_id = p_loser_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('registry_history', v_n);
  UPDATE public.patient_admission_date_history SET patient_registry_id = p_winner_id WHERE patient_registry_id = p_loser_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('admission_date_history', v_n);
  BEGIN
    UPDATE public.regulatory_guides SET patient_registry_id = p_winner_id WHERE patient_registry_id = p_loser_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('regulatory_guides', v_n);
  EXCEPTION WHEN undefined_table THEN NULL; END;
  v_archived := to_jsonb(v_loser) || jsonb_build_object(
    'merged_at_iso', now(), 'merged_by', v_user, 'merged_by_email', v_email,
    'merge_reason', p_reason, 'reassign_counts', v_counts);
  UPDATE public.patient_registry
     SET cpf = NULL, cns = NULL, merge_archive = v_archived,
         merged_into_registry_id = p_winner_id, merged_at = now(),
         merged_by = v_user, updated_at = now()
   WHERE id = p_loser_id;
  INSERT INTO public.patient_merge_audit (source_registry_id, target_registry_id, action,
    source_snapshot, target_snapshot, payload, performed_by, performed_by_email)
  VALUES (p_loser_id, p_winner_id, 'merge', to_jsonb(v_loser), to_jsonb(v_winner),
    jsonb_build_object('reason', p_reason, 'field_choices', p_field_choices,
      'predominant_medical_record_id', p_predominant_medical_record_id,
      'reassign_counts', v_counts, 'archived_loser', v_archived,
      'fix_version', '20260604280000'),
    v_user, v_email);
  RETURN jsonb_build_object('ok', true, 'winner_id', p_winner_id, 'loser_id', p_loser_id, 'counts', v_counts);
END;
$function$;