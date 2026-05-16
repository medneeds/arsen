
-- 1) Função que arquiva o histórico do leito antes da alta limpar a linha
CREATE OR REPLACE FUNCTION public.archive_bed_history(p_patient_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_old patients%ROWTYPE;
  v_archive_id uuid;
  v_has_children boolean := false;
  v_n int;
BEGIN
  IF p_patient_id IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO v_old FROM public.patients WHERE id = p_patient_id;
  IF v_old.id IS NULL THEN RETURN NULL; END IF;

  -- Verifica se há QUALQUER registro filho. Se não houver, não cria arquivo (evita poluir base).
  BEGIN SELECT EXISTS(SELECT 1 FROM public.clinical_evolutions WHERE patient_id = p_patient_id) INTO v_has_children; EXCEPTION WHEN OTHERS THEN NULL; END;
  IF NOT v_has_children THEN BEGIN SELECT EXISTS(SELECT 1 FROM public.admission_histories WHERE patient_id = p_patient_id) INTO v_has_children; EXCEPTION WHEN OTHERS THEN NULL; END; END IF;
  IF NOT v_has_children THEN BEGIN SELECT EXISTS(SELECT 1 FROM public.exam_requests WHERE patient_id = p_patient_id) INTO v_has_children; EXCEPTION WHEN OTHERS THEN NULL; END; END IF;
  IF NOT v_has_children THEN BEGIN SELECT EXISTS(SELECT 1 FROM public.culture_results WHERE patient_id = p_patient_id) INTO v_has_children; EXCEPTION WHEN OTHERS THEN NULL; END; END IF;
  IF NOT v_has_children THEN BEGIN SELECT EXISTS(SELECT 1 FROM public.conduct_history WHERE patient_id = p_patient_id) INTO v_has_children; EXCEPTION WHEN OTHERS THEN NULL; END; END IF;
  IF NOT v_has_children THEN BEGIN SELECT EXISTS(SELECT 1 FROM public.patient_movements WHERE patient_id = p_patient_id) INTO v_has_children; EXCEPTION WHEN OTHERS THEN NULL; END; END IF;
  IF NOT v_has_children THEN BEGIN SELECT EXISTS(SELECT 1 FROM public.prescriptions WHERE (patient_data->>'id')::uuid = p_patient_id) INTO v_has_children; EXCEPTION WHEN OTHERS THEN NULL; END; END IF;
  IF NOT v_has_children THEN BEGIN SELECT EXISTS(SELECT 1 FROM public.medical_records WHERE patient_id = p_patient_id) INTO v_has_children; EXCEPTION WHEN OTHERS THEN NULL; END; END IF;
  IF NOT v_has_children THEN BEGIN SELECT EXISTS(SELECT 1 FROM public.patient_encounters WHERE patient_id = p_patient_id) INTO v_has_children; EXCEPTION WHEN OTHERS THEN NULL; END; END IF;
  IF NOT v_has_children THEN BEGIN SELECT EXISTS(SELECT 1 FROM public.dhd_patients WHERE patient_id = p_patient_id) INTO v_has_children; EXCEPTION WHEN OTHERS THEN NULL; END; END IF;

  IF NOT v_has_children THEN
    RETURN NULL;
  END IF;

  -- Cria linha "arquivo" fora dos mapas de leito (department=OUTROS, sector=outside, bed_number único)
  INSERT INTO public.patients (
    id, bed_number, sector, department, name, is_vacant,
    hospital_unit_id, state_id, age, patient_registry_id,
    admission_status, admitted_at
  ) VALUES (
    gen_random_uuid(),
    'ARQ-' || COALESCE(v_old.sector,'?') || '-' || COALESCE(v_old.bed_number,'?') || '-' || extract(epoch from now())::bigint::text,
    'outside', 'OUTROS',
    COALESCE(v_old.name, ''),
    true,
    v_old.hospital_unit_id, v_old.state_id,
    COALESCE(v_old.age, ''),
    v_old.patient_registry_id,
    'alta_dada', v_old.admitted_at
  ) RETURNING id INTO v_archive_id;

  -- Repontuar filhos do paciente que saiu para o arquivo
  BEGIN UPDATE public.clinical_evolutions  SET patient_id = v_archive_id WHERE patient_id = p_patient_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.exam_requests        SET patient_id = v_archive_id WHERE patient_id = p_patient_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.culture_results      SET patient_id = v_archive_id WHERE patient_id = p_patient_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.admission_histories  SET patient_id = v_archive_id WHERE patient_id = p_patient_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.conduct_history      SET patient_id = v_archive_id WHERE patient_id = p_patient_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.patient_movements    SET patient_id = v_archive_id WHERE patient_id = p_patient_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.dhd_patients         SET patient_id = v_archive_id WHERE patient_id = p_patient_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.medical_records      SET patient_id = v_archive_id WHERE patient_id = p_patient_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.patient_encounters   SET patient_id = v_archive_id WHERE patient_id = p_patient_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.medical_record_edit_history     SET patient_id = v_archive_id WHERE patient_id = p_patient_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.patient_registry_edit_history   SET patient_id = v_archive_id WHERE patient_id = p_patient_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.patient_admission_date_history  SET patient_id = v_archive_id WHERE patient_id = p_patient_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    UPDATE public.prescriptions
       SET patient_data = jsonb_set(patient_data, '{id}', to_jsonb(v_archive_id::text), true)
     WHERE (patient_data->>'id')::uuid = p_patient_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN v_archive_id;
END;
$function$;

-- 2) Atualizar o trigger de alta para arquivar ANTES de limpar
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
    ELSE
      NEW.is_vacant := COALESCE(NEW.is_vacant, false);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Transição para alta (name esvaziado)
    IF COALESCE(OLD.name, '') <> '' AND COALESCE(NEW.name, '') = '' THEN
      -- Arquiva histórico do paciente que saiu (não bloqueia a alta se falhar)
      BEGIN
        PERFORM public.archive_bed_history(OLD.id);
      EXCEPTION WHEN OTHERS THEN
        -- Loga via RAISE NOTICE; nunca aborta a alta
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
      -- Limpa também o vínculo de registry para evitar carregar identidade entre pacientes
      NEW.patient_registry_id := NULL;
    ELSIF COALESCE(OLD.name, '') = '' AND COALESCE(NEW.name, '') <> '' THEN
      NEW.is_vacant := false;
    ELSIF COALESCE(NEW.name, '') = '' THEN
      NEW.is_vacant := true;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;
