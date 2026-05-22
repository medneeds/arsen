-- Garantia sistêmica: paciente admitido/pre-admitido com prontuário precisa ter atendimento ativo

CREATE OR REPLACE FUNCTION public.ensure_active_encounter_for_patient_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing_id uuid;
BEGIN
  IF NEW.patient_registry_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.is_vacant, false) = true THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.admission_status, '') NOT IN ('admitido', 'pre_admitido', 'saps_pendente', 'aguardando_leito') THEN
    RETURN NEW;
  END IF;

  SELECT pe.id
    INTO v_existing_id
  FROM public.patient_encounters pe
  WHERE pe.registry_id = NEW.patient_registry_id
    AND COALESCE(pe.status, 'active') <> 'closed'
  ORDER BY pe.created_at DESC
  LIMIT 1;

  IF v_existing_id IS NULL THEN
    INSERT INTO public.patient_encounters (
      patient_id,
      registry_id,
      patient_name,
      hospital_unit_id,
      state_id,
      department,
      admission_date,
      status
    ) VALUES (
      NEW.id,
      NEW.patient_registry_id,
      COALESCE(NULLIF(trim(NEW.name), ''), 'PACIENTE SEM NOME'),
      NEW.hospital_unit_id,
      NEW.state_id,
      COALESCE(NULLIF(trim(NEW.department), ''), 'URGÊNCIA E EMERGÊNCIA ADULTO'),
      COALESCE(NEW.admitted_at, NEW.created_at, now()),
      'active'
    );
  ELSE
    UPDATE public.patient_encounters
       SET patient_id = NEW.id,
           patient_name = COALESCE(NULLIF(trim(NEW.name), ''), patient_name),
           hospital_unit_id = COALESCE(NEW.hospital_unit_id, hospital_unit_id),
           state_id = COALESCE(NEW.state_id, state_id),
           department = COALESCE(NULLIF(trim(NEW.department), ''), department),
           updated_at = now()
     WHERE id = v_existing_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_active_encounter_for_patient_row ON public.patients;
CREATE TRIGGER trg_ensure_active_encounter_for_patient_row
  AFTER INSERT OR UPDATE OF patient_registry_id, admission_status, is_vacant, name, hospital_unit_id, state_id, department, admitted_at
  ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_active_encounter_for_patient_row();