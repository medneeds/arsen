
-- ============================================================
-- 1) RPC: archive_bed_history
-- ============================================================
CREATE OR REPLACE FUNCTION public.archive_bed_history(
  p_patient_id uuid,
  p_reason text DEFAULT 'bed_deallocation'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_registry uuid;
  v_current_name text;
  v_ev int := 0;
  v_rx int := 0;
  v_ex int := 0;
  v_cu int := 0;
BEGIN
  IF p_patient_id IS NULL THEN
    RAISE EXCEPTION 'patient_id é obrigatório';
  END IF;

  SELECT patient_registry_id, NULLIF(trim(name),'')
    INTO v_current_registry, v_current_name
  FROM public.patients
  WHERE id = p_patient_id;

  -- Critério de "ex-ocupante":
  -- registro vinculado a este patient_id (linha do leito) cujo registry é DIFERENTE do registry atual,
  -- ou ambos sem registry mas com nome do paciente diferente do nome atual da linha.
  -- Se a linha está vaga (registry NULL e name vazio), qualquer registro herdado é ex-ocupante.

  WITH upd AS (
    UPDATE public.clinical_evolutions ce
       SET archived_at = now(),
           archived_from_patient_id = COALESCE(ce.archived_from_patient_id, ce.patient_id),
           archive_reason = COALESCE(ce.archive_reason, p_reason)
     WHERE ce.patient_id = p_patient_id
       AND ce.archived_at IS NULL
       AND (
         (v_current_registry IS NULL AND (ce.patient_registry_id IS NOT NULL OR ce.patient_name IS DISTINCT FROM v_current_name))
         OR (v_current_registry IS NOT NULL AND ce.patient_registry_id IS DISTINCT FROM v_current_registry)
       )
     RETURNING 1
  ) SELECT count(*) INTO v_ev FROM upd;

  WITH upd AS (
    UPDATE public.prescriptions p
       SET archived_at = now(),
           archived_from_patient_id = COALESCE(p.archived_from_patient_id, NULLIF(p.patient_data->>'id','')::uuid),
           archive_reason = COALESCE(p.archive_reason, p_reason)
     WHERE NULLIF(p.patient_data->>'id','')::uuid = p_patient_id
       AND p.archived_at IS NULL
       AND (
         (v_current_registry IS NULL AND (p.patient_registry_id IS NOT NULL OR p.patient_name IS DISTINCT FROM v_current_name))
         OR (v_current_registry IS NOT NULL AND p.patient_registry_id IS DISTINCT FROM v_current_registry)
       )
     RETURNING 1
  ) SELECT count(*) INTO v_rx FROM upd;

  WITH upd AS (
    UPDATE public.exam_requests er
       SET archived_at = now(),
           archived_from_patient_id = COALESCE(er.archived_from_patient_id, er.patient_id),
           archive_reason = COALESCE(er.archive_reason, p_reason)
     WHERE er.patient_id = p_patient_id
       AND er.archived_at IS NULL
       AND (
         (v_current_registry IS NULL AND (er.patient_registry_id IS NOT NULL OR er.patient_name IS DISTINCT FROM v_current_name))
         OR (v_current_registry IS NOT NULL AND er.patient_registry_id IS DISTINCT FROM v_current_registry)
       )
     RETURNING 1
  ) SELECT count(*) INTO v_ex FROM upd;

  WITH upd AS (
    UPDATE public.culture_results cr
       SET archived_at = now(),
           archived_from_patient_id = COALESCE(cr.archived_from_patient_id, cr.patient_id),
           archive_reason = COALESCE(cr.archive_reason, p_reason)
     WHERE cr.patient_id = p_patient_id
       AND cr.archived_at IS NULL
       AND (
         (v_current_registry IS NULL AND (cr.patient_registry_id IS NOT NULL OR cr.patient_name IS DISTINCT FROM v_current_name))
         OR (v_current_registry IS NOT NULL AND cr.patient_registry_id IS DISTINCT FROM v_current_registry)
       )
     RETURNING 1
  ) SELECT count(*) INTO v_cu FROM upd;

  -- Auditoria (best-effort)
  BEGIN
    INSERT INTO public.audit_logs (
      user_id, action, table_name, record_id, new_data
    ) VALUES (
      auth.uid(), 'INSERT'::audit_action, 'archive_bed_history', p_patient_id,
      jsonb_build_object(
        'reason', p_reason,
        'current_registry', v_current_registry,
        'current_name', v_current_name,
        'evolutions', v_ev,
        'prescriptions', v_rx,
        'exam_requests', v_ex,
        'culture_results', v_cu,
        'at', now()
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'patient_id', p_patient_id,
    'reason', p_reason,
    'current_registry', v_current_registry,
    'archived', jsonb_build_object(
      'clinical_evolutions', v_ev,
      'prescriptions', v_rx,
      'exam_requests', v_ex,
      'culture_results', v_cu
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.archive_bed_history(uuid, text) TO authenticated, service_role;

-- ============================================================
-- 2) Trigger: dispara archive automático ao desalocar leito
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_archive_bed_history_on_deallocation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_was_occupied boolean;
  v_is_now_vacant boolean;
BEGIN
  v_was_occupied :=
    COALESCE(OLD.is_vacant, true) = false
    OR OLD.patient_registry_id IS NOT NULL
    OR COALESCE(NULLIF(trim(OLD.name), ''), '') <> '';

  v_is_now_vacant :=
    COALESCE(NEW.is_vacant, false) = true
    OR (NEW.patient_registry_id IS NULL AND COALESCE(NULLIF(trim(NEW.name), ''), '') = '');

  IF v_was_occupied AND v_is_now_vacant THEN
    PERFORM public.archive_bed_history(NEW.id, 'bed_deallocation_auto');
  ELSIF NEW.patient_registry_id IS DISTINCT FROM OLD.patient_registry_id
        AND NEW.patient_registry_id IS NOT NULL
        AND OLD.patient_registry_id IS NOT NULL THEN
    -- Troca direta de ocupante sem passar por vago (defensivo): também arquiva resíduos do anterior
    PERFORM public.archive_bed_history(NEW.id, 'bed_occupant_swap');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_archive_bed_history ON public.patients;
CREATE TRIGGER trg_archive_bed_history
AFTER UPDATE OF is_vacant, patient_registry_id, name ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.trg_archive_bed_history_on_deallocation();

-- ============================================================
-- 3) Limpeza retroativa: todos os leitos atualmente vagos
-- ============================================================
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id FROM public.patients
    WHERE COALESCE(is_vacant, false) = true
       OR (patient_registry_id IS NULL AND COALESCE(NULLIF(trim(name), ''), '') = '')
  LOOP
    PERFORM public.archive_bed_history(r.id, 'retroactive_cleanup_vacant_beds');
  END LOOP;
END $$;
