-- =============================================================
-- TRILHA DE AUDITORIA PARA CONFORMIDADE LGPD E CFM 1.821/2007
-- =============================================================

-- Tipo enum para ações de auditoria
CREATE TYPE public.audit_action AS ENUM ('INSERT', 'UPDATE', 'DELETE', 'SELECT', 'LOGIN', 'LOGOUT');

-- Tabela principal de logs de auditoria
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Informações do usuário
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  user_role TEXT,
  -- Informações da ação
  action audit_action NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  -- Dados da mudança (para UPDATE mostra antes/depois)
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],
  -- Metadados da requisição
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  -- Contexto hospitalar
  hospital_unit_id UUID REFERENCES public.hospital_units(id) ON DELETE SET NULL,
  state_id UUID REFERENCES public.states(id) ON DELETE SET NULL,
  department TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Índices para busca rápida
  CONSTRAINT audit_logs_action_check CHECK (action IS NOT NULL)
);

-- Índices para performance em consultas de auditoria
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX idx_audit_logs_record_id ON public.audit_logs(record_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_hospital_unit ON public.audit_logs(hospital_unit_id);

-- Habilitar RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem visualizar logs de auditoria
CREATE POLICY "Only admins can view audit logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Sistema pode inserir logs (via triggers)
CREATE POLICY "System can insert audit logs"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Ninguém pode atualizar ou deletar logs (imutabilidade)
-- Não criar policies para UPDATE/DELETE = negado por padrão

-- =============================================================
-- FUNÇÃO GENÉRICA DE AUDITORIA
-- =============================================================

CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_data JSONB;
  v_new_data JSONB;
  v_changed_fields TEXT[];
  v_record_id UUID;
  v_user_id UUID;
  v_user_email TEXT;
  v_user_role TEXT;
  v_hospital_unit_id UUID;
  v_state_id UUID;
  v_department TEXT;
  key_name TEXT;
BEGIN
  -- Capturar informações do usuário atual
  v_user_id := auth.uid();
  
  -- Buscar email e role do usuário
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  SELECT role INTO v_user_role FROM public.user_roles WHERE user_id = v_user_id LIMIT 1;
  
  -- Determinar dados baseado na operação
  IF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
    v_record_id := OLD.id;
    -- Tentar extrair contexto hospitalar do registro antigo
    v_hospital_unit_id := (OLD.hospital_unit_id)::UUID;
    v_state_id := (OLD.state_id)::UUID;
    v_department := OLD.department;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    v_record_id := NEW.id;
    v_hospital_unit_id := (NEW.hospital_unit_id)::UUID;
    v_state_id := (NEW.state_id)::UUID;
    v_department := NEW.department;
    
    -- Identificar campos alterados
    FOR key_name IN SELECT jsonb_object_keys(v_new_data)
    LOOP
      IF v_old_data->key_name IS DISTINCT FROM v_new_data->key_name THEN
        v_changed_fields := array_append(v_changed_fields, key_name);
      END IF;
    END LOOP;
  ELSIF TG_OP = 'INSERT' THEN
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);
    v_record_id := NEW.id;
    v_hospital_unit_id := (NEW.hospital_unit_id)::UUID;
    v_state_id := (NEW.state_id)::UUID;
    v_department := NEW.department;
  END IF;
  
  -- Inserir log de auditoria
  INSERT INTO public.audit_logs (
    user_id,
    user_email,
    user_role,
    action,
    table_name,
    record_id,
    old_data,
    new_data,
    changed_fields,
    hospital_unit_id,
    state_id,
    department
  ) VALUES (
    v_user_id,
    v_user_email,
    v_user_role,
    TG_OP::audit_action,
    TG_TABLE_NAME,
    v_record_id,
    v_old_data,
    v_new_data,
    v_changed_fields,
    v_hospital_unit_id,
    v_state_id,
    v_department
  );
  
  -- Retornar o registro apropriado
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- =============================================================
-- TRIGGERS NAS TABELAS DE PACIENTES E DADOS SENSÍVEIS
-- =============================================================

-- Trigger para tabela patients
CREATE TRIGGER audit_patients_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Trigger para tabela patient_movements
CREATE TRIGGER audit_patient_movements_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.patient_movements
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Trigger para tabela patient_versions
CREATE TRIGGER audit_patient_versions_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.patient_versions
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Trigger para tabela sepsis_protocols
CREATE TRIGGER audit_sepsis_protocols_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.sepsis_protocols
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Trigger para tabela shift_handovers
CREATE TRIGGER audit_shift_handovers_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.shift_handovers
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Trigger para tabela dhd_patients
CREATE TRIGGER audit_dhd_patients_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.dhd_patients
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Trigger para tabela internment_requests
CREATE TRIGGER audit_internment_requests_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.internment_requests
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Trigger para tabela bed_allocation_requests
CREATE TRIGGER audit_bed_allocation_requests_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.bed_allocation_requests
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- =============================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =============================================================

COMMENT ON TABLE public.audit_logs IS 'Trilha de auditoria para conformidade LGPD e Resolução CFM 1.821/2007. Retenção mínima: 20 anos.';
COMMENT ON COLUMN public.audit_logs.old_data IS 'Estado anterior do registro (para UPDATE e DELETE)';
COMMENT ON COLUMN public.audit_logs.new_data IS 'Novo estado do registro (para INSERT e UPDATE)';
COMMENT ON COLUMN public.audit_logs.changed_fields IS 'Lista de campos que foram alterados (para UPDATE)';