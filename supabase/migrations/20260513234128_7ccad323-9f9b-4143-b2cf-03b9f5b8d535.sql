
-- Helper: caller has 'desenvolvedor' in access_profiles
CREATE OR REPLACE FUNCTION public.is_developer_profile(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND 'desenvolvedor' = ANY(COALESCE(access_profiles, ARRAY[]::text[]))
  );
$$;

-- Hard delete em cascata. Restrita ao perfil 'desenvolvedor'.
CREATE OR REPLACE FUNCTION public.admin_hard_delete_patient(
  p_patient_id uuid,
  p_registry_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_registry uuid;
  v_deleted jsonb := '{}'::jsonb;
  v_count int;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  IF NOT public.is_developer_profile(v_caller) THEN
    RAISE EXCEPTION 'Operação restrita ao perfil desenvolvedor.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF COALESCE(trim(p_reason), '') = '' OR length(trim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Motivo obrigatório (mínimo 10 caracteres).';
  END IF;
  IF p_patient_id IS NULL AND p_registry_id IS NULL THEN
    RAISE EXCEPTION 'patient_id ou registry_id é obrigatório';
  END IF;

  -- Resolve registry
  v_registry := p_registry_id;
  IF v_registry IS NULL AND p_patient_id IS NOT NULL THEN
    SELECT patient_registry_id INTO v_registry FROM public.patients WHERE id = p_patient_id;
  END IF;

  -- Helper inline para cada tabela: tenta deletar e ignora se tabela/coluna não existe
  -- Usamos blocos EXCEPTION individuais via DO dinâmico é complexo; fazemos chamadas diretas.

  -- Por patient_id
  IF p_patient_id IS NOT NULL THEN
    BEGIN DELETE FROM public.clinical_evolutions WHERE patient_id = p_patient_id; GET DIAGNOSTICS v_count = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('clinical_evolutions', v_count); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.exam_requests WHERE patient_id = p_patient_id; GET DIAGNOSTICS v_count = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('exam_requests', v_count); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.culture_results WHERE patient_id = p_patient_id; GET DIAGNOSTICS v_count = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('culture_results', v_count); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.admission_histories WHERE patient_id = p_patient_id; GET DIAGNOSTICS v_count = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('admission_histories', v_count); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.conduct_history WHERE patient_id = p_patient_id; GET DIAGNOSTICS v_count = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('conduct_history', v_count); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.patient_movements WHERE patient_id = p_patient_id; GET DIAGNOSTICS v_count = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('patient_movements', v_count); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.patient_versions WHERE (snapshot_data->'patient'->>'id')::uuid = p_patient_id; GET DIAGNOSTICS v_count = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('patient_versions', v_count); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.medical_record_edit_history WHERE patient_id = p_patient_id; GET DIAGNOSTICS v_count = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('medical_record_edit_history', v_count); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.patient_registry_edit_history WHERE patient_id = p_patient_id; GET DIAGNOSTICS v_count = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('patient_registry_edit_history', v_count); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.patient_admission_date_history WHERE patient_id = p_patient_id; GET DIAGNOSTICS v_count = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('patient_admission_date_history', v_count); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.pre_admissions WHERE patient_id = p_patient_id; GET DIAGNOSTICS v_count = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('pre_admissions', v_count); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.dhd_patients WHERE patient_id = p_patient_id; GET DIAGNOSTICS v_count = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('dhd_patients', v_count); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.prescriptions WHERE (patient_data->>'id')::uuid = p_patient_id; GET DIAGNOSTICS v_count = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('prescriptions', v_count); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.medical_records WHERE patient_id = p_patient_id; GET DIAGNOSTICS v_count = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('medical_records', v_count); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.patient_encounters WHERE patient_id = p_patient_id; GET DIAGNOSTICS v_count = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('patient_encounters', v_count); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.patients WHERE id = p_patient_id; GET DIAGNOSTICS v_count = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('patients', v_count); EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  -- Por registry_id (limpeza adicional caso registros órfãos existam)
  IF v_registry IS NOT NULL THEN
    BEGIN DELETE FROM public.clinical_evolutions WHERE patient_registry_id = v_registry; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.exam_requests WHERE patient_registry_id = v_registry; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.culture_results WHERE patient_registry_id = v_registry; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.admission_histories WHERE patient_registry_id = v_registry; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.conduct_history WHERE patient_registry_id = v_registry; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.patient_movements WHERE patient_registry_id = v_registry; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.medical_record_edit_history WHERE patient_registry_id = v_registry; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.patient_registry_edit_history WHERE patient_registry_id = v_registry; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.patient_merge_audit WHERE source_registry_id = v_registry OR target_registry_id = v_registry; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.dhd_patients WHERE patient_registry_id = v_registry; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.medical_records WHERE patient_registry_id = v_registry; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.patient_encounters WHERE registry_id = v_registry; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.pre_admissions WHERE patient_registry_id = v_registry; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.patients WHERE patient_registry_id = v_registry; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.patient_registry WHERE id = v_registry; GET DIAGNOSTICS v_count = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('patient_registry', v_count); EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'patient_id', p_patient_id,
    'registry_id', v_registry,
    'reason', p_reason,
    'deleted_by', v_caller,
    'deleted_at', now(),
    'counts', v_deleted
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_hard_delete_patient(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_hard_delete_patient(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_developer_profile(uuid) TO authenticated;
