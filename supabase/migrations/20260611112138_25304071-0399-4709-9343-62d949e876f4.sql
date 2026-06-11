
-- 1) Tabela de receituários
CREATE TABLE IF NOT EXISTS public.receituarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('alta','ambulatorial')),
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  patient_name text NOT NULL,
  patient_bed text,
  patient_sector text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  free_text text,
  signed_by_name text,
  signed_by_crm text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  hospital_unit_id uuid REFERENCES public.hospital_units(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receituarios_patient_id ON public.receituarios(patient_id);
CREATE INDEX IF NOT EXISTS idx_receituarios_patient_name ON public.receituarios(patient_name);
CREATE INDEX IF NOT EXISTS idx_receituarios_hospital_unit_id ON public.receituarios(hospital_unit_id);
CREATE INDEX IF NOT EXISTS idx_receituarios_created_at ON public.receituarios(created_at DESC);

-- Trigger: preenche hospital_unit_id do paciente se vier nulo
CREATE OR REPLACE FUNCTION public.set_receituario_hospital_unit_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.hospital_unit_id IS NULL AND NEW.patient_id IS NOT NULL THEN
    SELECT hospital_unit_id INTO NEW.hospital_unit_id
    FROM public.patients WHERE id = NEW.patient_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_receituarios_set_hospital ON public.receituarios;
CREATE TRIGGER trg_receituarios_set_hospital
BEFORE INSERT ON public.receituarios
FOR EACH ROW EXECUTE FUNCTION public.set_receituario_hospital_unit_id();

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_receituarios_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_receituarios_updated_at ON public.receituarios;
CREATE TRIGGER trg_receituarios_updated_at
BEFORE UPDATE ON public.receituarios
FOR EACH ROW EXECUTE FUNCTION public.touch_receituarios_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.receituarios TO authenticated;
GRANT ALL ON public.receituarios TO service_role;

ALTER TABLE public.receituarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_receituarios"
ON public.receituarios FOR SELECT TO authenticated
USING (
  hospital_unit_id IS NULL
  OR public.can_access_hospital(hospital_unit_id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'dev'::app_role)
  OR is_gestor(auth.uid())
);

CREATE POLICY "tenant_insert_receituarios"
ON public.receituarios FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "tenant_update_own_receituarios"
ON public.receituarios FOR UPDATE TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "tenant_delete_own_receituarios"
ON public.receituarios FOR DELETE TO authenticated
USING (
  auth.uid() = created_by
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- 2) Colunas faltantes em medication_presentations
ALTER TABLE public.medication_presentations
  ADD COLUMN IF NOT EXISTS iv_bolus boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pharmacy_suggestion_enabled boolean NOT NULL DEFAULT false;
