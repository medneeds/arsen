
-- Create clinical_evolutions table
CREATE TABLE public.clinical_evolutions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  patient_name TEXT NOT NULL,
  patient_bed TEXT,
  patient_sector TEXT,
  soap_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  vital_signs JSONB NOT NULL DEFAULT '{}'::jsonb,
  physical_exam JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  validated_at TIMESTAMP WITH TIME ZONE,
  validated_by UUID,
  suspended_at TIMESTAMP WITH TIME ZONE,
  suspended_by UUID,
  suspension_reason TEXT,
  hospital_unit_id UUID NOT NULL REFERENCES public.hospital_units(id),
  state_id UUID NOT NULL REFERENCES public.states(id),
  department TEXT NOT NULL DEFAULT 'URGÊNCIA E EMERGÊNCIA ADULTO',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clinical_evolutions ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view
CREATE POLICY "Authenticated users can view evolutions"
ON public.clinical_evolutions FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Only the author can create
CREATE POLICY "Authors can create evolutions"
ON public.clinical_evolutions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Only the author can update (and only if not validated)
CREATE POLICY "Authors can update own draft evolutions"
ON public.clinical_evolutions FOR UPDATE
TO authenticated
USING (auth.uid() = created_by);

-- Nobody can delete validated evolutions; only author/admin can delete drafts
CREATE POLICY "Only drafts can be deleted by author or admin"
ON public.clinical_evolutions FOR DELETE
TO authenticated
USING (
  status = 'draft' 
  AND (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role))
);

-- Trigger for updated_at
CREATE TRIGGER update_clinical_evolutions_updated_at
BEFORE UPDATE ON public.clinical_evolutions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for patient timeline queries
CREATE INDEX idx_clinical_evolutions_patient ON public.clinical_evolutions(patient_id, created_at DESC);
CREATE INDEX idx_clinical_evolutions_hospital ON public.clinical_evolutions(hospital_unit_id, state_id);
