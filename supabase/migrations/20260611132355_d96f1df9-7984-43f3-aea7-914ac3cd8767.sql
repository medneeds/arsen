
-- ════════════════════════════════════════════════════════════════════════
-- 1) MOVIMENTAÇÃO: guarda anti-sinalização-transferência-interna
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.tg_archive_on_bed_vacate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_has_pending_internal_transfer boolean;
BEGIN
  IF (TG_OP = 'UPDATE')
     AND OLD.is_vacant IS DISTINCT FROM TRUE
     AND NEW.is_vacant = TRUE
  THEN
    SELECT EXISTS (
      SELECT 1 FROM public.patient_movements
      WHERE patient_id = OLD.id
        AND release_status = 'pending_release'
        AND (
          movement_type ILIKE 'TRANSFERENCIA_INTERNA%'
          OR movement_type ILIKE 'TRANSFER%NCIA INTERNA%'
        )
        AND created_at >= (now() - interval '24 hours')
    ) INTO v_has_pending_internal_transfer;

    IF v_has_pending_internal_transfer THEN
      RETURN NEW;
    END IF;

    PERFORM public.archive_patient_bed_data(OLD.id, 'auto_trigger_bed_vacated');
  END IF;
  RETURN NEW;
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════
-- 2) DADOS + 3) AUDITORIA: desarquivar + logar (action='UPDATE', marker em new_data)
-- ════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_user_id uuid := NULL;
  v_now timestamptz := now();
  r record;
  v_marker jsonb;
