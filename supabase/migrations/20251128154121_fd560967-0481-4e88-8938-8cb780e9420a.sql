-- Create states table
CREATE TABLE public.states (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  abbreviation TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on states
ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;

-- States policies (readable by all authenticated users)
CREATE POLICY "Authenticated users can view states"
ON public.states
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage states"
ON public.states
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create hospital_units table
CREATE TABLE public.hospital_units (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  state_id UUID NOT NULL REFERENCES public.states(id) ON DELETE CASCADE,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on hospital_units
ALTER TABLE public.hospital_units ENABLE ROW LEVEL SECURITY;

-- Hospital units policies (readable by all authenticated users)
CREATE POLICY "Authenticated users can view hospital units"
ON public.hospital_units
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage hospital units"
ON public.hospital_units
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create user_hospital_assignments table
CREATE TABLE public.user_hospital_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  hospital_unit_id UUID NOT NULL REFERENCES public.hospital_units(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, hospital_unit_id)
);

-- Enable RLS on user_hospital_assignments
ALTER TABLE public.user_hospital_assignments ENABLE ROW LEVEL SECURITY;

-- User hospital assignments policies
CREATE POLICY "Users can view own hospital assignments"
ON public.user_hospital_assignments
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all hospital assignments"
ON public.user_hospital_assignments
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage all hospital assignments"
ON public.user_hospital_assignments
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert initial data: Maranhão state
INSERT INTO public.states (name, abbreviation)
VALUES ('Maranhão', 'MA');

-- Insert initial data: Hospital Guarás
INSERT INTO public.hospital_units (name, state_id, address)
SELECT 'Hospital Guarás', id, NULL
FROM public.states
WHERE abbreviation = 'MA';

-- Add state_id and hospital_unit_id columns to existing tables
ALTER TABLE public.patients 
ADD COLUMN state_id UUID,
ADD COLUMN hospital_unit_id UUID;

ALTER TABLE public.patient_movements 
ADD COLUMN state_id UUID,
ADD COLUMN hospital_unit_id UUID;

ALTER TABLE public.patient_versions 
ADD COLUMN state_id UUID,
ADD COLUMN hospital_unit_id UUID;

ALTER TABLE public.shift_handovers 
ADD COLUMN state_id UUID,
ADD COLUMN hospital_unit_id UUID;

ALTER TABLE public.notes_reminders 
ADD COLUMN state_id UUID,
ADD COLUMN hospital_unit_id UUID;

ALTER TABLE public.internment_requests 
ADD COLUMN state_id UUID,
ADD COLUMN hospital_unit_id UUID;

ALTER TABLE public.sepsis_protocols 
ADD COLUMN state_id UUID,
ADD COLUMN hospital_unit_id UUID;

-- Drop problematic triggers on tables without updated_at column
DROP TRIGGER IF EXISTS update_patient_movements_updated_at ON public.patient_movements;
DROP TRIGGER IF EXISTS update_patient_versions_updated_at ON public.patient_versions;
DROP TRIGGER IF EXISTS update_shift_handovers_updated_at ON public.shift_handovers;

-- Backfill all existing records with Hospital Guarás IDs
DO $$
DECLARE
  v_state_id UUID;
  v_hospital_id UUID;
BEGIN
  -- Get the IDs
  SELECT id INTO v_state_id FROM public.states WHERE abbreviation = 'MA';
  SELECT id INTO v_hospital_id FROM public.hospital_units WHERE name = 'Hospital Guarás';
  
  -- Update all existing records
  UPDATE public.patients SET state_id = v_state_id, hospital_unit_id = v_hospital_id WHERE state_id IS NULL;
  UPDATE public.patient_movements SET state_id = v_state_id, hospital_unit_id = v_hospital_id WHERE state_id IS NULL;
  UPDATE public.patient_versions SET state_id = v_state_id, hospital_unit_id = v_hospital_id WHERE state_id IS NULL;
  UPDATE public.shift_handovers SET state_id = v_state_id, hospital_unit_id = v_hospital_id WHERE state_id IS NULL;
  UPDATE public.notes_reminders SET state_id = v_state_id, hospital_unit_id = v_hospital_id WHERE state_id IS NULL;
  UPDATE public.internment_requests SET state_id = v_state_id, hospital_unit_id = v_hospital_id WHERE state_id IS NULL;
  UPDATE public.sepsis_protocols SET state_id = v_state_id, hospital_unit_id = v_hospital_id WHERE state_id IS NULL;
END $$;

-- Now make the columns NOT NULL and add foreign key constraints
ALTER TABLE public.patients 
ALTER COLUMN state_id SET NOT NULL,
ALTER COLUMN hospital_unit_id SET NOT NULL,
ADD CONSTRAINT patients_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.states(id) ON DELETE CASCADE,
ADD CONSTRAINT patients_hospital_unit_id_fkey FOREIGN KEY (hospital_unit_id) REFERENCES public.hospital_units(id) ON DELETE CASCADE;

ALTER TABLE public.patient_movements 
ALTER COLUMN state_id SET NOT NULL,
ALTER COLUMN hospital_unit_id SET NOT NULL,
ADD CONSTRAINT patient_movements_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.states(id) ON DELETE CASCADE,
ADD CONSTRAINT patient_movements_hospital_unit_id_fkey FOREIGN KEY (hospital_unit_id) REFERENCES public.hospital_units(id) ON DELETE CASCADE;

ALTER TABLE public.patient_versions 
ALTER COLUMN state_id SET NOT NULL,
ALTER COLUMN hospital_unit_id SET NOT NULL,
ADD CONSTRAINT patient_versions_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.states(id) ON DELETE CASCADE,
ADD CONSTRAINT patient_versions_hospital_unit_id_fkey FOREIGN KEY (hospital_unit_id) REFERENCES public.hospital_units(id) ON DELETE CASCADE;

ALTER TABLE public.shift_handovers 
ALTER COLUMN state_id SET NOT NULL,
ALTER COLUMN hospital_unit_id SET NOT NULL,
ADD CONSTRAINT shift_handovers_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.states(id) ON DELETE CASCADE,
ADD CONSTRAINT shift_handovers_hospital_unit_id_fkey FOREIGN KEY (hospital_unit_id) REFERENCES public.hospital_units(id) ON DELETE CASCADE;

ALTER TABLE public.notes_reminders 
ALTER COLUMN state_id SET NOT NULL,
ALTER COLUMN hospital_unit_id SET NOT NULL,
ADD CONSTRAINT notes_reminders_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.states(id) ON DELETE CASCADE,
ADD CONSTRAINT notes_reminders_hospital_unit_id_fkey FOREIGN KEY (hospital_unit_id) REFERENCES public.hospital_units(id) ON DELETE CASCADE;

ALTER TABLE public.internment_requests 
ALTER COLUMN state_id SET NOT NULL,
ALTER COLUMN hospital_unit_id SET NOT NULL,
ADD CONSTRAINT internment_requests_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.states(id) ON DELETE CASCADE,
ADD CONSTRAINT internment_requests_hospital_unit_id_fkey FOREIGN KEY (hospital_unit_id) REFERENCES public.hospital_units(id) ON DELETE CASCADE;

ALTER TABLE public.sepsis_protocols 
ALTER COLUMN state_id SET NOT NULL,
ALTER COLUMN hospital_unit_id SET NOT NULL,
ADD CONSTRAINT sepsis_protocols_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.states(id) ON DELETE CASCADE,
ADD CONSTRAINT sepsis_protocols_hospital_unit_id_fkey FOREIGN KEY (hospital_unit_id) REFERENCES public.hospital_units(id) ON DELETE CASCADE;