-- 1. admission_status no patients
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS admission_status text NOT NULL DEFAULT 'admitido',
  ADD COLUMN IF NOT EXISTS admitted_at timestamp with time zone;

ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_admission_status_check;
ALTER TABLE public.patients
  ADD CONSTRAINT patients_admission_status_check
  CHECK (admission_status IN ('pre_admitido','admitido','suspenso'));

-- Pacientes existentes com nome viram 'admitido' com admitted_at = admission_date (já é o default)
UPDATE public.patients
   SET admitted_at = COALESCE(admitted_at, admission_date, created_at)
 WHERE admission_status = 'admitido' AND admitted_at IS NULL;

-- 2. evolution_type em clinical_evolutions
ALTER TABLE public.clinical_evolutions
  ADD COLUMN IF NOT EXISTS evolution_type text NOT NULL DEFAULT 'soap';

ALTER TABLE public.clinical_evolutions DROP CONSTRAINT IF EXISTS clinical_evolutions_type_check;
ALTER TABLE public.clinical_evolutions
  ADD CONSTRAINT clinical_evolutions_type_check
  CHECK (evolution_type IN ('soap','admission'));

CREATE INDEX IF NOT EXISTS idx_evolutions_admission
  ON public.clinical_evolutions (patient_id, evolution_type)
  WHERE evolution_type = 'admission';

-- 3. Trigger: validar admissão → patient = admitido; suspender → pre_admitido
CREATE OR REPLACE FUNCTION public.sync_admission_to_patient()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.evolution_type <> 'admission' THEN
    RETURN NEW;
  END IF;

  -- Admissão validada → paciente admitido
  IF NEW.status = 'validated' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NEW.patient_id IS NOT NULL THEN
      UPDATE public.patients
         SET admission_status = 'admitido',
             admitted_at = COALESCE(admitted_at, NEW.validated_at, now()),
             updated_at = now()
       WHERE id = NEW.patient_id;
    END IF;
  END IF;

  -- Admissão suspensa → paciente volta para pré-admitido
  IF NEW.status = 'suspended' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NEW.patient_id IS NOT NULL THEN
      UPDATE public.patients
         SET admission_status = 'pre_admitido',
             admitted_at = NULL,
             updated_at = now()
       WHERE id = NEW.patient_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_admission_to_patient ON public.clinical_evolutions;
CREATE TRIGGER trg_sync_admission_to_patient
AFTER INSERT OR UPDATE OF status ON public.clinical_evolutions
FOR EACH ROW EXECUTE FUNCTION public.sync_admission_to_patient();