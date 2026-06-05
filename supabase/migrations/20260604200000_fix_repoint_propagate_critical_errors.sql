
-- ════════════════════════════════════════════════════════════════════
-- repoint_patient_history v3 — erros críticos propagados corretamente
-- ════════════════════════════════════════════════════════════════════
--
-- PROBLEMA CORRIGIDO:
--   Na v2, os blocos BEGIN...EXCEPTION de clinical_evolutions (bloco 3)
--   e prescriptions (bloco 4) capturavam erros silenciosamente, retornando
--   success=true mesmo sem mover os registros. O frontend interpretava como
--   sucesso e zeraba o leito de origem — causando histórico órfão.
--
-- MUDANÇA:
--   Blocos 3 e 4 não têm mais EXCEPTION handler. Qualquer falha nesses
--   blocos críticos propaga a exceção para o caller, abortando o repoint
--   por completo. O leito de origem não é zerado. O usuário vê um erro
--   claro e pode tentar novamente.
--
-- ROLLBACK:
--   Re-executar supabase/migrations/20260604162437_2bd82f3c-ee87-489d-81df-f8dff2cf4401.sql
--   no SQL Editor do Supabase para restaurar o comportamento anterior.
--
-- TABELAS AFETADAS: nenhuma (apenas comportamento da função)
-- DADOS AFETADOS:   nenhum
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

  -- 1) Registry (preferir source, fallback target)
  SELECT patient_registry_id INTO v_registry_id
    FROM public.patients WHERE id = p_source_patient_id LIMIT 1;
  IF v_registry_id IS NULL THEN
    SELECT patient_registry_id INTO v_registry_id
      FROM public.patients WHERE id = p_target_patient_id LIMIT 1;
  END IF;

  -- 2) Encounters ativos (source/target) — prioriza registry
  SELECT id INTO v_source_encounter_id
    FROM public.patient_encounters
    WHERE (patient_id = p_source_patient_id OR registry_id = v_registry_id)
      AND status = 'active'
    ORDER BY admission_date DESC NULLS LAST, created_at DESC LIMIT 1;

  SELECT id INTO v_target_encounter_id
    FROM public.patient_encounters
    WHERE (patient_id = p_target_patient_id OR registry_id = v_registry_id)
      AND status = 'active'
    ORDER BY admission_date DESC NULLS LAST, created_at DESC LIMIT 1;

  IF v_target_encounter_id IS NULL THEN
    v_target_encounter_id := v_source_encounter_id;
  END IF;

  -- 2b) Encounter duplicado ativo no mesmo registry → fechar o mais antigo
  IF v_registry_id IS NOT NULL
     AND v_source_encounter_id IS NOT NULL
     AND v_target_encounter_id IS NOT NULL
     AND v_source_encounter_id <> v_target_encounter_id THEN
    BEGIN
      WITH dup AS (
        SELECT id, admission_date
          FROM public.patient_encounters
         WHERE registry_id = v_registry_id
           AND status = 'active'
           AND id IN (v_source_encounter_id, v_target_encounter_id)
         ORDER BY admission_date ASC NULLS FIRST, created_at ASC
         LIMIT 1
      )
      UPDATE public.patient_encounters pe
         SET status = 'closed', updated_at = now()
        FROM dup
       WHERE pe.id = dup.id;
      GET DIAGNOSTICS v_dup_closed = ROW_COUNT;

      -- Recalcular target após fechar duplicado
      SELECT id INTO v_target_encounter_id
        FROM public.patient_encounters
       WHERE registry_id = v_registry_id AND status = 'active'
       ORDER BY admission_date DESC NULLS LAST, created_at DESC LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      -- Fechar encounter duplicado é secundário; falha aqui não aborta o repoint
      v_counts := v_counts || jsonb_build_object('dup_close_error', SQLERRM);
    END;
  END IF;

  -- 3) clinical_evolutions — CRÍTICO: sem EXCEPTION handler
  -- Qualquer falha aqui propaga e aborta a função inteira.
  -- O caller (repointPatientHistory.ts) detecta o erro e bloqueia o esvaziamento
  -- do leito de origem, preservando os dados.
  UPDATE public.clinical_evolutions
     SET patient_id   = p_target_patient_id,
         encounter_id = COALESCE(v_target_encounter_id, encounter_id),
         updated_at   = now()
   WHERE patient_id = p_source_patient_id
      OR (patient_registry_id = v_registry_id
          AND v_source_encounter_id IS NOT NULL
          AND encounter_id = v_source_encounter_id);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('clinical_evolutions', v_n);

  -- 3b) Desarquivar evoluções arquivadas nos últimos 15 min do mesmo registry
  BEGIN
    UPDATE public.clinical_evolutions
       SET archived_at  = NULL,
           patient_id   = p_target_patient_id,
           encounter_id = COALESCE(v_target_encounter_id, encounter_id),
           updated_at   = now()
     WHERE patient_registry_id = v_registry_id
       AND archived_at IS NOT NULL
       AND archived_at > (now() - interval '15 minutes');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('clinical_evolutions_unarchived', v_n);
  EXCEPTION WHEN OTHERS THEN
    v_counts := v_counts || jsonb_build_object('unarchive_error', SQLERRM);
  END;

  -- 4) prescriptions — CRÍTICO: sem EXCEPTION handler
  -- Mesma razão do bloco 3: prescrições são dados clínicos críticos.
  UPDATE public.prescriptions
     SET encounter_id   = COALESCE(v_target_encounter_id, encounter_id),
         patient_data   = jsonb_set(COALESCE(patient_data, '{}'::jsonb),
                                    '{id}',
                                    to_jsonb(p_target_patient_id::text),
                                    true),
         repointed_at   = now(),
         repoint_reason = p_reason,
         updated_at     = now()
   WHERE patient_registry_id = v_registry_id
     AND archived_at IS NULL
     AND (
          (patient_data->>'id') = p_source_patient_id::text
          OR (v_source_encounter_id IS NOT NULL AND encounter_id = v_source_encounter_id)
          OR encounter_id IS NULL
         );
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('prescriptions', v_n);

  -- 5) exam_requests — secundário, falha silenciada
  BEGIN
    UPDATE public.exam_requests
       SET patient_id   = p_target_patient_id,
           encounter_id = COALESCE(v_target_encounter_id, encounter_id),
           updated_at   = now()
     WHERE patient_id = p_source_patient_id
        OR (patient_registry_id = v_registry_id
            AND v_source_encounter_id IS NOT NULL
            AND encounter_id = v_source_encounter_id);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('exam_requests', v_n);
  EXCEPTION WHEN OTHERS THEN
    v_counts := v_counts || jsonb_build_object('exam_requests_error', SQLERRM);
  END;

  -- 6) culture_results — secundário
  BEGIN
    UPDATE public.culture_results
       SET patient_id   = p_target_patient_id,
           encounter_id = COALESCE(v_target_encounter_id, encounter_id),
           updated_at   = now()
     WHERE patient_id = p_source_patient_id
        OR (patient_registry_id = v_registry_id
            AND v_source_encounter_id IS NOT NULL
            AND encounter_id = v_source_encounter_id);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('culture_results', v_n);
  EXCEPTION WHEN OTHERS THEN
    v_counts := v_counts || jsonb_build_object('culture_results_error', SQLERRM);
  END;

  -- 7) admission_histories — secundário
  BEGIN
    UPDATE public.admission_histories
       SET patient_id = p_target_patient_id,
           updated_at = now()
     WHERE patient_id = p_source_patient_id
       AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('admission_histories', v_n);
  EXCEPTION WHEN OTHERS THEN
    v_counts := v_counts || jsonb_build_object('admission_histories_error', SQLERRM);
  END;

  -- 8) vital_signs — secundário
  BEGIN
    UPDATE public.vital_signs
       SET patient_id   = p_target_patient_id,
           encounter_id = COALESCE(v_target_encounter_id, encounter_id),
           updated_at   = now()
     WHERE patient_id = p_source_patient_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('vital_signs', v_n);
  EXCEPTION WHEN OTHERS THEN
    v_counts := v_counts || jsonb_build_object('vital_signs_error', SQLERRM);
  END;

  -- 9) round_sessions — secundário
  BEGIN
    UPDATE public.round_sessions
       SET patient_id   = p_target_patient_id,
           encounter_id = COALESCE(v_target_encounter_id, encounter_id),
           updated_at   = now()
     WHERE patient_id = p_source_patient_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('round_sessions', v_n);
  EXCEPTION WHEN OTHERS THEN
    v_counts := v_counts || jsonb_build_object('round_sessions_error', SQLERRM);
  END;

  -- 10) discharge_documents — secundário
  BEGIN
    UPDATE public.discharge_documents
       SET patient_id   = p_target_patient_id,
           encounter_id = COALESCE(v_target_encounter_id, encounter_id),
           updated_at   = now()
     WHERE patient_id = p_source_patient_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('discharge_documents', v_n);
  EXCEPTION WHEN OTHERS THEN
    v_counts := v_counts || jsonb_build_object('discharge_documents_error', SQLERRM);
  END;

  -- 11) Tabelas secundárias (patient_id apenas) — falhas silenciadas
  BEGIN
    UPDATE public.conduct_history SET patient_id = p_target_patient_id
     WHERE patient_id = p_source_patient_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    UPDATE public.medical_records SET patient_id = p_target_patient_id
     WHERE patient_id = p_source_patient_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    UPDATE public.dhd_patients SET patient_id = p_target_patient_id
     WHERE patient_id = p_source_patient_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    UPDATE public.pre_admissions SET patient_id = p_target_patient_id
     WHERE patient_id = p_source_patient_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    UPDATE public.medical_record_edit_history SET patient_id = p_target_patient_id
     WHERE patient_id = p_source_patient_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    UPDATE public.patient_admission_date_history SET patient_id = p_target_patient_id
     WHERE patient_id = p_source_patient_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- 12) patient_encounters: garantir patient_id apontando para target nos ativos
  BEGIN
    UPDATE public.patient_encounters
       SET patient_id = p_target_patient_id,
           updated_at = now()
     WHERE patient_id = p_source_patient_id
       AND status = 'active';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- 13) Auditoria em patient_movements
  BEGIN
    INSERT INTO public.patient_movements (
      patient_id, patient_name, patient_bed, patient_sector,
      movement_type, destination, notes,
      created_by, department, hospital_unit_id, state_id,
      patient_registry_id, encounter_id, patient_snapshot
    )
    SELECT
      p_target_patient_id,
      COALESCE(t.name, s.name),
      t.bed_number, t.sector,
      'REPOINT_HISTORY_V3',
      'Histórico clínico migrado de ' || COALESCE(s.bed_number,'?')
        || ' (' || COALESCE(s.sector,'?') || ') para '
        || COALESCE(t.bed_number,'?') || ' (' || COALESCE(t.sector,'?') || ')',
      p_reason,
      v_user, t.department, t.hospital_unit_id, t.state_id,
      v_registry_id, v_target_encounter_id,
      jsonb_build_object(
        'source_patient_id', p_source_patient_id,
        'target_patient_id', p_target_patient_id,
        'source_encounter',  v_source_encounter_id,
        'target_encounter',  v_target_encounter_id,
        'registry_id',       v_registry_id,
        'duplicate_encounters_closed', v_dup_closed,
        'counts',            v_counts,
        'source',            to_jsonb(s),
        'target',            to_jsonb(t),
        'version',           'v3'
      )
    FROM public.patients t
    LEFT JOIN public.patients s ON s.id = p_source_patient_id
    WHERE t.id = p_target_patient_id;
  EXCEPTION WHEN OTHERS THEN
    v_counts := v_counts || jsonb_build_object('audit_error', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'success',           true,
    'source_id',         p_source_patient_id,
    'target_id',         p_target_patient_id,
    'registry_id',       v_registry_id,
    'source_encounter',  v_source_encounter_id,
    'target_encounter',  v_target_encounter_id,
    'duplicate_encounters_closed', v_dup_closed,
    'counts',            v_counts,
    'performed_by',      v_user,
    'performed_at',      now(),
    'version',           'v3'
  );
END;
$$;
