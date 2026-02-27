-- Add is_vacant column to patients table for UTI bed vacancy tracking
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS is_vacant boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.patients.is_vacant IS 'Indicates if the bed is vacant (true) or occupied by a patient (false)';