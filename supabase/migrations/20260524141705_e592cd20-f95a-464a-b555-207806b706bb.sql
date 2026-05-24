CREATE OR REPLACE FUNCTION public.autolink_patient_registry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_registry_id uuid;
  v_cpf text;
  v_medical_record text;
  v_name_norm text;
  v_reg_name_norm text;
BEGIN
  v_name_norm := lower(trim(public.unaccent_immutable(coalesce(NEW.name, ''))));

  -- Leito vazio nunca deve manter vínculo de identidade/prontuário do ocupante anterior.
  IF coalesce(NEW.is_vacant, false) = true OR v_name_norm = '' THEN
    NEW.patient_registry_id := NULL;
    NEW.medical_record := NULL;
    RETURN NEW;
  END IF;

  -- Valida qualquer vínculo já informado. O registro permanente só é aceito
  -- se o nome do registry também conferir com o nome atual do paciente.
  IF NEW.patient_registry_id IS NOT NULL THEN
    SELECT lower(trim(public.unaccent_immutable(coalesce(pr.full_name, '')))), pr.medical_record
      INTO v_reg_name_norm, v_medical_record
    FROM public.patient_registry pr
    WHERE pr.id = NEW.patient_registry_id;

    IF v_reg_name_norm IS NULL OR v_reg_name_norm <> v_name_norm THEN
      NEW.patient_registry_id := NULL;
      -- Se o prontuário era o do vínculo rejeitado, limpa para não carregar dado antigo.
      IF v_medical_record IS NOT NULL AND NEW.medical_record = v_medical_record THEN
        NEW.medical_record := NULL;
      END IF;
    ELSE
      IF v_medical_record IS NOT NULL AND NEW.medical_record IS DISTINCT FROM v_medical_record THEN
        NEW.medical_record := v_medical_record;
      END IF;
      RETURN NEW;
    END IF;
  END IF;

  -- 1) Resolver via pre_admissions (mesmo leito + unidade + nome), mas só
  -- quando o registry apontado também pertence ao mesmo nome.
  SELECT pa.patient_registry_id, pa.cpf, pa.medical_record
    INTO v_registry_id, v_cpf, v_medical_record
  FROM public.pre_admissions pa
  JOIN public.patient_registry pr ON pr.id = pa.patient_registry_id
  WHERE pa.hospital_unit_id = NEW.hospital_unit_id
    AND pa.destination_bed = NEW.bed_number
    AND pa.patient_registry_id IS NOT NULL
    AND lower(trim(public.unaccent_immutable(coalesce(pa.patient_name, '')))) = v_name_norm
    AND lower(trim(public.unaccent_immutable(coalesce(pr.full_name, '')))) = v_name_norm
  ORDER BY pa.created_at DESC
  LIMIT 1;

  IF v_registry_id IS NOT NULL THEN
    NEW.patient_registry_id := v_registry_id;
    IF v_medical_record IS NOT NULL THEN
      NEW.medical_record := v_medical_record;
    END IF;
    RETURN NEW;
  END IF;

  -- 2) Fallback por CPF da pré-admissão, também exigindo nome igual no registry.
  SELECT pr.id, pa.medical_record
    INTO v_registry_id, v_medical_record
  FROM public.pre_admissions pa
  JOIN public.patient_registry pr
    ON regexp_replace(coalesce(pr.cpf, ''), '\\D', '', 'g') = regexp_replace(coalesce(pa.cpf, ''), '\\D', '', 'g')
  WHERE pa.hospital_unit_id = NEW.hospital_unit_id
    AND pa.destination_bed = NEW.bed_number
    AND pa.cpf IS NOT NULL
    AND lower(trim(public.unaccent_immutable(coalesce(pa.patient_name, '')))) = v_name_norm
    AND lower(trim(public.unaccent_immutable(coalesce(pr.full_name, '')))) = v_name_norm
  ORDER BY pa.created_at DESC, pr.created_at DESC
  LIMIT 1;

  IF v_registry_id IS NOT NULL THEN
    NEW.patient_registry_id := v_registry_id;
    IF v_medical_record IS NOT NULL THEN
      NEW.medical_record := v_medical_record;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS patients_autolink_registry ON public.patients;
CREATE TRIGGER patients_autolink_registry
BEFORE INSERT OR UPDATE OF name, bed_number, hospital_unit_id, patient_registry_id, medical_record, is_vacant
ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.autolink_patient_registry();

CREATE OR REPLACE FUNCTION public.auto_vacate_on_discharge()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- INSERT: comportamento existente
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.name, '') = '' THEN
      NEW.is_vacant := true;
      NEW.patient_registry_id := NULL;
      NEW.medical_record := NULL;
    ELSE
      NEW.is_vacant := COALESCE(NEW.is_vacant, false);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Transição para alta/óbito/liberação final (name esvaziado)
    IF COALESCE(OLD.name, '') <> '' AND COALESCE(NEW.name, '') = '' THEN
      BEGIN
        PERFORM public.archive_bed_history(OLD.id);
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'archive_bed_history falhou para patient_id=%: %', OLD.id, SQLERRM;
      END;

      NEW.is_vacant := true;
      NEW.age := '';
      NEW.diagnoses := '';
      NEW.medical_history := '';
      NEW.relevant_exams := '';
      NEW.pendencies := '';
      NEW.schedule := '';
      NEW.admission_history := '';
      NEW.admission_date := NULL;
      NEW.medical_responsibility := NULL;
      NEW.uti_admission_date := NULL;
      NEW.uti_discharge_prediction := NULL;
      NEW.uti_allergies := NULL;
      NEW.uti_admission_reason := NULL;
      NEW.uti_current_status := NULL;
      NEW.uti_devices := NULL;
      NEW.uti_cultures_antibiotics := NULL;
      NEW.uti_specialties := NULL;
      NEW.uti_origin_sector := NULL;
      NEW.uti_daily_conducts := NULL;
      NEW.psm_status := NULL;
      NEW.clinical_status := NULL;
      NEW.highlighted_pendencies := ARRAY[]::text[];
      NEW.highlighted_diagnoses := ARRAY[]::text[];
      NEW.highlighted_medical_history := ARRAY[]::text[];
      NEW.highlighted_conducts := ARRAY[]::text[];
      NEW.is_palliative := false;
      NEW.isolation_precautions := NULL;
      NEW.hospital_discharge_prediction := NULL;
      NEW.uti_weight_kg := NULL;
      NEW.patient_registry_id := NULL;
      NEW.medical_record := NULL;
    ELSIF COALESCE(OLD.name, '') = '' AND COALESCE(NEW.name, '') <> '' THEN
      NEW.is_vacant := false;
    ELSIF COALESCE(NEW.name, '') = '' THEN
      NEW.is_vacant := true;
      NEW.patient_registry_id := NULL;
      NEW.medical_record := NULL;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;