
-- Create prescription_validations table for pharmaceutical review workflow
CREATE TABLE public.prescription_validations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prescription_id UUID NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  validated_by UUID,
  validator_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  validation_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  dose_check_passed BOOLEAN DEFAULT NULL,
  allergy_check_passed BOOLEAN DEFAULT NULL,
  interaction_check_passed BOOLEAN DEFAULT NULL,
  dilution_check_passed BOOLEAN DEFAULT NULL,
  hospital_unit_id UUID NOT NULL REFERENCES public.hospital_units(id),
  state_id UUID NOT NULL REFERENCES public.states(id),
  department TEXT NOT NULL DEFAULT 'URGÊNCIA E EMERGÊNCIA ADULTO',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prescription_validations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view validations"
  ON public.prescription_validations FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create validations"
  ON public.prescription_validations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Validators and admins can update validations"
  ON public.prescription_validations FOR UPDATE
  TO authenticated
  USING (auth.uid() = validated_by OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete validations"
  ON public.prescription_validations FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add updated_at trigger
CREATE TRIGGER update_prescription_validations_updated_at
  BEFORE UPDATE ON public.prescription_validations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
