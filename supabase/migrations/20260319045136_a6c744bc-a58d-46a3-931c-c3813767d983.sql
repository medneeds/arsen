ALTER TABLE public.saps3_assessments 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
ADD COLUMN IF NOT EXISTS pending_since timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL;