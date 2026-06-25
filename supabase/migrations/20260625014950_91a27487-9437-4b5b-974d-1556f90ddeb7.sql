CREATE OR REPLACE FUNCTION public.stamp_clinical_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_bed_registry uuid;
  v_encounter_id uuid;
BEGIN
  IF NEW.patient_id IS NULL THEN RETURN NEW; END IF;
  SELECT p.patient_registry_id INTO v_bed_registry
  FROM public.patients p WHERE p.id = NEW.patient_id;
  IF NEW.archived_at IS NULL AND v_bed_registry IS NOT NULL THEN
    NEW.patient_registry_id := v_bed_registry;
  ELSIF NEW.patient_registry_id IS NULL AND v_bed_registry IS NOT NULL THEN
    NEW.patient_registry_id := v_bed_registry;
  END IF;
  IF NEW.encounter_id IS NULL AND COALESCE(NEW.patient_registry_id, v_bed_registry) IS NOT NULL THEN
    SELECT pe.id INTO v_encounter_id
    FROM public.patient_encounters pe
    WHERE pe.registry_id = COALESCE(NEW.patient_registry_id, v_bed_registry)
      AND pe.status IS DISTINCT FROM 'closed'
    ORDER BY pe.created_at DESC LIMIT 1;
    IF v_encounter_id IS NULL THEN
      SELECT pe.id INTO v_encounter_id
      FROM public.patient_encounters pe
      WHERE pe.patient_id = NEW.patient_id
        AND pe.status IS DISTINCT FROM 'closed'
      ORDER BY pe.created_at DESC LIMIT 1;
    END IF;
    NEW.encounter_id := v_encounter_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.stamp_clinical_identity() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.stamp_clinical_identity_no_encounter()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_bed_registry uuid;
BEGIN
  IF NEW.patient_id IS NULL THEN RETURN NEW; END IF;
  SELECT p.patient_registry_id INTO v_bed_registry
  FROM public.patients p WHERE p.id = NEW.patient_id;
  IF NEW.archived_at IS NULL AND v_bed_registry IS NOT NULL THEN
    NEW.patient_registry_id := v_bed_registry;
  ELSIF NEW.patient_registry_id IS NULL AND v_bed_registry IS NOT NULL THEN
    NEW.patient_registry_id := v_bed_registry;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.stamp_clinical_identity_no_encounter() FROM PUBLIC, anon;

DO $$
DECLARE t text;
  with_enc text[] := ARRAY['exam_requests','culture_results','conduct_history','discharge_documents'];
BEGIN
  FOREACH t IN ARRAY with_enc LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_stamp_clinical_identity ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_stamp_clinical_identity BEFORE INSERT OR UPDATE OF patient_id, patient_registry_id, encounter_id ON public.%I FOR EACH ROW EXECUTE FUNCTION public.stamp_clinical_identity()', t);
  END LOOP;
END$$;

DROP TRIGGER IF EXISTS trg_stamp_clinical_identity ON public.medical_records;
CREATE TRIGGER trg_stamp_clinical_identity
  BEFORE INSERT OR UPDATE OF patient_id, patient_registry_id ON public.medical_records
  FOR EACH ROW EXECUTE FUNCTION public.stamp_clinical_identity_no_encounter();

CREATE OR REPLACE FUNCTION public.tg_archive_on_registry_swap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (TG_OP = 'UPDATE'
          AND OLD.patient_registry_id IS NOT NULL
          AND NEW.patient_registry_id IS NOT NULL
          AND OLD.patient_registry_id IS DISTINCT FROM NEW.patient_registry_id) THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.patient_encounters
             WHERE registry_id = OLD.patient_registry_id AND status = 'active') THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.internal_transfer_requests itr
             WHERE itr.source_patient_id = OLD.id AND itr.status = 'pending') THEN
    RETURN NEW;
  END IF;
  PERFORM public.archive_patient_bed_data(OLD.id, 'auto_trigger_registry_swap');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_archive_on_registry_swap ON public.patients;
CREATE TRIGGER trg_archive_on_registry_swap
  AFTER UPDATE OF patient_registry_id ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.tg_archive_on_registry_swap();

DO $cleanup$
DECLARE
  v_total jsonb := '{}'::jsonb;
  v_n int;
  v_tables text[] := ARRAY[
    'admission_histories','clinical_evolutions','exam_requests',
    'culture_results','conduct_history','medical_records','discharge_documents'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY v_tables LOOP
    EXECUTE format($q$
      UPDATE public.%I AS x
      SET archived_at = now(),
          archive_reason = 'cleanup_registry_mismatch_v1',
          archived_from_patient_id = x.patient_id
      FROM public.patients p
      WHERE p.id = x.patient_id
        AND x.archived_at IS NULL
        AND x.patient_registry_id IS NOT NULL
        AND p.patient_registry_id IS NOT NULL
        AND p.patient_registry_id <> x.patient_registry_id
    $q$, t);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_total := v_total || jsonb_build_object(t, v_n);
  END LOOP;
  BEGIN
    INSERT INTO public.audit_logs (action, table_name, user_id, created_at, new_data)
    VALUES ('UPDATE'::audit_action, 'patients', NULL, now(),
            jsonb_build_object('migration','bed-vs-registry-blindage-v2','op','CLEANUP_REGISTRY_MISMATCH_V1','counts',v_total));
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RAISE NOTICE 'cleanup_registry_mismatch_v1 counts: %', v_total;
END
$cleanup$;