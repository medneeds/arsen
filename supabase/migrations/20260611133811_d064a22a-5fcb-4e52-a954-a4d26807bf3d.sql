
-- ============================================================
-- PROBLEMA 2 — Guard ampliado na trigger tg_archive_on_bed_vacate
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_archive_on_bed_vacate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (TG_OP = 'UPDATE'
          AND OLD.is_vacant IS DISTINCT FROM TRUE
          AND NEW.is_vacant = TRUE) THEN
    RETURN NEW;
  END IF;

  -- GUARD 1: patient_movements registrado nas últimas 24h
  IF EXISTS (
    SELECT 1 FROM public.patient_movements pm
    WHERE pm.patient_id = OLD.id
      AND (pm.movement_type ILIKE 'TRANSFERENCIA_INTERNA%'
           OR pm.movement_type ILIKE 'TRANSFER%NCIA INTERNA%')
      AND pm.created_at >= (now() - interval '24 hours')
  ) THEN
    RETURN NEW;
  END IF;

  -- GUARD 2: internal_transfer_requests pending (cobre race condition)
  IF EXISTS (
    SELECT 1 FROM public.internal_transfer_requests itr
    WHERE itr.source_patient_id = OLD.id
      AND itr.status = 'pending'
  ) THEN
    RETURN NEW;
  END IF;

  -- GUARD 3: encounter ativo no mesmo registry → não é alta real
  IF OLD.patient_registry_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.patient_encounters pe
      WHERE pe.registry_id = OLD.patient_registry_id
        AND pe.status = 'active'
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Sem guardas → alta/óbito real
  PERFORM public.archive_patient_bed_data(OLD.id, 'auto_trigger_bed_vacated');
  RETURN NEW;
END;
$$;

-- ============================================================
-- PROBLEMA 3 — Guard interno em archive_patient_bed_data
-- (preserva corpo existente; adiciona 2 verificações no topo)
-- ============================================================
CREATE OR REPLACE FUNCTION public.archive_patient_bed_data(p_patient_id uuid, p_reason text DEFAULT 'bed_vacated'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_counts jsonb := '{}'::jsonb;
  v_n int;
  v_now timestamptz := now();
  v_registry_id uuid;
BEGIN
  IF p_patient_id IS NULL THEN RAISE EXCEPTION 'p_patient_id é obrigatório'; END IF;

  -- GUARD A: transferência interna pendente
  IF EXISTS (
    SELECT 1 FROM public.internal_transfer_requests
    WHERE source_patient_id = p_patient_id AND status = 'pending'
  ) THEN
    RAISE WARNING '[archive_patient_bed_data] bloqueado: transferência interna pendente (patient %)', p_patient_id;
    RETURN jsonb_build_object('success', false, 'blocked_by', 'pending_internal_transfer', 'patient_id', p_patient_id);
  END IF;

  -- GUARD B: encounter ativo para o mesmo registry
  SELECT patient_registry_id INTO v_registry_id FROM public.patients WHERE id = p_patient_id;
  IF v_registry_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.patient_encounters
    WHERE registry_id = v_registry_id AND status = 'active'
  ) THEN
    RAISE WARNING '[archive_patient_bed_data] bloqueado: encounter ativo para registry % (patient %)', v_registry_id, p_patient_id;
    RETURN jsonb_build_object('success', false, 'blocked_by', 'active_encounter', 'patient_id', p_patient_id, 'registry_id', v_registry_id);
  END IF;

  -- ===== Corpo original preservado =====
  BEGIN UPDATE public.prescriptions SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE archived_at IS NULL AND (patient_data->>'id')::uuid = p_patient_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('prescriptions', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('prescriptions_error', SQLERRM); END;
  BEGIN UPDATE public.clinical_evolutions SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE patient_id = p_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('clinical_evolutions', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('clinical_evolutions_error', SQLERRM); END;
  BEGIN UPDATE public.vital_signs SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE patient_id = p_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('vital_signs', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('vital_signs_error', SQLERRM); END;
  BEGIN UPDATE public.exam_requests SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE patient_id = p_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('exam_requests', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('exam_requests_error', SQLERRM); END;
  BEGIN UPDATE public.culture_results SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE patient_id = p_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('culture_results', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('culture_results_error', SQLERRM); END;
  BEGIN UPDATE public.medical_records SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE patient_id = p_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('medical_records', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('medical_records_error', SQLERRM); END;
  BEGIN UPDATE public.saps3_assessments SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE patient_id = p_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('saps3_assessments', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('saps3_assessments_error', SQLERRM); END;
  BEGIN UPDATE public.conduct_history SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE patient_id = p_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('conduct_history', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('conduct_history_error', SQLERRM); END;
  BEGIN UPDATE public.round_sessions SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE patient_id = p_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('round_sessions', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('round_sessions_error', SQLERRM); END;
  BEGIN UPDATE public.admission_histories SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE patient_id = p_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('admission_histories', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('admission_histories_error', SQLERRM); END;
  BEGIN UPDATE public.discharge_documents SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE patient_id = p_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('discharge_documents', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('discharge_documents_error', SQLERRM); END;
  BEGIN UPDATE public.sepsis_protocols SET archived_at = v_now, archived_from_patient_id = p_patient_id, archive_reason = p_reason
     WHERE patient_id = p_patient_id AND archived_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('sepsis_protocols', v_n);
  EXCEPTION WHEN OTHERS THEN v_counts := v_counts || jsonb_build_object('sepsis_protocols_error', SQLERRM); END;

  BEGIN
    INSERT INTO public.audit_logs (action, table_name, record_id, performed_by, performed_at, metadata)
    VALUES ('ARCHIVE_PATIENT_BED_DATA', 'patients', p_patient_id, auth.uid(), v_now,
            jsonb_build_object('reason', p_reason, 'counts', v_counts, 'fn_version', 'v3_guarded'));
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', true, 'patient_id', p_patient_id,
    'archived_at', v_now, 'reason', p_reason, 'counts', v_counts);
END;
$function$;
