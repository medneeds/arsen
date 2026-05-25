-- Fase 1 (Opção A): triggers de afinidade só validam registry_id quando ele MUDA
-- Permite UPDATEs de repoint/patient swap quando o registry está órfão (legacy)
-- mantendo a validação rigorosa em INSERT e em UPDATE que troca o registry_id.

CREATE OR REPLACE FUNCTION public.enforce_encounter_patient_affinity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_registry RECORD;
  v_should_validate BOOLEAN;
BEGIN
  -- Só valida quando: INSERT com registry_id, ou UPDATE que altera registry_id
  v_should_validate := NEW.registry_id IS NOT NULL
    AND (
      TG_OP = 'INSERT'
      OR (TG_OP = 'UPDATE' AND NEW.registry_id IS DISTINCT FROM OLD.registry_id)
    );

  IF v_should_validate THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.enforce_prescription_patient_affinity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_registry RECORD;
  v_patient_id UUID;
  v_patient_name_attempted TEXT;
  v_prescription_unit UUID;
  v_matching_registry_id UUID;
  v_match_count INT;
  v_should_validate BOOLEAN;
BEGIN
  v_patient_id := NULLIF(NEW.patient_data->>'id','')::UUID;
  v_patient_name_attempted := NEW.patient_name;
  v_prescription_unit := NEW.hospital_unit_id;

  -- Só valida registry quando: INSERT com registry, ou UPDATE que MUDA registry
  v_should_validate := NEW.patient_registry_id IS NOT NULL
    AND (
      TG_OP = 'INSERT'
      OR (TG_OP = 'UPDATE' AND NEW.patient_registry_id IS DISTINCT FROM OLD.patient_registry_id)
    );

  IF v_should_validate THEN
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

  -- Caminho legacy: INSERT sem registry → tenta achar match
  IF TG_OP = 'INSERT'
     AND NEW.patient_registry_id IS NULL
     AND v_patient_name_attempted IS NOT NULL
     AND v_prescription_unit IS NOT NULL THEN
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
$function$;