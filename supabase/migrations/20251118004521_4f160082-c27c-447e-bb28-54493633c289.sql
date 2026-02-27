-- Tabela para armazenar protocolos de sepse preenchidos
CREATE TABLE public.sepsis_protocols (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Dados do paciente
  patient_id UUID REFERENCES public.patients(id),
  patient_name TEXT NOT NULL,
  birth_date DATE,
  attendance_number TEXT,
  hospital TEXT,
  
  -- Responsável pela abertura
  responsible_name TEXT,
  opening_date DATE,
  opening_time TIME,
  
  -- Critérios SIRS (boolean checkboxes)
  sirs_temp_high BOOLEAN DEFAULT false,
  sirs_temp_low BOOLEAN DEFAULT false,
  sirs_heart_rate BOOLEAN DEFAULT false,
  sirs_respiratory_rate BOOLEAN DEFAULT false,
  sirs_leukocytosis BOOLEAN DEFAULT false,
  sirs_leukopenia BOOLEAN DEFAULT false,
  sirs_young_cells BOOLEAN DEFAULT false,
  
  -- Critérios de disfunção orgânica (boolean checkboxes)
  dysfunction_hypotension BOOLEAN DEFAULT false,
  dysfunction_oliguria BOOLEAN DEFAULT false,
  dysfunction_pao2 BOOLEAN DEFAULT false,
  dysfunction_platelets BOOLEAN DEFAULT false,
  dysfunction_acidosis BOOLEAN DEFAULT false,
  dysfunction_consciousness BOOLEAN DEFAULT false,
  dysfunction_bilirubin BOOLEAN DEFAULT false,
  
  -- Infecção
  has_infection BOOLEAN,
  infection_excluded_date TIMESTAMP WITH TIME ZONE,
  
  -- Coletas
  blood_culture_date DATE,
  blood_culture_time TIME,
  lactate_date DATE,
  lactate_time TIME,
  antibiotic_prescription_date DATE,
  antibiotic_prescription_time TIME,
  
  -- Foco infeccioso
  focus_pulmonary BOOLEAN DEFAULT false,
  focus_urinary BOOLEAN DEFAULT false,
  focus_abdominal BOOLEAN DEFAULT false,
  focus_skin BOOLEAN DEFAULT false,
  focus_neurological BOOLEAN DEFAULT false,
  focus_other TEXT,
  
  -- Disfunção orgânica após pacote sepse
  has_organic_dysfunction BOOLEAN,
  dysfunction_excluded_date TIMESTAMP WITH TIME ZONE,
  
  -- Reposição volêmica
  patient_weight DECIMAL,
  volume_administered DECIMAL,
  
  -- Destino
  destination TEXT CHECK (destination IN ('UTI', 'Internação')),
  destination_date DATE,
  destination_time TIME,
  
  -- Desfecho
  outcome TEXT CHECK (outcome IN ('Alta', 'Óbito')),
  outcome_date DATE,
  outcome_time TIME,
  
  -- Observações adicionais
  notes TEXT
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_sepsis_protocols_updated_at
  BEFORE UPDATE ON public.sepsis_protocols
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies
ALTER TABLE public.sepsis_protocols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem visualizar protocolos"
  ON public.sepsis_protocols
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem criar protocolos"
  ON public.sepsis_protocols
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Usuários podem atualizar próprios protocolos"
  ON public.sepsis_protocols
  FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Admins podem atualizar todos protocolos"
  ON public.sepsis_protocols
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar protocolos"
  ON public.sepsis_protocols
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));