ALTER TABLE public.patients
  DROP CONSTRAINT IF EXISTS patients_admission_status_check;

ALTER TABLE public.patients
  ADD CONSTRAINT patients_admission_status_check
  CHECK (admission_status = ANY (ARRAY[
    'pre_admitido'::text,
    'admitido'::text,
    'suspenso'::text,
    'alta_dada'::text,
    'obito'::text,
    'transferencia_interna_pendente'::text,
    'transferencia_externa_pendente'::text,
    'saps_pendente'::text
  ]));