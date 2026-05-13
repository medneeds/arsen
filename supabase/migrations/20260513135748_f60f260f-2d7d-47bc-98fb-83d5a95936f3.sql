CREATE TABLE public.patient_admission_date_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL,
  old_value TIMESTAMP WITH TIME ZONE,
  new_value TIMESTAMP WITH TIME ZONE NOT NULL,
  changed_by UUID,
  changed_by_name TEXT,
  reason TEXT,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_padh_patient ON public.patient_admission_date_history(patient_id, changed_at DESC);

ALTER TABLE public.patient_admission_date_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view admission date history"
  ON public.patient_admission_date_history FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can insert admission date history"
  ON public.patient_admission_date_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = changed_by);