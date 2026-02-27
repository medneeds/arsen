-- Adicionar novo papel 'porta' ao enum existente
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'porta';

-- Criar tabela para solicitações de alocação de leito
CREATE TABLE public.bed_allocation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES auth.users(id),
  requested_sector TEXT NOT NULL,
  requested_bed TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'discussing', 'rejected')),
  rejection_reason TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  state_id UUID NOT NULL REFERENCES public.states(id),
  hospital_unit_id UUID NOT NULL REFERENCES public.hospital_units(id),
  department TEXT NOT NULL DEFAULT 'URGÊNCIA E EMERGÊNCIA ADULTO',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar campo is_door_patient na tabela patients para identificar pacientes da porta
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS is_door_patient BOOLEAN DEFAULT false;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS allocation_status TEXT DEFAULT NULL CHECK (allocation_status IN ('pending', 'approved', 'discussing', 'rejected', NULL));

-- Habilitar RLS
ALTER TABLE public.bed_allocation_requests ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para bed_allocation_requests
CREATE POLICY "Usuários autenticados podem criar solicitações"
ON public.bed_allocation_requests
FOR INSERT
WITH CHECK (auth.uid() = requested_by);

CREATE POLICY "Usuários autenticados podem visualizar solicitações do mesmo hospital"
ON public.bed_allocation_requests
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins e médicos podem atualizar solicitações"
ON public.bed_allocation_requests
FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins podem deletar solicitações"
ON public.bed_allocation_requests
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_bed_allocation_requests_updated_at
BEFORE UPDATE ON public.bed_allocation_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar realtime para notificações em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.bed_allocation_requests;

-- Índices para performance
CREATE INDEX idx_bed_allocation_requests_status ON public.bed_allocation_requests(status);
CREATE INDEX idx_bed_allocation_requests_hospital_department ON public.bed_allocation_requests(hospital_unit_id, department);
CREATE INDEX idx_patients_is_door_patient ON public.patients(is_door_patient) WHERE is_door_patient = true;