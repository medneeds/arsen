ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_admission_status_check;

ALTER TABLE public.patients
  ADD CONSTRAINT patients_admission_status_check
  CHECK (admission_status IN ('pre_admitido','admitido','suspenso','alta_dada','obito'));
