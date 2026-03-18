
-- Add triage clinical data columns to pre_admissions
ALTER TABLE public.pre_admissions
  ADD COLUMN IF NOT EXISTS chief_complaint text,
  ADD COLUMN IF NOT EXISTS vital_signs jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS glasgow_score integer,
  ADD COLUMN IF NOT EXISTS glasgow_detail jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS airway_patent boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS airway_obstruction boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS airway_intubated boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS airway_notes text,
  ADD COLUMN IF NOT EXISTS peripheral_perfusion text,
  ADD COLUMN IF NOT EXISTS pulse_quality text,
  ADD COLUMN IF NOT EXISTS allergies text,
  ADD COLUMN IF NOT EXISTS flu_symptoms boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS flu_symptoms_detail text,
  ADD COLUMN IF NOT EXISTS pain_scale integer,
  ADD COLUMN IF NOT EXISTS oxygen_therapy boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS oxygen_therapy_detail text,
  ADD COLUMN IF NOT EXISTS menstrual_status text,
  ADD COLUMN IF NOT EXISTS triage_notes text;
