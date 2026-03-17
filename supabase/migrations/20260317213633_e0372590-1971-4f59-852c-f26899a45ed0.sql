
-- 1. Catálogo de Medicamentos (perfis)
CREATE TABLE public.medication_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generic_name text NOT NULL,
  therapeutic_class text NOT NULL,
  pharmacological_group text,
  atc_code text,
  controlled boolean NOT NULL DEFAULT false,
  requires_dilution boolean NOT NULL DEFAULT false,
  high_alert boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Apresentações (formas farmacêuticas)
CREATE TABLE public.medication_presentations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id uuid NOT NULL REFERENCES public.medication_catalog(id) ON DELETE CASCADE,
  form text NOT NULL, -- comprimido, ampola, frasco, etc.
  concentration text NOT NULL, -- ex: "500mg", "1g/10mL"
  unit text NOT NULL DEFAULT 'mg', -- mg, g, mL, UI
  route text NOT NULL DEFAULT 'VO', -- VO, IV, IM, SC, etc.
  standard_dilution text, -- diluição padrão quando aplicável
  max_daily_dose text,
  infusion_time text, -- tempo de infusão quando IV
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Aliases (nomes comerciais e sinônimos)
CREATE TABLE public.medication_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id uuid NOT NULL REFERENCES public.medication_catalog(id) ON DELETE CASCADE,
  alias_name text NOT NULL,
  alias_type text NOT NULL DEFAULT 'commercial', -- commercial, abbreviation, synonym
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.medication_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_presentations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_aliases ENABLE ROW LEVEL SECURITY;

-- Políticas de leitura para todos autenticados
CREATE POLICY "Authenticated users can view medication catalog" ON public.medication_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage medication catalog" ON public.medication_catalog FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view presentations" ON public.medication_presentations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage presentations" ON public.medication_presentations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view aliases" ON public.medication_aliases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage aliases" ON public.medication_aliases FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Índices para busca
CREATE INDEX idx_medication_catalog_name ON public.medication_catalog USING gin (to_tsvector('portuguese', generic_name));
CREATE INDEX idx_medication_aliases_name ON public.medication_aliases USING gin (to_tsvector('portuguese', alias_name));
CREATE INDEX idx_medication_catalog_class ON public.medication_catalog (therapeutic_class);
