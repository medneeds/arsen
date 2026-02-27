-- Make end_date nullable in dhd_patients table
ALTER TABLE public.dhd_patients 
ALTER COLUMN end_date DROP NOT NULL;