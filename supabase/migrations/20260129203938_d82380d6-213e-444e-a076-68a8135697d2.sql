-- Tabela para registro de consentimentos LGPD
CREATE TABLE public.user_consents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL, -- 'terms_of_use', 'privacy_policy', 'data_processing'
  consent_version TEXT NOT NULL, -- Versão do documento aceito
  accepted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  revoked_at TIMESTAMP WITH TIME ZONE,
  revoked_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, consent_type, consent_version)
);

-- Índices para consultas frequentes
CREATE INDEX idx_user_consents_user_id ON public.user_consents(user_id);
CREATE INDEX idx_user_consents_type ON public.user_consents(consent_type);
CREATE INDEX idx_user_consents_accepted ON public.user_consents(accepted_at);

-- Enable RLS
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

-- Política: usuários podem ver apenas seus próprios consentimentos
CREATE POLICY "Users can view own consents"
ON public.user_consents
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Política: usuários podem inserir seus próprios consentimentos
CREATE POLICY "Users can insert own consents"
ON public.user_consents
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Política: admins podem ver todos os consentimentos (para auditoria)
CREATE POLICY "Admins can view all consents"
ON public.user_consents
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Adicionar coluna de última aceitação de termos no perfil
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS terms_version TEXT,
ADD COLUMN IF NOT EXISTS data_export_requested_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS data_deletion_requested_at TIMESTAMP WITH TIME ZONE;

-- Tabela para solicitações de portabilidade/exclusão de dados
CREATE TABLE public.data_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('export', 'deletion', 'rectification')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID,
  notes TEXT,
  export_url TEXT,
  export_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_data_requests_user_id ON public.data_requests(user_id);
CREATE INDEX idx_data_requests_status ON public.data_requests(status);
CREATE INDEX idx_data_requests_type ON public.data_requests(request_type);

-- Enable RLS
ALTER TABLE public.data_requests ENABLE ROW LEVEL SECURITY;

-- Políticas para data_requests
CREATE POLICY "Users can view own data requests"
ON public.data_requests
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own data requests"
ON public.data_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all data requests"
ON public.data_requests
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update data requests"
ON public.data_requests
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Tabela para configuração de retenção de dados
CREATE TABLE public.data_retention_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL UNIQUE,
  retention_years INTEGER NOT NULL DEFAULT 20, -- CFM exige 20 anos para prontuários
  description TEXT,
  legal_basis TEXT, -- Lei que fundamenta a retenção
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inserir políticas de retenção padrão (CFM 1.821/2007)
INSERT INTO public.data_retention_policies (table_name, retention_years, description, legal_basis) VALUES
('patients', 20, 'Dados de pacientes e prontuários', 'Resolução CFM 1.821/2007 - Art. 7º'),
('patient_movements', 20, 'Histórico de movimentações de pacientes', 'Resolução CFM 1.821/2007 - Art. 7º'),
('audit_logs', 20, 'Logs de auditoria do sistema', 'LGPD Art. 37 + CFM 1.821/2007'),
('shift_handovers', 20, 'Passagens de plantão', 'Resolução CFM 1.821/2007'),
('sepsis_protocols', 20, 'Protocolos de sepse', 'Resolução CFM 1.821/2007'),
('user_consents', 5, 'Registros de consentimento', 'LGPD Art. 8º'),
('profiles', 5, 'Perfis de usuários', 'LGPD Art. 16'),
('data_requests', 5, 'Solicitações de dados LGPD', 'LGPD Art. 18');

-- Enable RLS
ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem gerenciar políticas de retenção
CREATE POLICY "Admins can manage retention policies"
ON public.data_retention_policies
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Usuários autenticados podem visualizar políticas
CREATE POLICY "Authenticated users can view retention policies"
ON public.data_retention_policies
FOR SELECT
TO authenticated
USING (true);