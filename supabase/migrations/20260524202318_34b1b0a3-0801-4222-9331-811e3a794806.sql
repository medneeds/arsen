-- ============================================================
-- MIGRATION A — Adicionar colunas de arquivamento
-- ============================================================
ALTER TABLE public.vital_signs
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_from_patient_id uuid,
  ADD COLUMN IF NOT EXISTS archive_reason text;
CREATE INDEX IF NOT EXISTS idx_vital_signs_active
  ON public.vital_signs(patient_id) WHERE archived_at IS NULL;

ALTER TABLE public.medical_records
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_from_patient_id uuid,
  ADD COLUMN IF NOT EXISTS archive_reason text;
CREATE INDEX IF NOT EXISTS idx_medical_records_active
  ON public.medical_records(patient_id) WHERE archived_at IS NULL;

ALTER TABLE public.saps3_assessments
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_from_patient_id uuid,
  ADD COLUMN IF NOT EXISTS archive_reason text;
CREATE INDEX IF NOT EXISTS idx_saps3_active
  ON public.saps3_assessments(patient_id) WHERE archived_at IS NULL;

ALTER TABLE public.conduct_history
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_from_patient_id uuid,
  ADD COLUMN IF NOT EXISTS archive_reason text;
CREATE INDEX IF NOT EXISTS idx_conduct_history_active
  ON public.conduct_history(patient_id) WHERE archived_at IS NULL;

ALTER TABLE public.round_sessions
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_from_patient_id uuid,
  ADD COLUMN IF NOT EXISTS archive_reason text;

ALTER TABLE public.admission_histories
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_from_patient_id uuid,
  ADD COLUMN IF NOT EXISTS archive_reason text;
CREATE INDEX IF NOT EXISTS idx_admission_histories_active
  ON public.admission_histories(patient_id) WHERE archived_at IS NULL;

ALTER TABLE public.discharge_documents
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_from_patient_id uuid,
  ADD COLUMN IF NOT EXISTS archive_reason text;

ALTER TABLE public.sepsis_protocols
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_from_patient_id uuid,
  ADD COLUMN IF NOT EXISTS archive_reason text;

-- ============================================================
-- MIGRATION B — Função de arquivamento + trigger automático
-- ============================================================
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
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_data)
    VALUES (auth.uid(), 'INSERT'::audit_action, 'archive_patient_bed_data', p_patient_id,
            jsonb_build_object('reason', p_reason, 'counts', v_counts, 'at', v_now));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'success', true, 'patient_id', p_patient_id, 'archived_at', v_now,
    'reason', p_reason, 'counts', v_counts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.archive_patient_bed_data(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.tg_archive_on_bed_vacate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'UPDATE')
     AND OLD.is_vacant IS DISTINCT FROM TRUE
     AND NEW.is_vacant = TRUE
  THEN
    PERFORM public.archive_patient_bed_data(OLD.id, 'auto_trigger_bed_vacated');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_archive_on_bed_vacate ON public.patients;
CREATE TRIGGER trg_archive_on_bed_vacate
  AFTER UPDATE OF is_vacant ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_archive_on_bed_vacate();

-- ============================================================
-- MIGRATION C — Limpeza retroativa dos dados já vazados
-- ============================================================
WITH ref_dates AS (
  SELECT id AS patient_id, is_vacant,
         COALESCE(admitted_at::timestamptz, admission_date::timestamptz,
                  uti_admission_date::timestamptz, updated_at, created_at) AS admission_ref
  FROM public.patients
)
UPDATE public.clinical_evolutions ce
   SET archived_at = now(),
       archived_from_patient_id = ce.patient_id,
       archive_reason = 'retroactive_cleanup_2026_05_24'
  FROM ref_dates r
 WHERE ce.patient_id = r.patient_id
   AND ce.archived_at IS NULL
   AND (r.is_vacant = true OR (r.is_vacant = false AND ce.created_at < r.admission_ref));

WITH ref_dates AS (
  SELECT id AS patient_id, is_vacant,
         COALESCE(admitted_at::timestamptz, admission_date::timestamptz,
                  uti_admission_date::timestamptz, updated_at, created_at) AS admission_ref
  FROM public.patients
)
UPDATE public.prescriptions p
   SET archived_at = now(),
       archived_from_patient_id = (p.patient_data->>'id')::uuid,
       archive_reason = 'retroactive_cleanup_2026_05_24'
  FROM ref_dates r
 WHERE (p.patient_data->>'id')::uuid = r.patient_id
   AND p.archived_at IS NULL
   AND (r.is_vacant = true OR (r.is_vacant = false AND p.created_at < r.admission_ref));

