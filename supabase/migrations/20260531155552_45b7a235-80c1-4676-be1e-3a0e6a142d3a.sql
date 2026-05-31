CREATE OR REPLACE FUNCTION public.autofill_encounter_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_patient_id uuid;
  v_registry_id uuid;
  v_encounter_id uuid;
BEGIN
  -- Se encounter_id já foi passado explicitamente, respeitar
  IF NEW.encounter_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Tentar resolver patient_id a partir do payload conforme a tabela
  IF TG_TABLE_NAME = 'prescriptions' THEN
    BEGIN
      v_patient_id := NULLIF(NEW.patient_data->>'id','')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_patient_id := NULL;
    END;
  ELSE
    BEGIN
      v_patient_id := NEW.patient_id;
    EXCEPTION WHEN OTHERS THEN
      v_patient_id := NULL;
    END;
  END IF;

  -- Registry quando disponível na linha
  BEGIN
    v_registry_id := NEW.patient_registry_id;
  EXCEPTION WHEN OTHERS THEN
    v_registry_id := NULL;
  END;

  -- Resolver encounter por patient_id primeiro
  IF v_patient_id IS NOT NULL THEN
    SELECT id INTO v_encounter_id
    FROM public.patient_encounters
    WHERE patient_id = v_patient_id
      AND status = 'active'
    ORDER BY admission_date DESC NULLS LAST, created_at DESC
    LIMIT 1;
  END IF;

  -- Fallback: resolver por registry_id (cobre pós-transferência interna)
  IF v_encounter_id IS NULL AND v_registry_id IS NOT NULL THEN
    SELECT id INTO v_encounter_id
    FROM public.patient_encounters
    WHERE registry_id = v_registry_id
      AND status = 'active'
    ORDER BY admission_date DESC NULLS LAST, created_at DESC
    LIMIT 1;
  END IF;

  NEW.encounter_id := v_encounter_id;
  RETURN NEW;
END;
$$;