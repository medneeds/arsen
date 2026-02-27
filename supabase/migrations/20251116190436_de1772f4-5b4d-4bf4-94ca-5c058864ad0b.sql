-- Criar tabela de pacientes
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bed_number TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  age INTEGER,
  sector TEXT NOT NULL CHECK (sector IN ('red', 'yellow', 'blue', 'outside')),
  diagnoses TEXT,
  medical_history TEXT,
  relevant_exams TEXT,
  pendencies TEXT,
  schedule TEXT,
  admission_history TEXT,
  admission_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(bed_number)
);

-- Habilitar RLS
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso: todos os médicos autenticados podem ver e editar
CREATE POLICY "Médicos podem visualizar todos os pacientes"
  ON public.patients
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Médicos podem criar pacientes"
  ON public.patients
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Médicos podem atualizar pacientes"
  ON public.patients
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins podem deletar pacientes"
  ON public.patients
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.patients;

-- Inserir leitos iniciais vazios (40 leitos distribuídos pelos setores)
INSERT INTO public.patients (bed_number, name, sector, created_by) VALUES
  -- Setor Vermelho (Críticos) - 10 leitos
  ('101', '', 'red', auth.uid()),
  ('102', '', 'red', auth.uid()),
  ('103', '', 'red', auth.uid()),
  ('104', '', 'red', auth.uid()),
  ('105', '', 'red', auth.uid()),
  ('106', '', 'red', auth.uid()),
  ('107', '', 'red', auth.uid()),
  ('108', '', 'red', auth.uid()),
  ('109', '', 'red', auth.uid()),
  ('110', '', 'red', auth.uid()),
  
  -- Setor Amarelo (Semi-intensivo) - 12 leitos
  ('201', '', 'yellow', auth.uid()),
  ('202', '', 'yellow', auth.uid()),
  ('203', '', 'yellow', auth.uid()),
  ('204', '', 'yellow', auth.uid()),
  ('205', '', 'yellow', auth.uid()),
  ('206', '', 'yellow', auth.uid()),
  ('207', '', 'yellow', auth.uid()),
  ('208', '', 'yellow', auth.uid()),
  ('209', '', 'yellow', auth.uid()),
  ('210', '', 'yellow', auth.uid()),
  ('211', '', 'yellow', auth.uid()),
  ('212', '', 'yellow', auth.uid()),
  
  -- Setor Azul (Estáveis) - 15 leitos
  ('301', '', 'blue', auth.uid()),
  ('302', '', 'blue', auth.uid()),
  ('303', '', 'blue', auth.uid()),
  ('304', '', 'blue', auth.uid()),
  ('305', '', 'blue', auth.uid()),
  ('306', '', 'blue', auth.uid()),
  ('307', '', 'blue', auth.uid()),
  ('308', '', 'blue', auth.uid()),
  ('309', '', 'blue', auth.uid()),
  ('310', '', 'blue', auth.uid()),
  ('311', '', 'blue', auth.uid()),
  ('312', '', 'blue', auth.uid()),
  ('313', '', 'blue', auth.uid()),
  ('314', '', 'blue', auth.uid()),
  ('315', '', 'blue', auth.uid()),
  
  -- Fora (Externos) - 3 leitos
  ('EXT-1', '', 'outside', auth.uid()),
  ('EXT-2', '', 'outside', auth.uid()),
  ('EXT-3', '', 'outside', auth.uid());