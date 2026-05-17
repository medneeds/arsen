-- =====================================================
-- BLINDAGEM ANTI-TROCA DE PACIENTE (CAMADA DE BANCO)
-- =====================================================

-- 1) Tabela de auditoria (append-only)
CREATE TABLE IF NOT EXISTS public.prescription_affinity_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  record_id UUID,
  patient_registry_id UUID,
  patient_name_attempted TEXT,
  patient_name_corrected TEXT,
  hospital_unit_id UUID,
  reason TEXT NOT NULL,
  payload JSONB,
  performed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prescription_affinity_audit_created_at
  ON public.prescription_affinity_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prescription_affinity_audit_registry
  ON public.prescription_affinity_audit(patient_registry_id);

ALTER TABLE public.prescription_affinity_audit ENABLE ROW LEVEL SECURITY;

-- Append-only: bloqueia UPDATE/DELETE para todos
CREATE POLICY "affinity_audit_no_update"
  ON public.prescription_affinity_audit FOR UPDATE
  USING (false);

CREATE POLICY "affinity_audit_no_delete"
  ON public.prescription_affinity_audit FOR DELETE
  USING (false);

-- Leitura: apenas admin/desenvolvedor
CREATE POLICY "affinity_audit_read_admin_dev"
  ON public.prescription_affinity_audit FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_developer_profile(auth.uid())
  );

-- INSERT permitido (escrito pelos triggers SECURITY DEFINER)
CREATE POLICY "affinity_audit_insert_any"
  ON public.prescription_affinity_audit FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- 2) Trigger de afinidade para PRESCRIPTIONS
-- =====================================================
CREATE OR REPLACE FUNCTION public.enforce_prescription_patient_affinity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_registry RECORD;
  v_patient_id UUID;
  v_patient_name_attempted TEXT;
  v_prescription_unit UUID;
  v_matching_registry_id UUID;
  v_match_count INT;
BEGIN
  v_patient_id := NULLIF(NEW.patient_data->>'id','')::UUID;
  v_patient_name_attempted := NEW.patient_name;
  v_prescription_unit := NEW.hospital_unit_id;

  -- Caso 1: tem patient_registry_id explícito → valida unidade + sobrescreve nome
  IF NEW.patient_registry_id IS NOT NULL THEN
    SELECT pr.id, pr.full_name, p.hospital_unit_id AS patient_unit
      INTO v_registry
      FROM public.patient_registry pr
      LEFT JOIN public.patients p ON p.patient_registry_id = pr.id
     WHERE pr.id = NEW.patient_registry_id
     LIMIT 1;

    IF v_registry.id IS NULL THEN
      RAISE EXCEPTION 'AFINIDADE: patient_registry_id % não existe', NEW.patient_registry_id
        USING ERRCODE = 'check_violation';
    END IF;

    -- Sobrescreve nome com fonte de verdade
    IF v_registry.full_name IS NOT NULL
       AND upper(trim(v_registry.full_name)) <> upper(trim(COALESCE(NEW.patient_name,''))) THEN
      INSERT INTO public.prescription_affinity_audit (
        table_name, operation, record_id, patient_registry_id,
        patient_name_attempted, patient_name_corrected,
        hospital_unit_id, reason, payload, performed_by
      ) VALUES (
        TG_TABLE_NAME, TG_OP, NEW.id, NEW.patient_registry_id,
        NEW.patient_name, v_registry.full_name,
        v_prescription_unit,
        'NAME_OVERRIDDEN_FROM_REGISTRY',
        jsonb_build_object('patient_data', NEW.patient_data),
        auth.uid()
      );
      NEW.patient_name := v_registry.full_name;
    END IF;

    RETURN NEW;
  END IF;

  -- Caso 2: sem patient_registry_id → tenta encontrar match único e registra na auditoria
  IF v_patient_name_attempted IS NOT NULL AND v_prescription_unit IS NOT NULL THEN
    SELECT COUNT(*), MIN(pr.id)
      INTO v_match_count, v_matching_registry_id
      FROM public.patient_registry pr
      JOIN public.patients p ON p.patient_registry_id = pr.id
     WHERE p.hospital_unit_id = v_prescription_unit
       AND upper(trim(pr.full_name)) = upper(trim(v_patient_name_attempted))
       AND pr.merged_into_registry_id IS NULL;

    IF v_match_count >= 1 THEN
      INSERT INTO public.prescription_affinity_audit (
        table_name, operation, record_id, patient_registry_id,
        patient_name_attempted, hospital_unit_id, reason, payload, performed_by
      ) VALUES (
        TG_TABLE_NAME, TG_OP, NEW.id,
        CASE WHEN v_match_count = 1 THEN v_matching_registry_id ELSE NULL END,
        v_patient_name_attempted, v_prescription_unit,
        CASE WHEN v_match_count = 1
             THEN 'WRITE_WITHOUT_REGISTRY_ID_UNIQUE_MATCH'
             ELSE 'WRITE_WITHOUT_REGISTRY_ID_AMBIGUOUS_HOMONYM'
        END,
        jsonb_build_object('match_count', v_match_count),
        auth.uid()
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_prescription_affinity ON public.prescriptions;
CREATE TRIGGER trg_enforce_prescription_affinity
  BEFORE INSERT OR UPDATE ON public.prescriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_prescription_patient_affinity();

-- =====================================================
-- 3) Trigger de afinidade para PATIENT_ENCOUNTERS
-- =====================================================
CREATE OR REPLACE FUNCTION public.enforce_encounter_patient_affinity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_registry RECORD;
BEGIN
  IF NEW.registry_id IS NOT NULL THEN
    SELECT pr.id, pr.full_name, p.hospital_unit_id AS patient_unit
      INTO v_registry
      FROM public.patient_registry pr
      LEFT JOIN public.patients p ON p.patient_registry_id = pr.id
     WHERE pr.id = NEW.registry_id
     LIMIT 1;

    IF v_registry.id IS NULL THEN
      RAISE EXCEPTION 'AFINIDADE: registry_id % não existe', NEW.registry_id
        USING ERRCODE = 'check_violation';
    END IF;

    -- Auditoria de divergência de nome (não bloqueia, atendimento pode ser legacy)
    IF v_registry.full_name IS NOT NULL
       AND NEW.patient_name IS NOT NULL
       AND upper(trim(v_registry.full_name)) <> upper(trim(NEW.patient_name)) THEN
      INSERT INTO public.prescription_affinity_audit (
        table_name, operation, record_id, patient_registry_id,
        patient_name_attempted, patient_name_corrected,
        hospital_unit_id, reason, performed_by
      ) VALUES (
        TG_TABLE_NAME, TG_OP, NEW.id, NEW.registry_id,
        NEW.patient_name, v_registry.full_name,
        NEW.hospital_unit_id,
        'ENCOUNTER_NAME_OVERRIDDEN_FROM_REGISTRY',
        auth.uid()
      );
      NEW.patient_name := v_registry.full_name;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_encounter_affinity ON public.patient_encounters;
CREATE TRIGGER trg_enforce_encounter_affinity
  BEFORE INSERT OR UPDATE ON public.patient_encounters
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_encounter_patient_affinity();