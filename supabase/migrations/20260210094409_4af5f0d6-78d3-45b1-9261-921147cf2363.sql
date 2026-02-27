
-- Create therapeutic_templates table
CREATE TABLE public.therapeutic_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  protocol_type TEXT NOT NULL, -- e.g., 'SEPSE', 'AVC', 'DOR TORÁCICA'
  description TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of template items (strings for pendencies)
  hospital_unit_id UUID REFERENCES public.hospital_units(id),
  state_id UUID REFERENCES public.states(id),
  is_global BOOLEAN NOT NULL DEFAULT false, -- true = available to all units
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.therapeutic_templates ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view templates
CREATE POLICY "Authenticated users can view templates"
  ON public.therapeutic_templates
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can create templates
CREATE POLICY "Admins can create templates"
  ON public.therapeutic_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can update templates
CREATE POLICY "Admins can update templates"
  ON public.therapeutic_templates
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete templates
CREATE POLICY "Admins can delete templates"
  ON public.therapeutic_templates
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_therapeutic_templates_updated_at
  BEFORE UPDATE ON public.therapeutic_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
