
-- ════════════════════════════════════════════════════════════════════════
-- 1) MOVIMENTAÇÃO: guarda anti-sinalização no trigger correto
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.trg_archive_bed_history_on_deallocation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_was_occupied boolean;
  v_is_now_vacant boolean;
  v_has_pending_internal_transfer boolean;
BEGIN
  v_was_occupied :=
    COALESCE(OLD.is_vacant, true) = false
    OR OLD.patient_registry_id IS NOT NULL
    OR COALESCE(NULLIF(trim(OLD.name), ''), '') <> '';

  v_is_now_vacant :=
    COALESCE(NEW.is_vacant, false) = true
    OR (NEW.patient_registry_id IS NULL AND COALESCE(NULLIF(trim(NEW.name), ''), '') = '');

  IF v_was_occupied AND v_is_now_vacant THEN
    -- 🔒 GUARDA: não arquivar quando a vacância é por sinalização de transferência
    -- interna (paciente continua ativo no fluxo, só aguardando alocação no destino).
    SELECT EXISTS (
      SELECT 1 FROM public.patient_movements
      WHERE patient_id = NEW.id
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

    PERFORM public.archive_bed_history(NEW.id, 'bed_deallocation_auto');
  END IF;

  RETURN NEW;
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════
-- 2) DADOS + 3) AUDITORIA: desarquivar com filtro por registry correto + janela
-- ════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_now timestamptz := now();
  r record;
  v_marker jsonb := jsonb_build_object(
    'repair_action', 'MANUAL_REPAIR_ARCHIVE_REVERT',
    'reason', 'bed_deallocation_auto fired during internal_transfer signaling'
  );
BEGIN
  -- ─── RAIMUNDA: clinical_evolutions ───
  FOR r IN
    SELECT id, archived_at, archive_reason FROM public.clinical_evolutions
    WHERE patient_registry_id='9ca268e2-c31f-4664-bad1-e8e91d08f31f'
      AND patient_id='4715600d-5920-43c3-8037-1882b00fc758'
      AND archived_at IS NOT NULL AND archive_reason='bed_deallocation_auto'
      AND archived_at BETWEEN '2026-06-11 01:00:00'::timestamptz AND '2026-06-11 02:30:00'::timestamptz
  LOOP
    UPDATE public.clinical_evolutions SET archived_at=NULL, archived_from_patient_id=NULL,
           archive_reason=NULL, updated_at=v_now WHERE id=r.id;
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (NULL, 'UPDATE', 'clinical_evolutions', r.id,
            jsonb_build_object('archived_at', r.archived_at, 'archive_reason', r.archive_reason),
            v_marker || jsonb_build_object('patient', 'RAIMUNDA L11'));
  END LOOP;

  -- ─── RAIMUNDA: vital_signs / exam_requests / culture_results ───
  FOR r IN
    SELECT 'vital_signs'::text AS tbl, id, archived_at, archive_reason FROM public.vital_signs
     WHERE patient_id='4715600d-5920-43c3-8037-1882b00fc758' AND archived_at IS NOT NULL
       AND archive_reason='bed_deallocation_auto'
       AND archived_at BETWEEN '2026-06-11 01:00:00'::timestamptz AND '2026-06-11 02:30:00'::timestamptz
    UNION ALL
    SELECT 'exam_requests', id, archived_at, archive_reason FROM public.exam_requests
     WHERE patient_id='4715600d-5920-43c3-8037-1882b00fc758' AND archived_at IS NOT NULL
       AND archive_reason='bed_deallocation_auto'
       AND archived_at BETWEEN '2026-06-11 01:00:00'::timestamptz AND '2026-06-11 02:30:00'::timestamptz
    UNION ALL
    SELECT 'culture_results', id, archived_at, archive_reason FROM public.culture_results
     WHERE patient_id='4715600d-5920-43c3-8037-1882b00fc758' AND archived_at IS NOT NULL
       AND archive_reason='bed_deallocation_auto'
       AND archived_at BETWEEN '2026-06-11 01:00:00'::timestamptz AND '2026-06-11 02:30:00'::timestamptz
  LOOP
    EXECUTE format('UPDATE public.%I SET archived_at=NULL, archived_from_patient_id=NULL, archive_reason=NULL WHERE id=$1', r.tbl) USING r.id;
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (NULL, 'UPDATE', r.tbl, r.id,
            jsonb_build_object('archived_at', r.archived_at, 'archive_reason', r.archive_reason),
            v_marker || jsonb_build_object('patient', 'RAIMUNDA L11'));
  END LOOP;

  -- ─── JORGINETE: clinical_evolutions (só do registry correto) ───
  FOR r IN
    SELECT id, archived_at, archive_reason FROM public.clinical_evolutions
    WHERE patient_registry_id='f9d55f18-e8c3-460a-b916-18653692e167'
      AND patient_id='d902c991-7102-404f-a219-5cc104ba0655'
      AND archived_at IS NOT NULL AND archive_reason='bed_deallocation_auto'
      AND archived_at BETWEEN '2026-06-11 01:30:00'::timestamptz AND '2026-06-11 03:00:00'::timestamptz
  LOOP
    UPDATE public.clinical_evolutions SET archived_at=NULL, archived_from_patient_id=NULL,
           archive_reason=NULL, updated_at=v_now WHERE id=r.id;
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (NULL, 'UPDATE', 'clinical_evolutions', r.id,
            jsonb_build_object('archived_at', r.archived_at, 'archive_reason', r.archive_reason),
            v_marker || jsonb_build_object('patient', 'JORGINETE L41'));
  END LOOP;

  -- ─── JORGINETE: vital_signs / exam_requests / culture_results ───
  FOR r IN
    SELECT 'vital_signs'::text AS tbl, id, archived_at, archive_reason FROM public.vital_signs
     WHERE patient_id='d902c991-7102-404f-a219-5cc104ba0655' AND archived_at IS NOT NULL
       AND archive_reason='bed_deallocation_auto'
       AND archived_at BETWEEN '2026-06-11 01:30:00'::timestamptz AND '2026-06-11 03:00:00'::timestamptz
    UNION ALL
    SELECT 'exam_requests', id, archived_at, archive_reason FROM public.exam_requests
     WHERE patient_id='d902c991-7102-404f-a219-5cc104ba0655' AND archived_at IS NOT NULL
       AND archive_reason='bed_deallocation_auto'
       AND archived_at BETWEEN '2026-06-11 01:30:00'::timestamptz AND '2026-06-11 03:00:00'::timestamptz
    UNION ALL
    SELECT 'culture_results', id, archived_at, archive_reason FROM public.culture_results
     WHERE patient_id='d902c991-7102-404f-a219-5cc104ba0655' AND archived_at IS NOT NULL
       AND archive_reason='bed_deallocation_auto'
       AND archived_at BETWEEN '2026-06-11 01:30:00'::timestamptz AND '2026-06-11 03:00:00'::timestamptz
  LOOP
    EXECUTE format('UPDATE public.%I SET archived_at=NULL, archived_from_patient_id=NULL, archive_reason=NULL WHERE id=$1', r.tbl) USING r.id;
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (NULL, 'UPDATE', r.tbl, r.id,
            jsonb_build_object('archived_at', r.archived_at, 'archive_reason', r.archive_reason),
            v_marker || jsonb_build_object('patient', 'JORGINETE L41'));
  END LOOP;
END $$;
