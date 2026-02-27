-- 1. Adicionar coluna created_by para rastrear criador das solicitações
ALTER TABLE public.internment_requests 
ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Adicionar constraints de validação para internment_requests
ALTER TABLE public.internment_requests
ADD CONSTRAINT patient_name_length CHECK (length(patient_name) > 0 AND length(patient_name) <= 200),
ADD CONSTRAINT patient_age_valid CHECK (patient_age IS NULL OR (patient_age > 0 AND patient_age < 150)),
ADD CONSTRAINT title_not_empty CHECK (length(trim(title)) > 0),
ADD CONSTRAINT content_not_empty CHECK (length(trim(content)) > 0),
ADD CONSTRAINT patient_record_length CHECK (patient_record IS NULL OR length(patient_record) <= 50);

-- 3. Adicionar constraints de validação para medical_codes
ALTER TABLE public.medical_codes
ADD CONSTRAINT code_not_empty CHECK (length(trim(code)) > 0 AND length(code) <= 50),
ADD CONSTRAINT name_not_empty CHECK (length(trim(name)) > 0 AND length(name) <= 200),
ADD CONSTRAINT system_description_not_empty CHECK (length(trim(system_description)) > 0 AND length(system_description) <= 500),
ADD CONSTRAINT category_valid CHECK (category IN ('exames', 'procedimentos', 'materiais', 'medicacoes'));

-- 4. Remover políticas RLS antigas de internment_requests
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar solicitações" ON public.internment_requests;
DROP POLICY IF EXISTS "Usuários autenticados podem criar solicitações" ON public.internment_requests;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar solicitações" ON public.internment_requests;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar solicitações" ON public.internment_requests;

-- 5. Criar novas políticas RLS seguras para internment_requests
-- Usuários podem ver suas próprias solicitações
CREATE POLICY "Users can view own internment requests"
ON public.internment_requests
FOR SELECT
USING (auth.uid() = created_by);

-- Admins podem ver todas as solicitações
CREATE POLICY "Admins can view all internment requests"
ON public.internment_requests
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Usuários podem criar suas próprias solicitações (created_by será definido automaticamente)
CREATE POLICY "Users can create own internment requests"
ON public.internment_requests
FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- Usuários podem atualizar suas próprias solicitações
CREATE POLICY "Users can update own internment requests"
ON public.internment_requests
FOR UPDATE
USING (auth.uid() = created_by);

-- Admins podem atualizar qualquer solicitação
CREATE POLICY "Admins can update all internment requests"
ON public.internment_requests
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Usuários podem deletar suas próprias solicitações
CREATE POLICY "Users can delete own internment requests"
ON public.internment_requests
FOR DELETE
USING (auth.uid() = created_by);

-- Admins podem deletar qualquer solicitação
CREATE POLICY "Admins can delete all internment requests"
ON public.internment_requests
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 6. Remover políticas RLS antigas de medical_codes
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar códigos" ON public.medical_codes;
DROP POLICY IF EXISTS "Usuários autenticados podem criar códigos" ON public.medical_codes;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar códigos" ON public.medical_codes;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar códigos" ON public.medical_codes;

-- 7. Criar novas políticas RLS para medical_codes
-- Todos os usuários autenticados podem ver códigos
CREATE POLICY "Authenticated users can view medical codes"
ON public.medical_codes
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Apenas admins podem criar, atualizar e deletar códigos médicos
CREATE POLICY "Only admins can create medical codes"
ON public.medical_codes
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update medical codes"
ON public.medical_codes
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete medical codes"
ON public.medical_codes
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));