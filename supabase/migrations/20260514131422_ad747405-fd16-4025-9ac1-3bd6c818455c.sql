-- repoint_patient_history: transfere histórico clínico vinculado por patient_id
CREATE OR REPLACE FUNCTION public.repoint_patient_history(
  p_source_patient_id uuid,
  p_target_patient_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_counts jsonb := '{}'::jsonb;
  v_n int;
BEGIN
  IF p_source_patient_id IS NULL OR p_target_patient_id IS NULL THEN
    RAISE EXCEPTION 'source e target patient_id são obrigatórios';
  END IF;
  IF p_source_patient_id = p_target_patient_id THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'source = target');
  END IF;

  BEGIN
    UPDATE public.clinical_evolutions SET patient_id = p_target_patient_id
      WHERE patient_id = p_source_patient_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('clinical_evolutions', v_n);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    UPDATE public.prescriptions
      SET patient_data = jsonb_set(patient_data, '{id}', to_jsonb(p_target_patient_id::text), true)
      WHERE (patient_data->>'id')::uuid = p_source_patient_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('prescriptions', v_n);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    UPDATE public.exam_requests SET patient_id = p_target_patient_id
      WHERE patient_id = p_source_patient_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('exam_requests', v_n);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    UPDATE public.culture_results SET patient_id = p_target_patient_id
      WHERE patient_id = p_source_patient_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('culture_results', v_n);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    UPDATE public.admission_histories SET patient_id = p_target_patient_id
      WHERE patient_id = p_source_patient_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('admission_histories', v_n);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    UPDATE public.conduct_history SET patient_id = p_target_patient_id
      WHERE patient_id = p_source_patient_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('conduct_history', v_n);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    UPDATE public.dhd_patients SET patient_id = p_target_patient_id
      WHERE patient_id = p_source_patient_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('dhd_patients', v_n);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    UPDATE public.medical_records SET patient_id = p_target_patient_id
      WHERE patient_id = p_source_patient_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('medical_records', v_n);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    UPDATE public.patient_encounters SET patient_id = p_target_patient_id
      WHERE patient_id = p_source_patient_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('patient_encounters', v_n);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    UPDATE public.pre_admissions SET patient_id = p_target_patient_id
      WHERE patient_id = p_source_patient_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('pre_admissions', v_n);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    UPDATE public.discharge_documents SET patient_id = p_target_patient_id
      WHERE patient_id = p_source_patient_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('discharge_documents', v_n);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    UPDATE public.medical_record_edit_history SET patient_id = p_target_patient_id
      WHERE patient_id = p_source_patient_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('medical_record_edit_history', v_n);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    UPDATE public.patient_admission_date_history SET patient_id = p_target_patient_id
      WHERE patient_id = p_source_patient_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('patient_admission_date_history', v_n);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Auditoria: registra evento na timeline de movimentações
  BEGIN
    INSERT INTO public.patient_movements (
      patient_id, patient_name, patient_bed, patient_sector,
      movement_type, destination, notes, responsible_doctor, created_by,
      department, hospital_unit_id, state_id, patient_snapshot
    )
    SELECT
      p_target_patient_id, COALESCE(t.name, s.name), t.bed_number, t.sector,
      'REPOINT_HISTORY',
      'Histórico clínico migrado de ' || s.bed_number || ' (' || s.sector || ') para ' || t.bed_number || ' (' || t.sector || ')',
      COALESCE(p_reason, 'Transferência interna sem alta — histórico preservado.'),
      NULL, v_user, t.department, t.hospital_unit_id, t.state_id,
      jsonb_build_object('source', to_jsonb(s), 'target', to_jsonb(t), 'counts', v_counts)
    FROM public.patients t
    LEFT JOIN public.patients s ON s.id = p_source_patient_id
    WHERE t.id = p_target_patient_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'success', true,
    'source_id', p_source_patient_id,
    'target_id', p_target_patient_id,
    'counts', v_counts,
    'performed_by', v_user,
    'performed_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.repoint_patient_history(uuid, uuid, text) TO authenticated;