
-- Pre-admission patients table
CREATE TABLE public.pre_admissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_name TEXT NOT NULL,
  social_name TEXT,
  mother_name TEXT,
  birth_date DATE,
  sex TEXT CHECK (sex IN ('M', 'F', 'Outro')),
  cpf TEXT,
  cns TEXT,
  medical_record TEXT,
  phone TEXT,
  address TEXT,
  neighborhood TEXT,
  city TEXT,
  destination_sector TEXT,
  destination_bed TEXT,
  status TEXT NOT NULL DEFAULT 'pre_admissao' CHECK (status IN ('pre_admissao', 'classificado', 'admitido', 'cancelado')),
  risk_classification TEXT CHECK (risk_classification IN ('vermelho', 'laranja', 'amarelo', 'verde', 'azul')),
  risk_classified_at TIMESTAMP WITH TIME ZONE,
  risk_classified_by UUID,
  ai_extracted_data JSONB,
  notes TEXT,
  hospital_unit_id UUID NOT NULL REFERENCES public.hospital_units(id),
  state_id UUID NOT NULL REFERENCES public.states(id),
  department TEXT NOT NULL DEFAULT 'URGÊNCIA E EMERGÊNCIA ADULTO',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pre_admissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view pre-admissions"
ON public.pre_admissions FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create pre-admissions"
ON public.pre_admissions FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update pre-admissions"
ON public.pre_admissions FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete pre-admissions"
ON public.pre_admissions FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_pre_admissions_updated_at
BEFORE UPDATE ON public.pre_admissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