BEGIN
  v_marker := jsonb_build_object('repair_action', 'MANUAL_REPAIR_ARCHIVE_REVERT',
                                 'reason', 'auto_trigger_bed_vacated fired during internal_transfer signaling');

  -- ─── RAIMUNDA: clinical_evolutions ───
  FOR r IN
    SELECT id, archived_at, archive_reason FROM public.clinical_evolutions
    WHERE patient_registry_id='9ca268e2-c31f-4664-bad1-e8e91d08f31f'
      AND patient_id='4715600d-5920-43c3-8037-1882b00fc758'
      AND archived_at IS NOT NULL AND archive_reason='auto_trigger_bed_vacated'
      AND archived_at BETWEEN '2026-06-11 01:00:00'::timestamptz AND '2026-06-11 02:30:00'::timestamptz
  LOOP
    UPDATE public.clinical_evolutions SET archived_at=NULL, archived_from_patient_id=NULL,
           archive_reason=NULL, updated_at=v_now WHERE id=r.id;
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (v_user_id, 'UPDATE', 'clinical_evolutions', r.id,
            jsonb_build_object('archived_at', r.archived_at, 'archive_reason', r.archive_reason),
            v_marker || jsonb_build_object('patient', 'RAIMUNDA L11', 'archived_at', NULL));
  END LOOP;

  -- ─── RAIMUNDA: prescriptions ───
  FOR r IN
    SELECT id, archived_at, archive_reason FROM public.prescriptions
    WHERE patient_registry_id='9ca268e2-c31f-4664-bad1-e8e91d08f31f'
      AND archived_at IS NOT NULL AND archive_reason='auto_trigger_bed_vacated'
      AND archived_at BETWEEN '2026-06-11 01:00:00'::timestamptz AND '2026-06-11 02:30:00'::timestamptz
  LOOP
    UPDATE public.prescriptions SET archived_at=NULL, archived_from_patient_id=NULL,
           archive_reason=NULL, updated_at=v_now WHERE id=r.id;
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (v_user_id, 'UPDATE', 'prescriptions', r.id,
            jsonb_build_object('archived_at', r.archived_at, 'archive_reason', r.archive_reason),
            v_marker || jsonb_build_object('patient', 'RAIMUNDA L11', 'archived_at', NULL));
  END LOOP;

  -- ─── RAIMUNDA: vital_signs / exam_requests / culture_results ───
  FOR r IN
    SELECT 'vital_signs'::text AS tbl, id, archived_at, archive_reason FROM public.vital_signs
     WHERE patient_id='4715600d-5920-43c3-8037-1882b00fc758' AND archived_at IS NOT NULL
       AND archive_reason='auto_trigger_bed_vacated'
       AND archived_at BETWEEN '2026-06-11 01:00:00'::timestamptz AND '2026-06-11 02:30:00'::timestamptz
    UNION ALL
    SELECT 'exam_requests', id, archived_at, archive_reason FROM public.exam_requests
     WHERE patient_id='4715600d-5920-43c3-8037-1882b00fc758' AND archived_at IS NOT NULL
       AND archive_reason='auto_trigger_bed_vacated'
       AND archived_at BETWEEN '2026-06-11 01:00:00'::timestamptz AND '2026-06-11 02:30:00'::timestamptz
    UNION ALL
    SELECT 'culture_results', id, archived_at, archive_reason FROM public.culture_results
     WHERE patient_id='4715600d-5920-43c3-8037-1882b00fc758' AND archived_at IS NOT NULL
       AND archive_reason='auto_trigger_bed_vacated'
       AND archived_at BETWEEN '2026-06-11 01:00:00'::timestamptz AND '2026-06-11 02:30:00'::timestamptz
  LOOP
    EXECUTE format('UPDATE public.%I SET archived_at=NULL, archived_from_patient_id=NULL, archive_reason=NULL WHERE id=$1', r.tbl) USING r.id;
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (v_user_id, 'UPDATE', r.tbl, r.id,
            jsonb_build_object('archived_at', r.archived_at, 'archive_reason', r.archive_reason),
            v_marker || jsonb_build_object('patient', 'RAIMUNDA L11', 'archived_at', NULL));
  END LOOP;

  -- ─── RAIMUNDA: admission_histories ───
  FOR r IN
    SELECT id, archived_at FROM public.admission_histories
    WHERE patient_registry_id='9ca268e2-c31f-4664-bad1-e8e91d08f31f'
      AND archived_at IS NOT NULL
      AND archived_at BETWEEN '2026-06-11 01:00:00'::timestamptz AND '2026-06-11 02:30:00'::timestamptz
  LOOP
    UPDATE public.admission_histories SET archived_at=NULL, updated_at=v_now WHERE id=r.id;
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (v_user_id, 'UPDATE', 'admission_histories', r.id,
            jsonb_build_object('archived_at', r.archived_at),
            v_marker || jsonb_build_object('patient', 'RAIMUNDA L11', 'archived_at', NULL));
  END LOOP;

  -- ─── JORGINETE: clinical_evolutions ───
  FOR r IN
    SELECT id, archived_at, archive_reason FROM public.clinical_evolutions
    WHERE patient_registry_id='f9d55f18-e8c3-460a-b916-18653692e167'
      AND patient_id='d902c991-7102-404f-a219-5cc104ba0655'
      AND archived_at IS NOT NULL AND archive_reason='auto_trigger_bed_vacated'
      AND archived_at BETWEEN '2026-06-11 01:30:00'::timestamptz AND '2026-06-11 03:00:00'::timestamptz
  LOOP
    UPDATE public.clinical_evolutions SET archived_at=NULL, archived_from_patient_id=NULL,
           archive_reason=NULL, updated_at=v_now WHERE id=r.id;
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (v_user_id, 'UPDATE', 'clinical_evolutions', r.id,
            jsonb_build_object('archived_at', r.archived_at, 'archive_reason', r.archive_reason),
            v_marker || jsonb_build_object('patient', 'JORGINETE L41', 'archived_at', NULL));
  END LOOP;

  -- ─── JORGINETE: prescriptions ───
  FOR r IN
    SELECT id, archived_at, archive_reason FROM public.prescriptions
    WHERE patient_registry_id='f9d55f18-e8c3-460a-b916-18653692e167'
      AND archived_at IS NOT NULL AND archive_reason='auto_trigger_bed_vacated'
      AND archived_at BETWEEN '2026-06-11 01:30:00'::timestamptz AND '2026-06-11 03:00:00'::timestamptz
  LOOP
    UPDATE public.prescriptions SET archived_at=NULL, archived_from_patient_id=NULL,
           archive_reason=NULL, updated_at=v_now WHERE id=r.id;
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (v_user_id, 'UPDATE', 'prescriptions', r.id,
            jsonb_build_object('archived_at', r.archived_at, 'archive_reason', r.archive_reason),
            v_marker || jsonb_build_object('patient', 'JORGINETE L41', 'archived_at', NULL));
  END LOOP;

  -- ─── JORGINETE: vital_signs / exam_requests / culture_results ───
  FOR r IN
    SELECT 'vital_signs'::text AS tbl, id, archived_at, archive_reason FROM public.vital_signs
     WHERE patient_id='d902c991-7102-404f-a219-5cc104ba0655' AND archived_at IS NOT NULL
       AND archive_reason='auto_trigger_bed_vacated'
       AND archived_at BETWEEN '2026-06-11 01:30:00'::timestamptz AND '2026-06-11 03:00:00'::timestamptz
    UNION ALL
    SELECT 'exam_requests', id, archived_at, archive_reason FROM public.exam_requests
     WHERE patient_id='d902c991-7102-404f-a219-5cc104ba0655' AND archived_at IS NOT NULL
       AND archive_reason='auto_trigger_bed_vacated'
       AND archived_at BETWEEN '2026-06-11 01:30:00'::timestamptz AND '2026-06-11 03:00:00'::timestamptz
    UNION ALL
    SELECT 'culture_results', id, archived_at, archive_reason FROM public.culture_results
     WHERE patient_id='d902c991-7102-404f-a219-5cc104ba0655' AND archived_at IS NOT NULL
       AND archive_reason='auto_trigger_bed_vacated'
       AND archived_at BETWEEN '2026-06-11 01:30:00'::timestamptz AND '2026-06-11 03:00:00'::timestamptz
  LOOP
    EXECUTE format('UPDATE public.%I SET archived_at=NULL, archived_from_patient_id=NULL, archive_reason=NULL WHERE id=$1', r.tbl) USING r.id;
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (v_user_id, 'UPDATE', r.tbl, r.id,
            jsonb_build_object('archived_at', r.archived_at, 'archive_reason', r.archive_reason),
            v_marker || jsonb_build_object('patient', 'JORGINETE L41', 'archived_at', NULL));
  END LOOP;

  -- ─── JORGINETE: admission_histories ───
  FOR r IN
    SELECT id, archived_at FROM public.admission_histories
    WHERE patient_registry_id='f9d55f18-e8c3-460a-b916-18653692e167'
      AND archived_at IS NOT NULL
      AND archived_at BETWEEN '2026-06-11 01:30:00'::timestamptz AND '2026-06-11 03:00:00'::timestamptz
  LOOP
    UPDATE public.admission_histories SET archived_at=NULL, updated_at=v_now WHERE id=r.id;
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (v_user_id, 'UPDATE', 'admission_histories', r.id,
            jsonb_build_object('archived_at', r.archived_at),
            v_marker || jsonb_build_object('patient', 'JORGINETE L41', 'archived_at', NULL));
  END LOOP;
END $$;
