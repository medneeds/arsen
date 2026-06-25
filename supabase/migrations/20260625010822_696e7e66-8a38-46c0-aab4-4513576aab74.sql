CREATE OR REPLACE FUNCTION public.stamp_admission_evolution_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_registry_id uuid;
  v_encounter_id uuid;
BEGIN
  IF NEW.evolution_type IS DISTINCT FROM 'admission' OR NEW.patient_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.patient_registry_id
    INTO v_registry_id
  FROM public.patients p
  WHERE p.id = NEW.patient_id;

  IF v_registry_id IS NOT NULL AND NEW.archived_at IS NULL THEN
    NEW.patient_registry_id := v_registry_id;
  ELSIF NEW.patient_registry_id IS NULL AND v_registry_id IS NOT NULL THEN
    NEW.patient_registry_id := v_registry_id;
  END IF;

  IF NEW.encounter_id IS NULL AND COALESCE(NEW.patient_registry_id, v_registry_id) IS NOT NULL THEN
    SELECT pe.id
      INTO v_encounter_id
    FROM public.patient_encounters pe
    WHERE pe.registry_id = COALESCE(NEW.patient_registry_id, v_registry_id)
      AND pe.patient_id = NEW.patient_id
      AND pe.status IS DISTINCT FROM 'closed'
    ORDER BY pe.created_at DESC
    LIMIT 1;

    NEW.encounter_id := v_encounter_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.stamp_admission_evolution_identity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stamp_admission_evolution_identity() TO service_role;