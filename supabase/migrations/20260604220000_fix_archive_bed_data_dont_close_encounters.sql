
-- ════════════════════════════════════════════════════════════════════
-- archive_patient_bed_data v2 — não fecha encounters
-- ════════════════════════════════════════════════════════════════════
--
-- PROBLEMA CORRIGIDO:
--   A versão anterior fechava patient_encounters em QUALQUER liberação
--   de leito, incluindo transferências internas e remanejamentos.
--   Isso contradiz a regra de negócio:
--     "O encerramento do atendimento só faz sentido em caso de
--      alta médica hospitalar, óbito ou transferência externa."
--
--   Os callers identificados e seus contextos:
--     'defensive_pre_admission_cleanup'   → limpeza ao admitir    → NÃO fecha
--     'operational_relocation_source_release' → transferência    → NÃO fecha
--     'frontend_vacate_bed'               → liberação de leito   → NÃO fecha
--     'frontend_release_bed_pre_admission'→ cancela pré-admissão → NÃO fecha
--
-- MUDANÇA:
--   Bloco de UPDATE em patient_encounters removido desta função.
--   O encerramento do encounter deve ser feito explicitamente nos
--   fluxos de desfecho final (alta, óbito, transferência externa).
--
-- ROLLBACK:
--   Re-executar supabase/migrations/20260526233517_d56217f7-ff81-4f18-b1c6-3f6f5d1b7b17.sql
--
-- TABELAS AFETADAS: patient_encounters — deixa de ser fechada aqui
-- DADOS AFETADOS:   nenhum dado existente é modificado
-- ════════════════════════════════════════════════════════════════════

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

  -- Regra de negócio: encounter só encerra em alta médica, óbito ou
  -- transferência externa. Esta função arquiva dados clínicos do leito
  -- e é chamada em transferências internas, remanejamentos e limpezas
  -- defensivas — nenhum desses casos justifica encerrar o atendimento.
  -- O encerramento do encounter deve ser feito explicitamente nos fluxos
  -- de desfecho final (PatientMovementDialog, signalClinicalDecision).
  -- [bloco UPDATE patient_encounters removido intencionalmente]

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
