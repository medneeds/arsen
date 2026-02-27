-- Criar tabela para códigos médicos (exames, procedimentos, materiais, medicações)
CREATE TABLE public.medical_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  category TEXT NOT NULL CHECK (category IN ('EXAMES', 'PROCEDIMENTOS', 'MATERIAIS', 'MEDICAÇÕES')),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  system_description TEXT NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.medical_codes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para permitir leitura pública
CREATE POLICY "Qualquer um pode visualizar códigos médicos"
ON public.medical_codes
FOR SELECT
USING (true);

CREATE POLICY "Qualquer um pode criar códigos médicos"
ON public.medical_codes
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Qualquer um pode atualizar códigos médicos"
ON public.medical_codes
FOR UPDATE
USING (true);

CREATE POLICY "Qualquer um pode deletar códigos médicos"
ON public.medical_codes
FOR DELETE
USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_medical_codes_updated_at
BEFORE UPDATE ON public.medical_codes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Criar índice para melhorar performance de busca por categoria
CREATE INDEX idx_medical_codes_category ON public.medical_codes(category);