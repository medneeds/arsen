-- Criar tabela para armazenar versões/snapshots dos pacientes
CREATE TABLE public.patient_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NULL,
  description TEXT NOT NULL,
  snapshot_data JSONB NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.patient_versions ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Usuários autenticados podem visualizar versões" 
ON public.patient_versions 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem criar versões" 
ON public.patient_versions 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins podem deletar versões" 
ON public.patient_versions 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_patient_versions_updated_at
BEFORE UPDATE ON public.patient_versions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();