CREATE OR REPLACE FUNCTION public.autolink_patient_registry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_registry_id uuid;
  v_cpf text;
  v_medical_record text;
BEGIN
  -- Só atua se patient_registry_id estiver NULL
  IF NEW.patient_registry_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 1) Tenta resolver via pre_admissions (mesmo leito + unidade, mais recente)
  SELECT pa.patient_registry_id, pa.cpf, pa.medical_record
    INTO v_registry_id, v_cpf, v_medical_record
  FROM public.pre_admissions pa
  WHERE pa.hospital_unit_id = NEW.hospital_unit_id
    AND pa.destination_bed = NEW.bed_number
    AND pa.patient_registry_id IS NOT NULL
  ORDER BY pa.created_at DESC
  LIMIT 1;

  IF v_registry_id IS NOT NULL THEN
    NEW.patient_registry_id := v_registry_id;
    IF NEW.medical_record IS NULL AND v_medical_record IS NOT NULL THEN
      NEW.medical_record := v_medical_record;
    END IF;
    RETURN NEW;
  END IF;

  -- 2) Fallback: tenta via CPF da pre_admission do mesmo leito (registry resolvido por CPF)
  SELECT pa.cpf, pa.medical_record
    INTO v_cpf, v_medical_record
  FROM public.pre_admissions pa
  WHERE pa.hospital_unit_id = NEW.hospital_unit_id
    AND pa.destination_bed = NEW.bed_number
    AND pa.cpf IS NOT NULL
  ORDER BY pa.created_at DESC
  LIMIT 1;

  IF v_cpf IS NOT NULL THEN
    SELECT pr.id INTO v_registry_id
    FROM public.patient_registry pr
    WHERE pr.cpf = v_cpf
    LIMIT 1;

    IF v_registry_id IS NOT NULL THEN
      NEW.patient_registry_id := v_registry_id;
      IF NEW.medical_record IS NULL AND v_medical_record IS NOT NULL THEN
        NEW.medical_record := v_medical_record;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS patients_autolink_registry ON public.patients;
CREATE TRIGGER patients_autolink_registry
BEFORE INSERT OR UPDATE OF bed_number, hospital_unit_id, patient_registry_id ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.autolink_patient_registry();