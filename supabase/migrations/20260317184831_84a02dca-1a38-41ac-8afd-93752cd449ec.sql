
-- Fase 7: Structured Admission History
-- Stores formal admission data per patient encounter

CREATE TABLE public.admission_histories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  hospital_unit_id UUID NOT NULL REFERENCES public.hospital_units(id),
  state_id UUID NOT NULL REFERENCES public.states(id),
  department TEXT NOT NULL DEFAULT 'URGÊNCIA E EMERGÊNCIA ADULTO',
  chief_complaint TEXT,
  clinical_history TEXT,
  diagnostic_hypothesis TEXT,
  initial_conduct TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(patient_id)
);

-- Enable RLS
ALTER TABLE public.admission_histories ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view admission histories"
  ON public.admission_histories FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create admission histories"
  ON public.admission_histories FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update admission histories"
  ON public.admission_histories FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete admission histories"
  ON public.admission_histories FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_admission_histories_updated_at
  BEFORE UPDATE ON public.admission_histories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
