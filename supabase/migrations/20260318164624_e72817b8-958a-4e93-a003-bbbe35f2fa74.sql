
CREATE TABLE public.saps3_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  patient_name text NOT NULL,
  hospital_unit_id uuid NOT NULL REFERENCES public.hospital_units(id),
  state_id uuid NOT NULL REFERENCES public.states(id),
  department text NOT NULL DEFAULT 'UTI',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Box I: Patient characteristics before ICU admission
  age integer,
  comorbidities jsonb DEFAULT '[]'::jsonb,
  hospital_los_before_icu integer, -- days in hospital before ICU
  icu_admission_source text, -- 'emergency', 'same_hospital_floor', 'other_icu', 'other_hospital', 'operating_room'
  planned_admission boolean DEFAULT false,

  -- Box II: Circumstances of ICU admission
  admission_reason text, -- 'cardiovascular', 'neurological', 'hepatic', 'digestive', 'respiratory', 'other'
  admission_reason_detail text,
  surgical_status text, -- 'no_surgery', 'scheduled_surgery', 'emergency_surgery'
  surgery_type text, -- 'transplant', 'trauma', 'cardiac', 'neurosurgery', 'other'
  infection_at_admission text, -- 'none', 'nosocomial', 'respiratory', 'other'
  
  -- Box III: Physiological variables at ICU admission
  gcs_score integer, -- 3-15
  heart_rate_highest integer, -- bpm
  systolic_bp_lowest integer, -- mmHg
  bilirubin_highest numeric, -- mg/dL
  temperature_lowest numeric, -- °C
  creatinine_highest numeric, -- mg/dL
  leukocytes numeric, -- x10³/mm³
  ph_lowest numeric,
  platelets_lowest integer, -- x10³/mm³
  oxygenation_pao2_fio2 numeric, -- PaO2/FiO2
  is_mechanically_ventilated boolean DEFAULT false,

  -- Calculated scores
  box1_score integer,
  box2_score integer,
  box3_score integer,
  total_score integer,
  predicted_mortality numeric -- percentage
);

ALTER TABLE public.saps3_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view SAPS3"
  ON public.saps3_assessments FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create SAPS3"
  ON public.saps3_assessments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update SAPS3"
  ON public.saps3_assessments FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete SAPS3"
  ON public.saps3_assessments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
