-- Add medication_schedule field to dhd_patients table
ALTER TABLE public.dhd_patients 
ADD COLUMN medication_schedule TEXT;