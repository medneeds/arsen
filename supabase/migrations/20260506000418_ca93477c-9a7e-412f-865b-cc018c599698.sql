
CREATE TABLE IF NOT EXISTS public.discharge_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_type TEXT NOT NULL CHECK (document_type IN ('alta_hospitalar','alta_pedido','obito')),
  document_number TEXT,
  patient_id UUID,
  patient_registry_id UUID,
  patient_name TEXT NOT NULL,
  patient_bed TEXT,
  patient_sector TEXT,
  encounter_code TEXT,
  movement_id UUID,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  signed_by UUID,
  signed_by_name TEXT,
  signed_by_crm TEXT,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  hospital_unit_id UUID NOT NULL,
  state_id UUID NOT NULL,
  department TEXT NOT NULL DEFAULT 'URGÊNCIA E EMERGÊNCIA ADULTO',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.discharge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view discharge documents"
  ON public.discharge_documents FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can insert discharge documents"
  ON public.discharge_documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authors can update discharge documents"
  ON public.discharge_documents FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Admins can delete discharge documents"
  ON public.discharge_documents FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_discharge_documents_patient ON public.discharge_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_discharge_documents_registry ON public.discharge_documents(patient_registry_id);
CREATE INDEX IF NOT EXISTS idx_discharge_documents_movement ON public.discharge_documents(movement_id);
CREATE INDEX IF NOT EXISTS idx_discharge_documents_encounter ON public.discharge_documents(encounter_code);
CREATE INDEX IF NOT EXISTS idx_discharge_documents_type ON public.discharge_documents(document_type);

CREATE TRIGGER trg_discharge_documents_updated
  BEFORE UPDATE ON public.discharge_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
