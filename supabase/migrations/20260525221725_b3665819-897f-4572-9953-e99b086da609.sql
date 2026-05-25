CREATE OR REPLACE FUNCTION public.autolink_encounter_patient_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ids uuid[];
BEGIN
  -- Só age se patient_id está NULL e temos nome+unidade
  IF NEW.patient_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.patient_name IS NULL OR length(trim(NEW.patient_name)) = 0 THEN
    RETURN NEW;
  END IF;
  IF NEW.hospital_unit_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Coleta até 2 candidatos: paciente em leito ativo na mesma unidade
  SELECT array_agg(p.id)
    INTO v_ids
  FROM (
    SELECT id
      FROM public.patients
     WHERE upper(name) = upper(NEW.patient_name)
       AND hospital_unit_id = NEW.hospital_unit_id
       AND is_vacant = false
     LIMIT 2
  ) p;

  -- Match único → vincula
  IF v_ids IS NOT NULL AND array_length(v_ids, 1) = 1 THEN
    NEW.patient_id := v_ids[1];
  END IF;

  RETURN NEW;
END;
$function$;