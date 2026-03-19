
-- 1. Add medical_record column to patients table
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS medical_record text;

-- 2. Create patient_encounters table (código de atendimento)
CREATE TABLE public.patient_encounters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_code text NOT NULL UNIQUE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  patient_name text NOT NULL,
  hospital_unit_id uuid NOT NULL REFERENCES public.hospital_units(id),
  state_id uuid NOT NULL REFERENCES public.states(id),
  department text NOT NULL DEFAULT 'URGÊNCIA E EMERGÊNCIA ADULTO',
  admission_date timestamp with time zone DEFAULT now(),
  discharge_date timestamp with time zone,
  status text NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.patient_encounters ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view encounters" ON public.patient_encounters FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create encounters" ON public.patient_encounters FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update encounters" ON public.patient_encounters FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can delete encounters" ON public.patient_encounters FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Sequence for encounter codes
CREATE SEQUENCE IF NOT EXISTS encounter_code_seq START 1;

-- Function to generate encounter code
CREATE OR REPLACE FUNCTION public.generate_encounter_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.encounter_code IS NULL OR NEW.encounter_code = '' THEN
    NEW.encounter_code := 'ATD-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('encounter_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_encounter_code
  BEFORE INSERT ON public.patient_encounters
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_encounter_code();

-- 3. Create dispensations table
CREATE TABLE public.dispensations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispensation_code text NOT NULL UNIQUE,
  prescription_id uuid NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  patient_name text NOT NULL,
  encounter_code text,
  dispensed_items jsonb NOT NULL DEFAULT '[]',
  dispensed_by uuid,
  dispensed_by_name text,
  notes text,
  hospital_unit_id uuid NOT NULL REFERENCES public.hospital_units(id),
  state_id uuid NOT NULL REFERENCES public.states(id),
  department text NOT NULL DEFAULT 'URGÊNCIA E EMERGÊNCIA ADULTO',
  dispensed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.dispensations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view dispensations" ON public.dispensations FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create dispensations" ON public.dispensations FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update dispensations" ON public.dispensations FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can delete dispensations" ON public.dispensations FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Sequence for dispensation codes
CREATE SEQUENCE IF NOT EXISTS dispensation_code_seq START 1;

-- Function to generate dispensation code
CREATE OR REPLACE FUNCTION public.generate_dispensation_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.dispensation_code IS NULL OR NEW.dispensation_code = '' THEN
    NEW.dispensation_code := 'DISP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('dispensation_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_dispensation_code
  BEFORE INSERT ON public.dispensations
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_dispensation_code();

-- 4. Add internal_code to medication_catalog
ALTER TABLE public.medication_catalog ADD COLUMN IF NOT EXISTS internal_code text;

-- Generate internal codes for existing medications
CREATE OR REPLACE FUNCTION public.generate_medication_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_seq int;
BEGIN
  IF NEW.internal_code IS NULL OR NEW.internal_code = '' THEN
    SELECT count(*) + 1 INTO v_seq FROM public.medication_catalog WHERE internal_code IS NOT NULL;
    NEW.internal_code := 'MED-' || lpad(v_seq::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_medication_code
  BEFORE INSERT ON public.medication_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_medication_code();

-- Add encounter_id to prescriptions for linking
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS encounter_id uuid REFERENCES public.patient_encounters(id);

-- Updated_at trigger for encounters
CREATE TRIGGER update_encounters_updated_at
  BEFORE UPDATE ON public.patient_encounters
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
