CREATE TABLE IF NOT EXISTS public.user_admin_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  actor_id UUID,
  actor_email TEXT,
  actor_name TEXT,
  target_user_id UUID,
  target_email TEXT,
  target_name TEXT,
  action TEXT NOT NULL,
  hospital_unit_id UUID,
  access_profile TEXT,
  app_role TEXT,
  departments TEXT[],
  old_data JSONB,
  new_data JSONB,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_admin_audit_target ON public.user_admin_audit (target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_admin_audit_actor ON public.user_admin_audit (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_admin_audit_action ON public.user_admin_audit (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_admin_audit_created_at ON public.user_admin_audit (created_at DESC);

ALTER TABLE public.user_admin_audit ENABLE ROW LEVEL SECURITY;

-- Admin OU usuário com access_profile = 'gestor' podem ler
CREATE POLICY "Admins and gestores can view user admin audit"
ON public.user_admin_audit
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.access_profile = 'gestor'
  )
);

CREATE POLICY "Authenticated can insert user admin audit"
ON public.user_admin_audit
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
-- Sem UPDATE / DELETE = imutável