
-- Tabela permanente de prontuários de pacientes
CREATE TABLE public.patient_registry (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  medical_record text UNIQUE,
  full_name text NOT NULL,
  social_name text,
  cpf text UNIQUE,
  cns text,
  birth_date date,
  sex text,
  mother_name text,
  phone text,
  address text,
  neighborhood text,
  city text,
  state text,
  blood_type text,
  allergies text,
  comorbidities text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  hospital_unit_id uuid REFERENCES public.hospital_units(id),
  state_id uuid REFERENCES public.states(id)
);

-- Sequence for medical record auto-generation
CREATE SEQUENCE IF NOT EXISTS medical_record_seq START 1;

-- Trigger to auto-generate medical_record if not provided
CREATE OR REPLACE FUNCTION public.generate_medical_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.medical_record IS NULL OR NEW.medical_record = '' THEN
    NEW.medical_record := 'PRONT-' || lpad(nextval('medical_record_seq')::text, 7, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER generate_medical_record_trigger
  BEFORE INSERT ON public.patient_registry
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_medical_record();

-- RLS
ALTER TABLE public.patient_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view patient registry"
  ON public.patient_registry FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create patient registry"
  ON public.patient_registry FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update patient registry"
  ON public.patient_registry FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete patient registry"
  ON public.patient_registry FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Add registry_id and destination_sector to patient_encounters
ALTER TABLE public.patient_encounters
  ADD COLUMN IF NOT EXISTS registry_id uuid REFERENCES public.patient_registry(id),
  ADD COLUMN IF NOT EXISTS destination_sector text,
  ADD COLUMN IF NOT EXISTS triage_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS called_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS called_by uuid;

-- Enable realtime for patient_encounters (for triage queue)
ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_encounters;
