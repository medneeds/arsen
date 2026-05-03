-- Tabela para pendências de implantação (radar do desenvolvedor)
CREATE TABLE public.dev_pendencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  priority TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa','media','alta','critica')),
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','em_andamento','bloqueada','concluida','arquivada')),
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE public.dev_pendencies ENABLE ROW LEVEL SECURITY;

-- Apenas admin/dev podem ver e gerenciar
CREATE POLICY "Dev/admin podem ver pendências"
ON public.dev_pendencies FOR SELECT TO authenticated
USING (public.is_dev_user(auth.uid()));

CREATE POLICY "Dev/admin podem criar pendências"
ON public.dev_pendencies FOR INSERT TO authenticated
WITH CHECK (public.is_dev_user(auth.uid()));

CREATE POLICY "Dev/admin podem editar pendências"
ON public.dev_pendencies FOR UPDATE TO authenticated
USING (public.is_dev_user(auth.uid()));

CREATE POLICY "Dev/admin podem excluir pendências"
ON public.dev_pendencies FOR DELETE TO authenticated
USING (public.is_dev_user(auth.uid()));

CREATE TRIGGER update_dev_pendencies_updated_at
BEFORE UPDATE ON public.dev_pendencies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_dev_pendencies_status ON public.dev_pendencies(status);
CREATE INDEX idx_dev_pendencies_priority ON public.dev_pendencies(priority);