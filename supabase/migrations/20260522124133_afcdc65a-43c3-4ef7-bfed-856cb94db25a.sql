-- Blindagem longitudinal: documentos clínicos seguem o paciente/atendimento, não o leito

-- 1) História admissional também passa a ter vínculo explícito com o atendimento
ALTER TABLE public.admission_histories
  ADD COLUMN IF NOT EXISTS encounter_id uuid REFERENCES public.patient_encounters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_admission_histories_encounter_id
  ON public.admission_histories(encounter_id)
  WHERE encounter_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admission_histories_registry_created_at
  ON public.admission_histories(patient_registry_id, created_at DESC)
  WHERE patient_registry_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prescriptions_registry_created_at
  ON public.prescriptions(patient_registry_id, created_at DESC)
  WHERE patient_registry_id IS NOT NULL;

-- 2) Resolver atendimento ativo com fallback seguro.
--    Antes: só achava se existisse encounter status='active' via registry.
--    Agora: aceita qualquer status não fechado e cai para patient_id quando necessário.
CREATE OR REPLACE FUNCTION public.resolve_active_encounter_for_patient(p_patient_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_registry_id uuid;
  v_encounter_id uuid;
BEGIN
  IF p_patient_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p.patient_registry_id
    INTO v_registry_id
  FROM public.patients p
  WHERE p.id = p_patient_id;

  IF v_registry_id IS NOT NULL THEN
    SELECT pe.id
      INTO v_encounter_id
    FROM public.patient_encounters pe
    WHERE pe.registry_id = v_registry_id
      AND COALESCE(pe.status, 'active') <> 'closed'
    ORDER BY pe.created_at DESC
    LIMIT 1;

    IF v_encounter_id IS NOT NULL THEN
      RETURN v_encounter_id;
    END IF;
  END IF;

  SELECT pe.id
    INTO v_encounter_id
  FROM public.patient_encounters pe
  WHERE pe.patient_id = p_patient_id
    AND COALESCE(pe.status, 'active') <> 'closed'
  ORDER BY pe.created_at DESC
  LIMIT 1;

  IF v_encounter_id IS NOT NULL THEN
    RETURN v_encounter_id;
  END IF;

  IF v_registry_id IS NOT NULL THEN
    SELECT pe.id
      INTO v_encounter_id
    FROM public.patient_encounters pe
    WHERE pe.registry_id = v_registry_id
    ORDER BY pe.created_at DESC
    LIMIT 1;

    IF v_encounter_id IS NOT NULL THEN
      RETURN v_encounter_id;
    END IF;
  END IF;

  SELECT pe.id
    INTO v_encounter_id
  FROM public.patient_encounters pe
  WHERE pe.patient_id = p_patient_id
  ORDER BY pe.created_at DESC
  LIMIT 1;

  RETURN v_encounter_id;
END;
$$;

-- 3) Carimbo de prontuário mais robusto: se não houver encounter_id, deriva direto do leito atual.
CREATE OR REPLACE FUNCTION public.autofill_patient_registry_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.patient_registry_id IS NULL AND NEW.encounter_id IS NOT NULL THEN
    SELECT pe.registry_id
      INTO NEW.patient_registry_id
      FROM public.patient_encounters pe
     WHERE pe.id = NEW.encounter_id
     LIMIT 1;
  END IF;

  IF NEW.patient_registry_id IS NULL AND NEW.patient_id IS NOT NULL THEN
    SELECT p.patient_registry_id
      INTO NEW.patient_registry_id
      FROM public.patients p
     WHERE p.id = NEW.patient_id
     LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

-- 4) Triggers de carimbo também em UPDATE, para corrigir linhas editadas/reabertas.
DROP TRIGGER IF EXISTS trg_autofill_encounter_clinical_evolutions ON public.clinical_evolutions;
CREATE TRIGGER trg_autofill_encounter_clinical_evolutions
  BEFORE INSERT OR UPDATE ON public.clinical_evolutions
  FOR EACH ROW EXECUTE FUNCTION public.autofill_encounter_id();

DROP TRIGGER IF EXISTS trg_autofill_encounter_exam_requests ON public.exam_requests;
CREATE TRIGGER trg_autofill_encounter_exam_requests
  BEFORE INSERT OR UPDATE ON public.exam_requests
  FOR EACH ROW EXECUTE FUNCTION public.autofill_encounter_id();

DROP TRIGGER IF EXISTS trg_autofill_encounter_culture_results ON public.culture_results;
CREATE TRIGGER trg_autofill_encounter_culture_results
  BEFORE INSERT OR UPDATE ON public.culture_results
  FOR EACH ROW EXECUTE FUNCTION public.autofill_encounter_id();

DROP TRIGGER IF EXISTS trg_autofill_encounter_prescriptions ON public.prescriptions;
CREATE TRIGGER trg_autofill_encounter_prescriptions
  BEFORE INSERT OR UPDATE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.autofill_encounter_id();

DROP TRIGGER IF EXISTS trg_autofill_encounter_admission_histories ON public.admission_histories;
CREATE TRIGGER trg_autofill_encounter_admission_histories
  BEFORE INSERT OR UPDATE ON public.admission_histories
  FOR EACH ROW EXECUTE FUNCTION public.autofill_encounter_id();

DROP TRIGGER IF EXISTS trg_prescriptions_autofill_registry ON public.prescriptions;
CREATE TRIGGER trg_prescriptions_autofill_registry
  BEFORE INSERT OR UPDATE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.autofill_patient_registry_id();

DROP TRIGGER IF EXISTS trg_admission_histories_autofill_registry ON public.admission_histories;
CREATE TRIGGER trg_admission_histories_autofill_registry
  BEFORE INSERT OR UPDATE ON public.admission_histories
  FOR EACH ROW EXECUTE FUNCTION public.autofill_patient_registry_id();

-- 5) Auditoria da blindagem aplicada
DO $$
BEGIN
  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_data)
  VALUES (
    auth.uid(),
    'INSERT'::audit_action,
    'clinical_document_identity_hardening',
    gen_random_uuid(),
    jsonb_build_object(
      'scope', 'evolution_admission_prescription_follow_patient',
      'fn_version', 'registry_encounter_first_v3',
      'at', now()
    )
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;