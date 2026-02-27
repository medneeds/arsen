-- Tabela para solicitações de reset de senha
CREATE TABLE public.password_reset_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  crm TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  reviewer_notes TEXT,
  new_password_set_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_password_reset_status ON public.password_reset_requests(status);
CREATE INDEX idx_password_reset_username ON public.password_reset_requests(username);
CREATE INDEX idx_password_reset_crm ON public.password_reset_requests(crm);

-- Enable RLS
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa pode inserir solicitação (não autenticado)
CREATE POLICY "Anyone can request password reset"
ON public.password_reset_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Admins podem ver todas as solicitações
CREATE POLICY "Admins can view all reset requests"
ON public.password_reset_requests
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins podem atualizar solicitações
CREATE POLICY "Admins can update reset requests"
ON public.password_reset_requests
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));