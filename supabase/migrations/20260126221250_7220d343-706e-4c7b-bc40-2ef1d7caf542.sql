-- Add highlighted indices columns for all clinical subsections
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS highlighted_diagnoses integer[] DEFAULT ARRAY[]::integer[],
ADD COLUMN IF NOT EXISTS highlighted_medical_history integer[] DEFAULT ARRAY[]::integer[],
ADD COLUMN IF NOT EXISTS highlighted_conducts integer[] DEFAULT ARRAY[]::integer[];