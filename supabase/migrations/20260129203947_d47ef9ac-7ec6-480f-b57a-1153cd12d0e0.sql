-- Corrigir política de retenção para ser mais restritiva
DROP POLICY IF EXISTS "Authenticated users can view retention policies" ON public.data_retention_policies;

-- Apenas admins e médicos podem visualizar políticas de retenção
CREATE POLICY "Authorized users can view retention policies"
ON public.data_retention_policies
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'medico')
);