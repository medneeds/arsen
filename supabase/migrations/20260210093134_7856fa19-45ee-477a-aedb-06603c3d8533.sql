
-- Create conduct history table for tracking clinical decision changes
CREATE TABLE public.conduct_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL, -- e.g. 'diagnoses', 'pendencies', 'relevant_exams', 'schedule', 'medical_history'
  old_value TEXT,
  new_value TEXT,
  changed_by UUID REFERENCES auth.users(id),
  changed_by_email TEXT,
  hospital_unit_id UUID NOT NULL REFERENCES public.hospital_units(id),
  state_id UUID NOT NULL REFERENCES public.states(id),
  department TEXT NOT NULL DEFAULT 'URGÊNCIA E EMERGÊNCIA ADULTO',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conduct_history ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view conduct history"
ON public.conduct_history FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert conduct history"
ON public.conduct_history FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete conduct history"
ON public.conduct_history FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for fast patient lookups
CREATE INDEX idx_conduct_history_patient_id ON public.conduct_history(patient_id);
CREATE INDEX idx_conduct_history_created_at ON public.conduct_history(created_at DESC);
