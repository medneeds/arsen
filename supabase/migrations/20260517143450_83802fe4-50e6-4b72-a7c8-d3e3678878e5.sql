-- 1) Flag is_primary em medical_records (default true para não quebrar nada existente)
ALTER TABLE public.medical_records
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_medical_records_is_primary
  ON public.medical_records(patient_registry_id, is_primary);

-- 2) Coluna notes em patient_registry (caso não exista) — usada para arquivar CPF/CNS liberados
ALTER TABLE public.patient_registry
  ADD COLUMN IF NOT EXISTS notes jsonb;

-- 3) RPC merge_patient_registries
CREATE OR REPLACE FUNCTION public.merge_patient_registries(
  p_winner_id uuid,
  p_loser_id uuid,
  p_predominant_medical_record_id uuid,
  p_field_choices jsonb,           -- ex: {"full_name":"loser","phone":"winner","address":"empty"}
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  v_new text;
  v_update_sql text;
  v_winner_val jsonb;
  v_loser_val  jsonb;
  v_final_val  text;
  v_archived jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Autorização: admin, gestor ou recepção
  SELECT role::text INTO v_caller_role FROM public.user_roles WHERE user_id = v_user LIMIT 1;
  SELECT access_profile INTO v_caller_profile FROM public.profiles WHERE id = v_user LIMIT 1;
  v_allowed := (
    v_caller_role = 'admin'
    OR v_caller_profile IN ('gestor','recepcao','recepcionista')
    OR public.is_developer_profile(v_user)
  );
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Operação restrita a admin, gestor ou recepção' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_winner_id IS NULL OR p_loser_id IS NULL THEN
    RAISE EXCEPTION 'winner_id e loser_id são obrigatórios';
  END IF;
  IF p_winner_id = p_loser_id THEN
    RAISE EXCEPTION 'Vencedor e perdedor não podem ser o mesmo registro';
  END IF;
  IF COALESCE(length(trim(p_reason)), 0) < 10 THEN
    RAISE EXCEPTION 'Motivo obrigatório (mínimo 10 caracteres)';
  END IF;

  SELECT * INTO v_winner FROM public.patient_registry WHERE id = p_winner_id;
  SELECT * INTO v_loser  FROM public.patient_registry WHERE id = p_loser_id;
  IF v_winner.id IS NULL OR v_loser.id IS NULL THEN
    RAISE EXCEPTION 'Registry não encontrado';
  END IF;
  IF v_winner.merged_into_registry_id IS NOT NULL OR v_loser.merged_into_registry_id IS NOT NULL THEN
    RAISE EXCEPTION 'Um dos registros já foi mesclado anteriormente';
  END IF;

  -- Bloqueio: 2 pacientes ativos em leitos diferentes
  SELECT count(*) INTO v_winner_patients
    FROM public.patients
    WHERE patient_registry_id = p_winner_id
      AND bed_number IS NOT NULL AND bed_number <> '';
  SELECT count(*) INTO v_loser_patients
    FROM public.patients
    WHERE patient_registry_id = p_loser_id
      AND bed_number IS NOT NULL AND bed_number <> '';
  IF v_winner_patients > 0 AND v_loser_patients > 0 THEN
    RAISE EXCEPTION 'Ambos os registros têm paciente alocado em leito. Libere um antes de mesclar.';
  END IF;

  SELECT email INTO v_email FROM public.profiles WHERE id = v_user;

  -- ============================================================
  -- A) Enriquece o registry vencedor por campo escolhido
  -- ============================================================
  IF p_field_choices IS NOT NULL THEN
    FOR v_field, v_choice IN SELECT key, value::text FROM jsonb_each_text(p_field_choices) LOOP
      -- v_choice esperado: 'winner' | 'loser' | 'empty'
      EXECUTE format('SELECT to_jsonb(%I) FROM public.patient_registry WHERE id = $1', v_field)
        INTO v_winner_val USING p_winner_id;
      EXECUTE format('SELECT to_jsonb(%I) FROM public.patient_registry WHERE id = $1', v_field)
        INTO v_loser_val USING p_loser_id;

      v_old := v_winner_val #>> '{}';
      IF v_choice = 'loser' THEN
        v_final_val := v_loser_val #>> '{}';
      ELSIF v_choice = 'empty' THEN
        v_final_val := NULL;
      ELSE
        v_final_val := v_winner_val #>> '{}';
      END IF;

      IF v_choice IN ('loser','empty') AND v_old IS DISTINCT FROM v_final_val THEN
        -- Libera CPF/CNS do perdedor antes para evitar conflito de unique
        IF v_field IN ('cpf','cns') AND v_final_val IS NOT NULL THEN
          EXECUTE format('UPDATE public.patient_registry SET %I = NULL WHERE id = $1', v_field)
            USING p_loser_id;
        END IF;
        EXECUTE format('UPDATE public.patient_registry SET %I = $1, updated_at = now() WHERE id = $2', v_field)
          USING v_final_val, p_winner_id;

        INSERT INTO public.patient_registry_edit_history (
          patient_registry_id, field_changed, old_value, new_value,
          reason, source, changed_by, changed_by_email
        ) VALUES (
          p_winner_id, v_field, v_old, v_final_val,
          'Mesclagem com registro ' || p_loser_id::text || ' — ' || p_reason,
          'merge', v_user, v_email
        );
      END IF;
    END LOOP;
  END IF;

  -- ============================================================
  -- B) Arquiva CPF/CNS remanescentes do perdedor + notes
  -- ============================================================
  v_archived := jsonb_build_object(
    'archived_cpf', v_loser.cpf,
    'archived_cns', v_loser.cns,
    'archived_medical_record', v_loser.medical_record,
    'archived_at', now(),
    'archived_by', v_user
  );

  UPDATE public.patient_registry
    SET cpf = NULL,
        cns = NULL,
        notes = COALESCE(notes, '{}'::jsonb) || jsonb_build_object('merge_archive', v_archived),
        merged_into_registry_id = p_winner_id,
        merged_at = now(),
        merged_by = v_user,
        updated_at = now()
    WHERE id = p_loser_id;

  -- ============================================================
  -- C) Repoint de vínculos clínicos/administrativos
  -- ============================================================
  BEGIN UPDATE public.patient_encounters SET registry_id = p_winner_id WHERE registry_id = p_loser_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('patient_encounters', v_n);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN UPDATE public.patients SET patient_registry_id = p_winner_id WHERE patient_registry_id = p_loser_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('patients', v_n);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN UPDATE public.clinical_evolutions SET patient_registry_id = p_winner_id WHERE patient_registry_id = p_loser_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('clinical_evolutions', v_n);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN UPDATE public.exam_requests SET patient_registry_id = p_winner_id WHERE patient_registry_id = p_loser_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('exam_requests', v_n);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN UPDATE public.culture_results SET patient_registry_id = p_winner_id WHERE patient_registry_id = p_loser_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('culture_results', v_n);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN UPDATE public.admission_histories SET patient_registry_id = p_winner_id WHERE patient_registry_id = p_loser_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('admission_histories', v_n);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN UPDATE public.conduct_history SET patient_registry_id = p_winner_id WHERE patient_registry_id = p_loser_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('conduct_history', v_n);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN UPDATE public.patient_movements SET patient_registry_id = p_winner_id WHERE patient_registry_id = p_loser_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('patient_movements', v_n);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN UPDATE public.dhd_patients SET patient_registry_id = p_winner_id WHERE patient_registry_id = p_loser_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('dhd_patients', v_n);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN UPDATE public.pre_admissions SET patient_registry_id = p_winner_id WHERE patient_registry_id = p_loser_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('pre_admissions', v_n);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN UPDATE public.discharge_documents SET patient_registry_id = p_winner_id WHERE patient_registry_id = p_loser_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('discharge_documents', v_n);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN UPDATE public.medical_record_edit_history SET patient_registry_id = p_winner_id WHERE patient_registry_id = p_loser_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('medical_record_edit_history', v_n);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN UPDATE public.patient_registry_edit_history SET patient_registry_id = p_winner_id WHERE patient_registry_id = p_loser_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('patient_registry_edit_history', v_n);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN UPDATE public.patient_admission_date_history SET patient_registry_id = p_winner_id WHERE patient_registry_id = p_loser_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('patient_admission_date_history', v_n);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- ============================================================
  -- D) Prontuário predominante + medical_records do perdedor
  --    Todos migram para o vencedor, mas só o predominante fica is_primary=true
  -- ============================================================
  BEGIN
    UPDATE public.medical_records
      SET patient_registry_id = p_winner_id
      WHERE patient_registry_id = p_loser_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('medical_records', v_n);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  IF p_predominant_medical_record_id IS NOT NULL THEN
    -- Rebaixa todos os medical_records do vencedor (e migrados) para is_primary=false
    UPDATE public.medical_records
      SET is_primary = false
      WHERE patient_registry_id = p_winner_id;
    -- Promove o escolhido
    UPDATE public.medical_records
      SET is_primary = true
      WHERE id = p_predominant_medical_record_id
        AND patient_registry_id = p_winner_id;
  END IF;

  -- ============================================================
  -- E) Auditoria global
  -- ============================================================
  INSERT INTO public.patient_merge_audit (
    source_registry_id, target_registry_id, action,
    source_snapshot, target_snapshot,
    performed_by, performed_by_email
  ) VALUES (
    p_loser_id, p_winner_id, 'merge',
    to_jsonb(v_loser) || jsonb_build_object('field_choices', p_field_choices, 'reason', p_reason, 'predominant_medical_record_id', p_predominant_medical_record_id),
    to_jsonb(v_winner),
    v_user, v_email
  );

  RETURN jsonb_build_object(
    'success', true,
    'winner_id', p_winner_id,
    'loser_id', p_loser_id,
    'counts', v_counts,
    'archived', v_archived
  );
END;
$$;