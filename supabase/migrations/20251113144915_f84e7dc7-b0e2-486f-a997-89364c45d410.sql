-- Criar tabela para registro de passagens de plantão
CREATE TABLE public.shift_handovers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  snapshot_data JSONB NOT NULL,
  notes TEXT,
  total_patients INTEGER NOT NULL DEFAULT 0,
  occupied_beds INTEGER NOT NULL DEFAULT 0,
  shift_type TEXT CHECK (shift_type IN ('DIURNO', 'NOTURNO', 'OUTRO'))
);

-- Criar índices para melhor performance
CREATE INDEX idx_shift_handovers_created_at ON public.shift_handovers(created_at DESC);
CREATE INDEX idx_shift_handovers_created_by ON public.shift_handovers(created_by);

-- Habilitar RLS
ALTER TABLE public.shift_handovers ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: Todos autenticados podem visualizar passagens
CREATE POLICY "Usuários autenticados podem visualizar passagens"
ON public.shift_handovers
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Apenas usuários autenticados podem criar passagens
CREATE POLICY "Usuários autenticados podem criar passagens"
ON public.shift_handovers
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Apenas admins podem deletar passagens
CREATE POLICY "Admins podem deletar passagens"
ON public.shift_handovers
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Apenas criador ou admin podem atualizar passagens
CREATE POLICY "Criador ou admin podem atualizar passagens"
ON public.shift_handovers
FOR UPDATE
TO authenticated
USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_shift_handovers_updated_at
BEFORE UPDATE ON public.shift_handovers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();