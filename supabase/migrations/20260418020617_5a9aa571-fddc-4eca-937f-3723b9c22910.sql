-- ============================================================
-- prescription_quick_templates
-- Templates de prescrição rápida (combos clínicos 1-clique)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.prescription_quick_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  clinical_category TEXT NOT NULL DEFAULT 'geral',
  -- Lista de itens da prescrição em JSON (mesmo shape do PrescriptionItem do front)
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Escopo
  scope TEXT NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal','shared')),
  -- Vínculos
  created_by UUID,                       -- NULL = template do sistema/hospital
  hospital_unit_id UUID REFERENCES public.hospital_units(id) ON DELETE CASCADE,
  state_id UUID REFERENCES public.states(id) ON DELETE CASCADE,
  -- Métricas de uso
  use_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pqt_scope_created_by ON public.prescription_quick_templates(scope, created_by);
CREATE INDEX IF NOT EXISTS idx_pqt_hospital ON public.prescription_quick_templates(hospital_unit_id);
CREATE INDEX IF NOT EXISTS idx_pqt_clinical_category ON public.prescription_quick_templates(clinical_category);
CREATE INDEX IF NOT EXISTS idx_pqt_use_count ON public.prescription_quick_templates(use_count DESC);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_pqt_updated_at ON public.prescription_quick_templates;
CREATE TRIGGER trg_pqt_updated_at
BEFORE UPDATE ON public.prescription_quick_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.prescription_quick_templates ENABLE ROW LEVEL SECURITY;

-- View: own personal OR any shared
CREATE POLICY "View own personal or any shared templates"
ON public.prescription_quick_templates
FOR SELECT
TO authenticated
USING (
  (scope = 'shared')
  OR (scope = 'personal' AND auth.uid() = created_by)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Insert: any authenticated user, must own it (or be admin creating shared)
CREATE POLICY "Authenticated users can create templates"
ON public.prescription_quick_templates
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    -- pessoais devem pertencer ao próprio usuário
    (scope = 'personal' AND auth.uid() = created_by)
    -- compartilhados podem ser criados por qualquer autenticado
    OR (scope = 'shared')
  )
);

