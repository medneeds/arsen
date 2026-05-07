
-- Allowlist de IPs por módulo
CREATE TABLE public.module_ip_allowlist (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_key text NOT NULL,
  ip_cidr cidr NOT NULL,
  label text,
  hospital_unit_id uuid,
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_module_ip_allowlist_module ON public.module_ip_allowlist(module_key) WHERE enabled = true;

ALTER TABLE public.module_ip_allowlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read allowlist"
  ON public.module_ip_allowlist FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage allowlist insert"
  ON public.module_ip_allowlist FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage allowlist update"
  ON public.module_ip_allowlist FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage allowlist delete"
  ON public.module_ip_allowlist FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_module_ip_allowlist_updated
  BEFORE UPDATE ON public.module_ip_allowlist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Configuração por módulo
CREATE TABLE public.module_ip_settings (
  module_key text NOT NULL PRIMARY KEY,
  enforce boolean NOT NULL DEFAULT false,
  bypass_for_admin boolean NOT NULL DEFAULT true,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.module_ip_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read settings"
  ON public.module_ip_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage settings insert"
  ON public.module_ip_settings FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage settings update"
  ON public.module_ip_settings FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage settings delete"
  ON public.module_ip_settings FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_module_ip_settings_updated
  BEFORE UPDATE ON public.module_ip_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Log de tentativas
CREATE TABLE public.ip_access_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_key text NOT NULL,
  ip inet,
  user_id uuid,
  user_email text,
  allowed boolean NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ip_access_log_created ON public.ip_access_log(created_at DESC);
CREATE INDEX idx_ip_access_log_module ON public.ip_access_log(module_key, created_at DESC);

ALTER TABLE public.ip_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read ip log"
  ON public.ip_access_log FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Função de checagem
CREATE OR REPLACE FUNCTION public.is_ip_allowed_for_module(_module text, _ip inet)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.module_ip_allowlist
    WHERE module_key = _module
      AND enabled = true
      AND _ip <<= ip_cidr
  );
$$;

-- Seeds de configuração (todos desligados para não dar lockout)
INSERT INTO public.module_ip_settings (module_key, enforce, bypass_for_admin, description) VALUES
  ('farmacia', false, true, 'Validação Farmacêutica / Farmácia Clínica'),
  ('nir', false, true, 'NIR / Regulação'),
  ('gestor', false, true, 'Painel Gestor'),
  ('dev_console', false, true, 'Console de desenvolvedor'),
  ('validacao_farmaceutica', false, true, 'Validação Farmacêutica');
