-- Criar tabela de solicitações de internação
CREATE TABLE public.internment_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar Row Level Security
ALTER TABLE public.internment_requests ENABLE ROW LEVEL SECURITY;

-- Criar política para permitir que todos possam visualizar
CREATE POLICY "Qualquer um pode visualizar solicitações de internação" 
ON public.internment_requests 
FOR SELECT 
USING (true);

-- Criar política para permitir que todos possam criar
CREATE POLICY "Qualquer um pode criar solicitações de internação" 
ON public.internment_requests 
FOR INSERT 
WITH CHECK (true);

-- Criar política para permitir que todos possam atualizar
CREATE POLICY "Qualquer um pode atualizar solicitações de internação" 
ON public.internment_requests 
FOR UPDATE 
USING (true);

-- Criar política para permitir que todos possam deletar
CREATE POLICY "Qualquer um pode deletar solicitações de internação" 
ON public.internment_requests 
FOR DELETE 
USING (true);

-- Criar função para atualizar timestamps automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Criar trigger para atualização automática de timestamps
CREATE TRIGGER update_internment_requests_updated_at
BEFORE UPDATE ON public.internment_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();