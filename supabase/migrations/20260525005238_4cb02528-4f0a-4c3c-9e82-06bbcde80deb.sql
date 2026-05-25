CREATE OR REPLACE FUNCTION public.auto_vacate_on_discharge()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_old_empty boolean := (OLD.name IS NULL OR trim(OLD.name) = '');
  v_new_empty boolean := (NEW.name IS NULL OR trim(NEW.name) = '');
BEGIN
  -- Dispara apenas na transição ocupado -> vago.
  -- patients.name é NOT NULL: o slot vazio deve ser string vazia, nunca NULL.
  -- Limpa apenas colunas que realmente existem em public.patients.
  IF NOT v_old_empty AND v_new_empty THEN
    NEW.name := '';
    NEW.patient_registry_id := NULL;
    NEW.medical_record := NULL;
    NEW.age := NULL;
    NEW.diagnoses := NULL;
    NEW.medical_history := NULL;
    NEW.relevant_exams := NULL;
    NEW.pendencies := NULL;
    NEW.schedule := NULL;
    NEW.admission_history := NULL;
    NEW.admission_date := NULL;
    NEW.admission_status := NULL;
    NEW.admitted_at := NULL;
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
    NEW.uti_weight_kg := NULL;
    NEW.uti_daily_conducts := NULL;
    NEW.internment_status := NULL;
    NEW.internment_notes := NULL;
    NEW.allocation_status := NULL;
    NEW.psm_status := NULL;
    NEW.clinical_status := NULL;
    NEW.isolation_precautions := NULL;
    NEW.hospital_discharge_prediction := NULL;
    NEW.is_palliative := false;
    NEW.is_door_patient := false;
    NEW.saps_pending := false;
    NEW.saps_pending_since := NULL;
    NEW.saps_completed_at := NULL;
    NEW.saps_acknowledged_by := NULL;
    NEW.saps_acknowledged_at := NULL;
    NEW.highlighted_pendencies := ARRAY[]::integer[];
    NEW.highlighted_diagnoses := ARRAY[]::integer[];
    NEW.highlighted_medical_history := ARRAY[]::integer[];
    NEW.highlighted_conducts := ARRAY[]::integer[];
  END IF;
  RETURN NEW;
END;
$function$;