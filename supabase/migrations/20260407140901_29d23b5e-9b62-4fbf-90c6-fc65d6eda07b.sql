
-- Add outcome and workflow tracking fields to patient_encounters
ALTER TABLE public.patient_encounters 
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS outcome_date timestamp with time zone,
  ADD COLUMN IF NOT EXISTS entry_type text DEFAULT 'espontaneo',
  ADD COLUMN IF NOT EXISTS first_medical_attendance_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_medical_attendance_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS attending_doctor_name text,
  ADD COLUMN IF NOT EXISTS specialty text;

-- Add comment for documentation
COMMENT ON COLUMN patient_encounters.outcome IS 'alta, obito, evasao, internacao, transferencia, desistencia';
COMMENT ON COLUMN patient_encounters.entry_type IS 'espontaneo, samu, bombeiro, policia, transferencia, outros';
