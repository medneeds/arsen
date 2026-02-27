-- Create DHD (Desospitalização Hospitalar-Dia) patients table
CREATE TABLE public.dhd_patients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  state_id UUID NOT NULL REFERENCES public.states(id),
  hospital_unit_id UUID NOT NULL REFERENCES public.hospital_units(id),
  department TEXT NOT NULL DEFAULT 'URGÊNCIA E EMERGÊNCIA ADULTO',
  
  -- Patient data
  patient_name TEXT NOT NULL,
  patient_age TEXT,
  diagnosis TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- Medication tracking
  medication_days JSONB DEFAULT '[]'::jsonb,
  
  -- DHD report
  dhd_report TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed'))
);

-- Enable RLS
ALTER TABLE public.dhd_patients ENABLE ROW LEVEL SECURITY;

-- RLS Policies for authenticated users
CREATE POLICY "Authenticated users can view DHD patients"
  ON public.dhd_patients FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create DHD patients"
  ON public.dhd_patients FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update DHD patients"
  ON public.dhd_patients FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete DHD patients"
  ON public.dhd_patients FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_dhd_patients_updated_at
  BEFORE UPDATE ON public.dhd_patients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_dhd_patients_status ON public.dhd_patients(status);
CREATE INDEX idx_dhd_patients_state_hospital_dept ON public.dhd_patients(state_id, hospital_unit_id, department);
CREATE INDEX idx_dhd_patients_end_date ON public.dhd_patients(end_date);