-- Backfill: alinhar admission_date e uti_admission_date ao admitted_at (D0 oficial)
-- Apenas para pacientes ativamente admitidos (não toca em alta/óbito).
UPDATE public.patients
SET 
  admission_date = admitted_at,
  uti_admission_date = admitted_at,
  updated_at = now()
WHERE admitted_at IS NOT NULL
  AND admission_status = 'admitido'
  AND name IS NOT NULL
  AND name <> '';

-- Para pré-admitidos sem admitted_at: garante que uti_admission_date espelhe admission_date
UPDATE public.patients
SET 
  uti_admission_date = admission_date,
  updated_at = now()
WHERE admitted_at IS NULL
  AND admission_date IS NOT NULL
  AND admission_status = 'pre_admitido'
  AND name IS NOT NULL
  AND name <> ''
  AND (uti_admission_date IS NULL OR uti_admission_date <> admission_date);