WITH ref_dates AS (
  SELECT id AS patient_id, is_vacant,
         COALESCE(admitted_at::timestamptz, admission_date::timestamptz,
                  uti_admission_date::timestamptz, updated_at, created_at) AS admission_ref
  FROM public.patients
)
UPDATE public.vital_signs vs
   SET archived_at = now(),
       archived_from_patient_id = vs.patient_id,
       archive_reason = 'retroactive_cleanup_2026_05_24'
  FROM ref_dates r
 WHERE vs.patient_id = r.patient_id
   AND vs.archived_at IS NULL
   AND (r.is_vacant = true OR (r.is_vacant = false AND vs.created_at < r.admission_ref));

WITH ref_dates AS (
  SELECT id AS patient_id, is_vacant,
         COALESCE(admitted_at::timestamptz, admission_date::timestamptz,
                  uti_admission_date::timestamptz, updated_at, created_at) AS admission_ref
  FROM public.patients
)
UPDATE public.exam_requests er
   SET archived_at = now(),
       archived_from_patient_id = er.patient_id,
       archive_reason = 'retroactive_cleanup_2026_05_24'
  FROM ref_dates r
 WHERE er.patient_id = r.patient_id
   AND er.archived_at IS NULL
   AND (r.is_vacant = true OR (r.is_vacant = false AND er.created_at < r.admission_ref));

WITH ref_dates AS (
  SELECT id AS patient_id, is_vacant,
         COALESCE(admitted_at::timestamptz, admission_date::timestamptz,
                  uti_admission_date::timestamptz, updated_at, created_at) AS admission_ref
  FROM public.patients
)
UPDATE public.culture_results cr
   SET archived_at = now(),
       archived_from_patient_id = cr.patient_id,
       archive_reason = 'retroactive_cleanup_2026_05_24'
  FROM ref_dates r
 WHERE cr.patient_id = r.patient_id
   AND cr.archived_at IS NULL
   AND (r.is_vacant = true OR (r.is_vacant = false AND cr.created_at < r.admission_ref));

WITH ref_dates AS (
  SELECT id AS patient_id, is_vacant,
         COALESCE(admitted_at::timestamptz, admission_date::timestamptz,
                  uti_admission_date::timestamptz, updated_at, created_at) AS admission_ref
  FROM public.patients
)
UPDATE public.medical_records mr
   SET archived_at = now(),
       archived_from_patient_id = mr.patient_id,
       archive_reason = 'retroactive_cleanup_2026_05_24'
  FROM ref_dates r
 WHERE mr.patient_id = r.patient_id
   AND mr.archived_at IS NULL
   AND (r.is_vacant = true OR (r.is_vacant = false AND mr.created_at < r.admission_ref));

WITH ref_dates AS (
  SELECT id AS patient_id, is_vacant,
         COALESCE(admitted_at::timestamptz, admission_date::timestamptz,
                  uti_admission_date::timestamptz, updated_at, created_at) AS admission_ref
  FROM public.patients
)
UPDATE public.saps3_assessments s
   SET archived_at = now(),
       archived_from_patient_id = s.patient_id,
       archive_reason = 'retroactive_cleanup_2026_05_24'
  FROM ref_dates r
 WHERE s.patient_id = r.patient_id
   AND s.archived_at IS NULL
   AND (r.is_vacant = true OR (r.is_vacant = false AND s.created_at < r.admission_ref));

WITH ref_dates AS (
  SELECT id AS patient_id, is_vacant,
         COALESCE(admitted_at::timestamptz, admission_date::timestamptz,
                  uti_admission_date::timestamptz, updated_at, created_at) AS admission_ref
  FROM public.patients
)
UPDATE public.conduct_history ch
   SET archived_at = now(),
       archived_from_patient_id = ch.patient_id,
       archive_reason = 'retroactive_cleanup_2026_05_24'
  FROM ref_dates r
 WHERE ch.patient_id = r.patient_id
   AND ch.archived_at IS NULL
   AND (r.is_vacant = true OR (r.is_vacant = false AND ch.created_at < r.admission_ref));