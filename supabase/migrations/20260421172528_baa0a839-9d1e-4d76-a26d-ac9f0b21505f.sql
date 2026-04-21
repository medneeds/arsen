-- Tabela única para guias regulatórias (ATM, Psicotrópicos, MAV)
CREATE TABLE public.regulatory_guides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guide_type TEXT NOT NULL CHECK (guide_type IN ('antimicrobial', 'psychotropic', 'high_alert')),
  prescription_id UUID REFERENCES public.prescriptions(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  patient_registry_id UUID REFERENCES public.patient_registry(id) ON DELETE SET NULL,
  patient_name TEXT NOT NULL,
  patient_bed TEXT,
  patient_record TEXT,
  patient_age TEXT,
  patient_sex TEXT,
  patient_weight TEXT,
  patient_allergies TEXT,
  hospital_unit_id UUID NOT NULL REFERENCES public.hospital_units(id),
  state_id UUID NOT NULL REFERENCES public.states(id),
  department TEXT NOT NULL DEFAULT 'UTI',
  -- Common fields
  entries JSONB NOT NULL DEFAULT '[]'::jsonb, -- list of medications + metadata
  doctor_name TEXT,
  doctor_crm TEXT,
  doctor_specialty TEXT,
  -- Antimicrobial-specific
  infection_origin TEXT, -- 'comunitaria' | 'hospitalar'
  infection_focus TEXT,
  request_type TEXT, -- '1a_solicitacao' | 'renovacao' | 'troca'
  culture_collected BOOLEAN DEFAULT false,
  culture_data JSONB DEFAULT '[]'::jsonb,
  ccih_status TEXT DEFAULT 'pendente', -- pendente | liberado | negado
  ccih_notes TEXT,
  ccih_reviewed_at TIMESTAMPTZ,
  ccih_reviewed_by UUID,
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  created_by_name TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  printed_at TIMESTAMPTZ,
  print_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_regulatory_guides_patient ON public.regulatory_guides(patient_id);
CREATE INDEX idx_regulatory_guides_registry ON public.regulatory_guides(patient_registry_id);
CREATE INDEX idx_regulatory_guides_prescription ON public.regulatory_guides(prescription_id);
CREATE INDEX idx_regulatory_guides_type_unit ON public.regulatory_guides(guide_type, hospital_unit_id, created_at DESC);
CREATE INDEX idx_regulatory_guides_ccih ON public.regulatory_guides(guide_type, ccih_status) WHERE guide_type = 'antimicrobial';

ALTER TABLE public.regulatory_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view guides in their hospital"
ON public.regulatory_guides FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create guides"
ON public.regulatory_guides FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update guides they created or CCIH"
ON public.regulatory_guides FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete guides"
ON public.regulatory_guides FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_regulatory_guides_updated_at
BEFORE UPDATE ON public.regulatory_guides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.regulatory_guides;