-- Corrigir políticas RLS da tabela medical_codes
-- Apenas administradores devem poder criar, atualizar e deletar códigos médicos
-- Todos os usuários autenticados podem visualizar

-- Remover políticas antigas permissivas
DROP POLICY IF EXISTS "Authenticated users can view medical codes" ON public.medical_codes;
DROP POLICY IF EXISTS "Only admins can create medical codes" ON public.medical_codes;
DROP POLICY IF EXISTS "Only admins can update medical codes" ON public.medical_codes;
DROP POLICY IF EXISTS "Only admins can delete medical codes" ON public.medical_codes;

-- Criar novas políticas com restrições adequadas
CREATE POLICY "All authenticated users can view medical codes"
ON public.medical_codes
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins can create medical codes"
ON public.medical_codes
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update medical codes"
ON public.medical_codes
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete medical codes"
ON public.medical_codes
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));