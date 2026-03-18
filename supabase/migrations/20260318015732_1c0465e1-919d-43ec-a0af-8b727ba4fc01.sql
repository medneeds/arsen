
CREATE TABLE public.exam_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'laboratorio',
  patient_name TEXT NOT NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  patient_bed TEXT,
  patient_sector TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  clinical_indication TEXT,
  priority TEXT NOT NULL DEFAULT 'rotina',
  status TEXT NOT NULL DEFAULT 'pending',
  results TEXT,
  result_data JSONB,
  requested_by UUID,
  requested_by_name TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by TEXT,
  notes TEXT,
  hospital_unit_id UUID NOT NULL REFERENCES public.hospital_units(id),
  state_id UUID NOT NULL REFERENCES public.states(id),
  department TEXT NOT NULL DEFAULT 'URGÊNCIA E EMERGÊNCIA ADULTO',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.exam_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view exam requests"
  ON public.exam_requests FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create exam requests"
  ON public.exam_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update exam requests"
  ON public.exam_requests FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete exam requests"
  ON public.exam_requests FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_exam_requests_updated_at
  BEFORE UPDATE ON public.exam_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
