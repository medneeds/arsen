-- ============================================================
-- FIX RPC merge_patient_registries + EXECUTAR 2 MESCLAGENS
-- Bugs corrigidos:
--   (a) tentava JSONB op em notes::text  -> agora usa coluna dedicada merge_archive jsonb
--   (b) INSERT em patient_merge_audit com colunas inexistentes (winner_registry_id, loser_registry_id...)
--       -> agora usa o schema real: source/target_registry_id + payload
-- ============================================================

ALTER TABLE public.patient_registry
  ADD COLUMN IF NOT EXISTS merge_archive jsonb;
COMMENT ON COLUMN public.patient_registry.merge_archive IS 'Snapshot completo do registro perdedor no momento da mesclagem (auditoria/recuperacao dev).';

CREATE OR REPLACE FUNCTION public.merge_patient_registries(
  p_winner_id uuid,
  p_loser_id uuid,
  p_predominant_medical_record_id uuid,
  p_field_choices jsonb,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  v_allowed := (
    v_caller_role = 'admin'
    OR v_caller_profile IN ('gestor','recepcao','recepcionista')
    OR public.is_developer_profile(v_user)
  );
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Operação restrita a admin, gestor ou recepção' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_winner_id IS NULL OR p_loser_id IS NULL THEN RAISE EXCEPTION 'winner_id e loser_id são obrigatórios'; END IF;
  IF p_winner_id = p_loser_id THEN RAISE EXCEPTION 'Vencedor e perdedor não podem ser o mesmo registro'; END IF;
  IF COALESCE(length(trim(p_reason)), 0) < 10 THEN RAISE EXCEPTION 'Motivo obrigatório (mínimo 10 caracteres)'; END IF;

  SELECT * INTO v_winner FROM public.patient_registry WHERE id = p_winner_id;
  SELECT * INTO v_loser  FROM public.patient_registry WHERE id = p_loser_id;
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

  UPDATE public.patients          SET patient_registry_id = p_winner_id WHERE patient_registry_id = p_loser_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('patients', v_n);
  UPDATE public.clinical_evolutions SET patient_registry_id = p_winner_id WHERE patient_registry_id = p_loser_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('evolutions', v_n);
  UPDATE public.exam_requests      SET patient_registry_id = p_winner_id WHERE patient_registry_id = p_loser_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('exams', v_n);
  UPDATE public.patient_encounters SET registry_id = p_winner_id WHERE registry_id = p_loser_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('encounters', v_n);
  UPDATE public.medical_records    SET patient_registry_id = p_winner_id WHERE patient_registry_id = p_loser_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('medical_records', v_n);

  v_archived := to_jsonb(v_loser) || jsonb_build_object(
    'merged_at_iso', now(), 'merged_by', v_user, 'merged_by_email', v_email,
    'merge_reason', p_reason, 'reassign_counts', v_counts
  );

  UPDATE public.patient_registry
    SET cpf = NULL, cns = NULL, merge_archive = v_archived,
        merged_into_registry_id = p_winner_id, merged_at = now(),
        merged_by = v_user, updated_at = now()
    WHERE id = p_loser_id;

  INSERT INTO public.patient_merge_audit (
    source_registry_id, target_registry_id, action,
    source_snapshot, target_snapshot, payload,
    performed_by, performed_by_email
  ) VALUES (
    p_loser_id, p_winner_id, 'merge',
    to_jsonb(v_loser), to_jsonb(v_winner),
    jsonb_build_object(
      'reason', p_reason,
      'field_choices', p_field_choices,
      'predominant_medical_record_id', p_predominant_medical_record_id,
      'reassign_counts', v_counts,
      'archived_loser', v_archived
    ),
    v_user, v_email
  );

  RETURN jsonb_build_object('ok', true, 'winner_id', p_winner_id, 'loser_id', p_loser_id, 'counts', v_counts);
END;
$function$;

-- Executar as 2 mesclagens
DO $$
DECLARE v_result jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims',
    '{"sub":"111eb1df-317e-4fa7-a0d2-7d4ddd87c354","role":"authenticated","email":"artur.batista@sistema.local"}', true);

  v_result := public.merge_patient_registries(
    p_winner_id := 'f506d9ab-0dc0-475c-b83c-d71dd82b0a8c'::uuid,
    p_loser_id  := 'e3d2d8bb-e10f-459b-ad35-c3fe6c112653'::uuid,
    p_predominant_medical_record_id := NULL,
    p_field_choices := jsonb_build_object('cpf','loser','cns','loser','mother_name','loser'),
    p_reason := 'Mesclagem manual via Dev Console scan R4. Vencedor mantido por leito ativo L17 yellow. CPF/CNS/mother_name herdados do perdedor por estarem limpos (vencedor tinha tabs).'
  );
  RAISE NOTICE 'MARIA LUCIA: %', v_result;

  v_result := public.merge_patient_registries(
    p_winner_id := '1a170ae3-4a5f-4aa3-ada2-ba0670caa517'::uuid,
    p_loser_id  := '1cebc6bf-fec8-4388-a4cf-814dab57149a'::uuid,
    p_predominant_medical_record_id := NULL,
    p_field_choices := '{}'::jsonb,
    p_reason := 'Mesclagem manual via Dev Console scan R4. Vencedor mantido por leito ativo L05 red e por concentrar CPF/CNS/mae. Perdedor era orfao sem dados.'
  );
  RAISE NOTICE 'JEFERSON: %', v_result;
END $$;