-- Update: owner OR admin
CREATE POLICY "Owners and admins can update templates"
ON public.prescription_quick_templates
FOR UPDATE
TO authenticated
USING (
  (auth.uid() = created_by) OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Delete: owner OR admin
CREATE POLICY "Owners and admins can delete templates"
ON public.prescription_quick_templates
FOR DELETE
TO authenticated
USING (
  (auth.uid() = created_by) OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- ============================================================
-- RPC: increment use_count atomicamente
-- ============================================================
CREATE OR REPLACE FUNCTION public.bump_quick_template_use(_template_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.prescription_quick_templates
  SET use_count = use_count + 1,
      last_used_at = now()
  WHERE id = _template_id;
END;
$$;

-- ============================================================
-- Seed: 5 templates compartilhados (created_by NULL = sistema)
-- ============================================================
INSERT INTO public.prescription_quick_templates (name, description, clinical_category, scope, items)
VALUES
(
  'Sepse — Pacote 1ª hora',
  'Bundle inicial: ATB de amplo espectro, hidratação 30 mL/kg, lactato/hemoculturas, vasopressor se necessário.',
  'sepse',
  'shared',
  '[
    {"name":"Ceftriaxona","presentation":"1g FA","dose":"2 g","route":"EV","posology":"12/12h","schedule":"","instructions":"Diluir em 100 mL SF 0,9% — correr em 30 min","category":"antimicrobianos","flags":["AB"],"highAlert":false,"diluent":"SF 0,9%","diluentVolume":"100","infusionTime":"30","quantity":"2","quantityUnit":"g"},
    {"name":"Soro Fisiológico 0,9%","presentation":"500 mL","dose":"30 mL/kg","route":"EV","posology":"em bolus","schedule":"","instructions":"Reposição volêmica inicial — reavaliar após bolus","category":"hidratacao","flags":[],"highAlert":false,"quantity":"500","quantityUnit":"mL"},
    {"name":"Hemoculturas (2 amostras)","presentation":"-","dose":"-","route":"-","posology":"agora","schedule":"","instructions":"Coletar 2 amostras periféricas ANTES do ATB","category":"cuidados","flags":[],"highAlert":false},
    {"name":"Lactato sérico","presentation":"-","dose":"-","route":"-","posology":"agora e em 2h","schedule":"","instructions":"Reavaliar perfusão tecidual","category":"cuidados","flags":[],"highAlert":false}
  ]'::jsonb
),
(
  'Pós-operatório geral',
  'Analgesia multimodal, antiemético, profilaxia de TEV e cuidados pós-anestésicos.',
  'pos-op',
  'shared',
  '[
    {"name":"Dipirona Sódica","presentation":"500 mg/mL — Amp 2 mL","dose":"1 g","route":"EV","posology":"6/6h","schedule":"","instructions":"Diluir em 10 mL AD","category":"sintomaticos","flags":[],"highAlert":false,"diluent":"AD","diluentVolume":"10"},
    {"name":"Ondansetrona","presentation":"4 mg/2 mL","dose":"4 mg","route":"EV","posology":"8/8h","schedule":"","instructions":"Antiemético — se náusea","category":"sintomaticos","flags":["SN"],"highAlert":false},
    {"name":"Enoxaparina","presentation":"40 mg/0,4 mL","dose":"40 mg","route":"SC","posology":"1x/dia","schedule":"22:00","instructions":"Profilaxia TEV — iniciar 12h pós-op","category":"profilaxia","flags":[],"highAlert":false},
    {"name":"Cabeceira elevada 30°","presentation":"-","dose":"-","route":"-","posology":"contínuo","schedule":"","instructions":"Manter durante todo o pós-operatório","category":"cuidados","flags":[],"highAlert":false}
  ]'::jsonb
),
(
  'DPOC exacerbado',
  'Broncodilatador inalatório, corticoide sistêmico, ATB se sinais infecciosos, oxigenoterapia controlada.',
  'respiratorio',
  'shared',
  '[
    {"name":"Salbutamol (spray)","presentation":"100 mcg/dose","dose":"4 jatos","route":"INAL","posology":"4/4h","schedule":"","instructions":"Com espaçador — pode repetir 20/20min em crise","category":"sintomaticos","flags":[],"highAlert":false},
    {"name":"Brometo de Ipratrópio","presentation":"0,25 mg/mL","dose":"40 gotas","route":"INAL","posology":"6/6h","schedule":"","instructions":"Nebulização com 3 mL SF 0,9% e O2 a 6 L/min","category":"sintomaticos","flags":[],"highAlert":false},
    {"name":"Hidrocortisona","presentation":"500 mg FA","dose":"100 mg","route":"EV","posology":"6/6h","schedule":"","instructions":"Corticoide sistêmico — desmame após 5-7 dias","category":"sintomaticos","flags":[],"highAlert":false},
    {"name":"O2 sob cateter nasal","presentation":"-","dose":"2-3 L/min","route":"-","posology":"contínuo","schedule":"","instructions":"Manter SpO2 88-92% — evitar hiperóxia","category":"cuidados","flags":[],"highAlert":false}
  ]'::jsonb
),
(
  'IAM sem supra (SCA)',
  'AAS + clopidogrel, anticoagulação, estatina alta potência, betabloqueador, IECA.',
  'cardiovascular',
  'shared',
  '[
    {"name":"AAS","presentation":"100 mg comp","dose":"300 mg","route":"VO","posology":"dose única (ataque)","schedule":"agora","instructions":"Mastigar — depois 100 mg/dia","category":"antiagregantes","flags":[],"highAlert":false},
    {"name":"Clopidogrel","presentation":"75 mg comp","dose":"300 mg","route":"VO","posology":"dose única (ataque)","schedule":"agora","instructions":"Depois 75 mg/dia por 12 meses","category":"antiagregantes","flags":[],"highAlert":false},
    {"name":"Enoxaparina","presentation":"60 mg/0,6 mL","dose":"1 mg/kg","route":"SC","posology":"12/12h","schedule":"","instructions":"Anticoagulação plena","category":"profilaxia","flags":[],"highAlert":true},
    {"name":"Atorvastatina","presentation":"80 mg comp","dose":"80 mg","route":"VO","posology":"1x/dia","schedule":"22:00","instructions":"Alta potência — manter indefinidamente","category":"medicacoes","flags":[],"highAlert":false},
    {"name":"Metoprolol","presentation":"25 mg comp","dose":"25 mg","route":"VO","posology":"12/12h","schedule":"","instructions":"Iniciar se PAS > 100 e FC > 60","category":"medicacoes","flags":[],"highAlert":false}
  ]'::jsonb
),
(
  'AVC isquêmico — admissão',
  'Suporte clínico, profilaxia de complicações, controle pressórico permissivo, avaliação para trombólise.',
  'neurologico',
  'shared',
  '[
    {"name":"Cabeceira a 0° (se trombólise) ou 30° (se HIC)","presentation":"-","dose":"-","route":"-","posology":"contínuo","schedule":"","instructions":"Conforme protocolo — reavaliar em 24h","category":"cuidados","flags":[],"highAlert":false},
    {"name":"NPO até avaliação fonoaudiológica","presentation":"-","dose":"-","route":"-","posology":"contínuo","schedule":"","instructions":"Risco de broncoaspiração","category":"dieta","flags":[],"highAlert":false},
    {"name":"Glicemia capilar","presentation":"-","dose":"-","route":"-","posology":"4/4h","schedule":"","instructions":"Manter 140-180 mg/dL","category":"cuidados","flags":[],"highAlert":false},
    {"name":"Enoxaparina","presentation":"40 mg/0,4 mL","dose":"40 mg","route":"SC","posology":"1x/dia","schedule":"22:00","instructions":"Profilaxia TEV — APENAS após 24h se trombólise","category":"profilaxia","flags":[],"highAlert":false},
    {"name":"Omeprazol","presentation":"40 mg FA","dose":"40 mg","route":"EV","posology":"1x/dia","schedule":"08:00","instructions":"Profilaxia úlcera de estresse","category":"profilaxia","flags":[],"highAlert":false}
  ]'::jsonb
);