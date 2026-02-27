-- Remover políticas públicas inseguras da tabela internment_requests
DROP POLICY IF EXISTS "Qualquer um pode visualizar solicitações de internação" ON public.internment_requests;
DROP POLICY IF EXISTS "Qualquer um pode criar solicitações de internação" ON public.internment_requests;
DROP POLICY IF EXISTS "Qualquer um pode atualizar solicitações de internação" ON public.internment_requests;
DROP POLICY IF EXISTS "Qualquer um pode deletar solicitações de internação" ON public.internment_requests;

-- Criar políticas seguras com autenticação obrigatória
-- Apenas usuários autenticados (médicos e admins) podem visualizar
CREATE POLICY "Usuários autenticados podem visualizar solicitações"
ON public.internment_requests
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Apenas usuários autenticados podem criar solicitações
CREATE POLICY "Usuários autenticados podem criar solicitações"
ON public.internment_requests
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Apenas usuários autenticados podem atualizar solicitações
CREATE POLICY "Usuários autenticados podem atualizar solicitações"
ON public.internment_requests
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Apenas usuários autenticados podem deletar solicitações
CREATE POLICY "Usuários autenticados podem deletar solicitações"
ON public.internment_requests
FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Remover políticas públicas inseguras da tabela medical_codes
DROP POLICY IF EXISTS "Qualquer um pode visualizar códigos médicos" ON public.medical_codes;
DROP POLICY IF EXISTS "Qualquer um pode criar códigos médicos" ON public.medical_codes;
DROP POLICY IF EXISTS "Qualquer um pode atualizar códigos médicos" ON public.medical_codes;
DROP POLICY IF EXISTS "Qualquer um pode deletar códigos médicos" ON public.medical_codes;

-- Criar políticas seguras para medical_codes com autenticação obrigatória
CREATE POLICY "Usuários autenticados podem visualizar códigos"
ON public.medical_codes
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem criar códigos"
ON public.medical_codes
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem atualizar códigos"
ON public.medical_codes
FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem deletar códigos"
ON public.medical_codes
FOR DELETE
USING (auth.uid() IS NOT NULL);