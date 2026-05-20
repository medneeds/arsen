-- Auto-vincula patient_encounters órfãos (patient_id NULL) ao paciente
-- ativo no mapa de leitos quando o match por nome+unidade é único.
-- Defensivo: se ambíguo ou inexistente, deixa NULL (não quebra fluxo).

CREATE OR REPLACE FUNCTION public.autolink_encounter_patient_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match_count integer;
  v_patient_id uuid;
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

  -- Conta candidatos: paciente em leito ativo (is_vacant=false) na mesma unidade
  SELECT COUNT(*), MAX(p.id)
    INTO v_match_count, v_patient_id
  FROM public.patients p
  WHERE upper(p.name) = upper(NEW.patient_name)
    AND p.hospital_unit_id = NEW.hospital_unit_id
    AND p.is_vacant = false;

  -- Match único → vincula
  IF v_match_count = 1 AND v_patient_id IS NOT NULL THEN
    NEW.patient_id := v_patient_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_autolink_encounter_patient_id ON public.patient_encounters;

CREATE TRIGGER trg_autolink_encounter_patient_id
BEFORE INSERT OR UPDATE OF patient_name, hospital_unit_id ON public.patient_encounters
FOR EACH ROW
EXECUTE FUNCTION public.autolink_encounter_patient_id();