-- Correção imediata: triggers genéricos precisam tratar prescriptions, que não tem coluna patient_id

CREATE OR REPLACE FUNCTION public.autofill_encounter_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_patient_id uuid;
BEGIN
  IF NEW.encounter_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'prescriptions' THEN
    BEGIN
      v_patient_id := NULLIF(NEW.patient_data->>'id','')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_patient_id := NULL;
    END;
  ELSE
    v_patient_id := NEW.patient_id;
  END IF;

  IF v_patient_id IS NOT NULL THEN
    NEW.encounter_id := public.resolve_active_encounter_for_patient(v_patient_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.autofill_patient_registry_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_patient_id uuid;
BEGIN
  IF NEW.patient_registry_id IS NULL AND NEW.encounter_id IS NOT NULL THEN
    SELECT pe.registry_id
      INTO NEW.patient_registry_id
      FROM public.patient_encounters pe
     WHERE pe.id = NEW.encounter_id
     LIMIT 1;
  END IF;

  IF NEW.patient_registry_id IS NULL THEN
    IF TG_TABLE_NAME = 'prescriptions' THEN
      BEGIN
        v_patient_id := NULLIF(NEW.patient_data->>'id','')::uuid;
      EXCEPTION WHEN OTHERS THEN
        v_patient_id := NULL;
      END;
    ELSE
      v_patient_id := NEW.patient_id;
    END IF;

    IF v_patient_id IS NOT NULL THEN
      SELECT p.patient_registry_id
        INTO NEW.patient_registry_id
        FROM public.patients p
       WHERE p.id = v_patient_id
       LIMIT 1;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;