-- Expand admission_status to support transfer pending states
ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_admission_status_check;
ALTER TABLE public.patients ADD CONSTRAINT patients_admission_status_check
  CHECK (admission_status = ANY (ARRAY[
    'pre_admitido'::text,
    'admitido'::text,
    'suspenso'::text,
    'alta_dada'::text,
    'obito'::text,
    'transferencia_interna_pendente'::text,
    'transferencia_externa_pendente'::text
  ]));

-- Trigger: when bed/sector actually changes, clear pending internal-transfer flag
CREATE OR REPLACE FUNCTION public.clear_internal_transfer_flag_on_relocate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.admission_status = 'transferencia_interna_pendente'
     AND (NEW.bed_number IS DISTINCT FROM OLD.bed_number
          OR NEW.sector IS DISTINCT FROM OLD.sector)
     AND NEW.admission_status = OLD.admission_status THEN
    NEW.admission_status := 'admitido';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_internal_transfer_flag ON public.patients;
CREATE TRIGGER trg_clear_internal_transfer_flag
BEFORE UPDATE ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.clear_internal_transfer_flag_on_relocate();