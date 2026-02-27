-- Temporariamente, permitir que todos os usuários autenticados gerenciem códigos médicos
-- (em um ambiente de produção real, isso deveria ser mais restritivo)

DROP POLICY IF EXISTS "Only admins can create medical codes" ON public.medical_codes;
DROP POLICY IF EXISTS "Only admins can update medical codes" ON public.medical_codes;
DROP POLICY IF EXISTS "Only admins can delete medical codes" ON public.medical_codes;

CREATE POLICY "Authenticated users can create medical codes" 
ON public.medical_codes 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update medical codes" 
ON public.medical_codes 
FOR UPDATE 
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete medical codes" 
ON public.medical_codes 
FOR DELETE 
TO authenticated
USING (auth.uid() IS NOT NULL);