-- Add medical_responsibility column to patients table
ALTER TABLE public.patients 
ADD COLUMN medical_responsibility JSONB NULL;