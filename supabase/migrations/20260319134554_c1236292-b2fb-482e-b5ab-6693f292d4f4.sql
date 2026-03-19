
-- Vital signs table for periodic recording
CREATE TABLE public.vital_signs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  hospital_unit_id UUID REFERENCES public.hospital_units(id) NOT NULL,
  state_id UUID REFERENCES public.states(id) NOT NULL,
  department TEXT NOT NULL DEFAULT 'URGÊNCIA E EMERGÊNCIA ADULTO',
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  recorded_by UUID,
  recorded_by_name TEXT,
  -- Vital parameters
  systolic_bp INTEGER,
  diastolic_bp INTEGER,
  heart_rate INTEGER,
  respiratory_rate INTEGER,
  spo2 NUMERIC(5,2),
  temperature NUMERIC(4,1),
  pvc NUMERIC(5,1),
  -- Consciousness
  consciousness_level TEXT, -- alert, verbal, pain, unresponsive (AVPU)
  supplemental_oxygen BOOLEAN DEFAULT false,
  -- NEWS2 score
  news2_score INTEGER,
  news2_risk TEXT, -- low, low_key, medium, high
  -- Blood gas (gasometria)
  ph NUMERIC(4,2),
  pco2 NUMERIC(5,1),
  po2 NUMERIC(5,1),
  hco3 NUMERIC(5,1),
  lactate NUMERIC(5,2),
  base_excess NUMERIC(5,1),
  fio2 NUMERIC(5,2),
  sao2 NUMERIC(5,2),
  -- Lab values for serial tracking
  hemoglobin NUMERIC(5,1),
  hematocrit NUMERIC(5,1),
  platelets INTEGER,
  leukocytes NUMERIC(6,1),
  creatinine NUMERIC(5,2),
  urea NUMERIC(6,1),
  sodium NUMERIC(5,1),
  potassium NUMERIC(4,2),
  pcr NUMERIC(6,2),
  procalcitonin NUMERIC(6,3),
  inr NUMERIC(4,2),
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vital_signs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view vital signs"
  ON public.vital_signs FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create vital signs"
  ON public.vital_signs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update vital signs"
  ON public.vital_signs FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete vital signs"
  ON public.vital_signs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Index for fast patient queries
CREATE INDEX idx_vital_signs_patient_recorded ON public.vital_signs (patient_id, recorded_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.vital_signs;
