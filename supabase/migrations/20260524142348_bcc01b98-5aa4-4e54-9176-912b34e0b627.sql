CREATE OR REPLACE FUNCTION public.auto_vacate_on_discharge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_empty boolean := (OLD.name IS NULL OR trim(OLD.name) = '');
  v_new_empty boolean := (NEW.name IS NULL OR trim(NEW.name) = '');
BEGIN
  -- Disparou apenas na transição "ocupado -> vago" (nome esvaziado / null / só espaços)
  IF NOT v_old_empty AND v_new_empty THEN
    NEW.name := NULL;
    NEW.patient_registry_id := NULL;
    NEW.medical_record := NULL;
    NEW.cpf := NULL;
    NEW.birth_date := NULL;
    NEW.sex := NULL;
    NEW.mother_name := NULL;
    NEW.address := NULL;
    NEW.city := NULL;
    NEW.phone := NULL;
    NEW.cns := NULL;
    NEW.diagnosis := NULL;
    NEW.uti_allergies := NULL;
    NEW.uti_weight_kg := NULL;
    NEW.uti_devices := NULL;
    NEW.admission_date := NULL;
    NEW.admission_status := NULL;
  END IF;
  RETURN NEW;
END;
$$;