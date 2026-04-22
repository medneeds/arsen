-- 1) Remover duplicatas: quando há um leito sem nome E outro com nome no mesmo bed/sector/unit, remove o vazio
DELETE FROM public.patients p1
WHERE COALESCE(p1.name, '') = ''
  AND EXISTS (
    SELECT 1 FROM public.patients p2
    WHERE p2.id <> p1.id
      AND p2.hospital_unit_id = p1.hospital_unit_id
      AND p2.sector = p1.sector
      AND p2.bed_number = p1.bed_number
      AND COALESCE(p2.name, '') <> ''
  );

-- 2) Normalizar: qualquer leito sem nome = vago + dept correto por setor
UPDATE public.patients
SET is_vacant = true
WHERE COALESCE(name, '') = ''
  AND is_vacant IS DISTINCT FROM true;

-- Garantir department coerente para vagos
UPDATE public.patients SET department = 'UTI 1' WHERE is_vacant = true AND sector = 'red' AND department <> 'UTI 1';
UPDATE public.patients SET department = 'UTI 2' WHERE is_vacant = true AND sector = 'yellow' AND department <> 'UTI 2';
UPDATE public.patients SET department = 'UCI 1' WHERE is_vacant = true AND sector = 'blue' AND department <> 'UCI 1';
UPDATE public.patients SET department = 'UCI 2' WHERE is_vacant = true AND sector = 'outside' AND department <> 'UCI 2';
UPDATE public.patients SET department = 'SALA VERMELHA' WHERE is_vacant = true AND sector = 'sala_vermelha' AND department <> 'SALA VERMELHA';
UPDATE public.patients SET department = 'SALA LARANJA' WHERE is_vacant = true AND sector = 'sala_laranja' AND department <> 'SALA LARANJA';
UPDATE public.patients SET department = 'OBSERVAÇÃO CLÍNICA' WHERE is_vacant = true AND sector = 'observacao_clinica' AND department <> 'OBSERVAÇÃO CLÍNICA';
UPDATE public.patients SET department = 'UE VERTICAL' WHERE is_vacant = true AND sector = 'ue_vertical' AND department <> 'UE VERTICAL';
UPDATE public.patients SET department = 'UE HORIZONTAL' WHERE is_vacant = true AND sector = 'ue_horizontal' AND department <> 'UE HORIZONTAL';

-- 3) Inserir leitos físicos faltantes (a partir de bed_census)
INSERT INTO public.patients (
  hospital_unit_id, state_id, department, sector, bed_number,
  name, age, is_vacant, diagnoses, medical_history, relevant_exams,
  pendencies, schedule, admission_history
)
SELECT 
  bc.hospital_unit_id,
  bc.state_id,
  CASE bc.sector
    WHEN 'red' THEN 'UTI 1'
    WHEN 'yellow' THEN 'UTI 2'
    WHEN 'blue' THEN 'UCI 1'
    WHEN 'outside' THEN 'UCI 2'
    WHEN 'ucc' THEN 'UCC'
    WHEN 'neuro_01' THEN 'NEURO 01'
    WHEN 'neuro_02' THEN 'NEURO 02'
    WHEN 'clinica_cirurgica' THEN 'CLÍNICA CIRÚRGICA'
    WHEN 'enfermaria_transicao' THEN 'ENFERMARIA DE TRANSIÇÃO'
    WHEN 'enfermaria_vascular' THEN 'ENFERMARIA VASCULAR'
    WHEN 'sala_vermelha' THEN 'SALA VERMELHA'
    WHEN 'sala_laranja' THEN 'SALA LARANJA'
    WHEN 'observacao_clinica' THEN 'OBSERVAÇÃO CLÍNICA'
    WHEN 'ue_vertical' THEN 'UE VERTICAL'
    WHEN 'ue_horizontal' THEN 'UE HORIZONTAL'
    WHEN 'riv' THEN 'RIV'
    ELSE 'OUTROS'
  END,
  bc.sector,
  bc.bed_number,
  '', '', true, '', '', '', '', '', ''
FROM public.bed_census bc
WHERE NOT EXISTS (
  SELECT 1 FROM public.patients p
  WHERE p.hospital_unit_id = bc.hospital_unit_id
    AND p.sector = bc.sector
    AND p.bed_number = bc.bed_number
);

-- 4) Trigger: ao alta (name -> vazio) marca como vago e limpa campos clínicos
CREATE OR REPLACE FUNCTION public.auto_vacate_on_discharge()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Ao inserir, se name vazio, marca vago
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.name, '') = '' THEN
      NEW.is_vacant := true;
    ELSE
      NEW.is_vacant := COALESCE(NEW.is_vacant, false);
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: detectar transição para alta (name esvaziado)
  IF TG_OP = 'UPDATE' THEN
    -- Se nome ficou vazio (alta) → vago e limpa dados clínicos
    IF COALESCE(OLD.name, '') <> '' AND COALESCE(NEW.name, '') = '' THEN
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
    -- Se nome foi preenchido (admissão) → ocupado
    ELSIF COALESCE(OLD.name, '') = '' AND COALESCE(NEW.name, '') <> '' THEN
      NEW.is_vacant := false;
    -- Se name vazio e is_vacant não é true, força true
    ELSIF COALESCE(NEW.name, '') = '' THEN
      NEW.is_vacant := true;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_vacate_on_discharge ON public.patients;
CREATE TRIGGER trg_auto_vacate_on_discharge
BEFORE INSERT OR UPDATE ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.auto_vacate_on_discharge();