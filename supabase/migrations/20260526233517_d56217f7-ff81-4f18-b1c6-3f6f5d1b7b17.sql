-- Fix Bug A: autolink só age quando NÃO há registry_id nem patient_id
CREATE OR REPLACE FUNCTION public.autolink_encounter_patient_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ids uuid[];
BEGIN
  IF NEW.patient_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.registry_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.patient_name IS NULL OR length(trim(NEW.patient_name)) = 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.hospital_unit_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(p.id)
    INTO v_ids
  FROM (
    SELECT id
      FROM public.patients
     WHERE upper(name) = upper(NEW.patient_name)
       AND hospital_unit_id = NEW.hospital_unit_id
       AND is_vacant = false
     LIMIT 2
  ) p;

  IF v_ids IS NOT NULL AND array_length(v_ids, 1) = 1 THEN
    NEW.patient_id := v_ids[1];
  END IF;

  RETURN NEW;
END;
$function$;

-- Fix Bug A (complementar): fechar encounters ativos ao arquivar dados do leito
CREATE OR REPLACE FUNCTION public.archive_patient_bed_data(
  p_patient_id uuid,
  p_reason text DEFAULT 'bed_vacated'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_counts jsonb := '{}'::jsonb;
  v_n int;
  v_now timestamptz := now();
BEGIN
  IF p_patient_id IS NULL THEN
    RAISE EXCEPTION 'p_patient_id é obrigatório';
  END IF;

  BEGIN
    UPDATE public.prescriptions
       SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE archived_at IS NULL AND (patient_data->>'id')::uuid = p_patient_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('prescriptions', v_n);
  EXCEPTION WHEN OTHERS THEN
    v_counts := v_counts || jsonb_build_object('prescriptions_error', SQLERRM);
  END;

  BEGIN
    UPDATE public.clinical_evolutions
       SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE patient_id = p_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('clinical_evolutions', v_n);
  EXCEPTION WHEN OTHERS THEN
    v_counts := v_counts || jsonb_build_object('clinical_evolutions_error', SQLERRM);
  END;

  BEGIN
    UPDATE public.vital_signs
       SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE patient_id = p_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('vital_signs', v_n);
  EXCEPTION WHEN OTHERS THEN
    v_counts := v_counts || jsonb_build_object('vital_signs_error', SQLERRM);
  END;

  BEGIN
    UPDATE public.exam_requests
       SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE patient_id = p_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('exam_requests', v_n);
  EXCEPTION WHEN OTHERS THEN
    v_counts := v_counts || jsonb_build_object('exam_requests_error', SQLERRM);
  END;

  BEGIN
    UPDATE public.culture_results
       SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE patient_id = p_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('culture_results', v_n);
  EXCEPTION WHEN OTHERS THEN
    v_counts := v_counts || jsonb_build_object('culture_results_error', SQLERRM);
  END;

  BEGIN
    UPDATE public.medical_records
       SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE patient_id = p_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('medical_records', v_n);
  EXCEPTION WHEN OTHERS THEN
    v_counts := v_counts || jsonb_build_object('medical_records_error', SQLERRM);
  END;

  BEGIN
    UPDATE public.saps3_assessments
       SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE patient_id = p_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('saps3_assessments', v_n);
  EXCEPTION WHEN OTHERS THEN
    v_counts := v_counts || jsonb_build_object('saps3_assessments_error', SQLERRM);
  END;

  BEGIN
    UPDATE public.conduct_history
       SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE patient_id = p_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('conduct_history', v_n);
  EXCEPTION WHEN OTHERS THEN
    v_counts := v_counts || jsonb_build_object('conduct_history_error', SQLERRM);
  END;

  BEGIN
    UPDATE public.round_sessions
       SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE patient_id = p_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('round_sessions', v_n);
  EXCEPTION WHEN OTHERS THEN
    v_counts := v_counts || jsonb_build_object('round_sessions_error', SQLERRM);
  END;

  BEGIN
    UPDATE public.admission_histories
       SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE patient_id = p_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('admission_histories', v_n);
  EXCEPTION WHEN OTHERS THEN
    v_counts := v_counts || jsonb_build_object('admission_histories_error', SQLERRM);
  END;

  BEGIN
    UPDATE public.discharge_documents
       SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE patient_id = p_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('discharge_documents', v_n);
  EXCEPTION WHEN OTHERS THEN
    v_counts := v_counts || jsonb_build_object('discharge_documents_error', SQLERRM);
  END;

  BEGIN
    UPDATE public.sepsis_protocols
       SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE patient_id = p_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('sepsis_protocols', v_n);
  EXCEPTION WHEN OTHERS THEN
    v_counts := v_counts || jsonb_build_object('sepsis_protocols_error', SQLERRM);
  END;

  BEGIN
    UPDATE public.patient_encounters
       SET status = 'closed',
           discharge_date = COALESCE(discharge_date, v_now),
           updated_at = v_now
     WHERE patient_id = p_patient_id
       AND COALESCE(status, 'active') <> 'closed';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('encounters_closed', v_n);
  EXCEPTION WHEN OTHERS THEN
    v_counts := v_counts || jsonb_build_object('encounters_closed_error', SQLERRM);
  END;

  BEGIN
    INSERT INTO public.audit_logs (action, table_name, record_id, performed_by, performed_at, metadata)
    VALUES ('ARCHIVE_PATIENT_BED_DATA', 'patients', p_patient_id, auth.uid(), v_now,
            jsonb_build_object('reason', p_reason, 'counts', v_counts));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'success', true, 'patient_id', p_patient_id,
    'archived_at', v_now, 'reason', p_reason, 'counts', v_counts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.archive_patient_bed_data(uuid, text) TO authenticated;