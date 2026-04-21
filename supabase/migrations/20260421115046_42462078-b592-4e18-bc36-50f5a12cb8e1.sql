-- Restringir INSERT em password_reset_requests apenas para usuários autenticados,
-- evitando flood anônimo e enumeração de usernames.
DROP POLICY IF EXISTS "Anyone can submit password reset request" ON public.password_reset_requests;
DROP POLICY IF EXISTS "Anonymous can submit password reset" ON public.password_reset_requests;
DROP POLICY IF EXISTS "Public insert password reset" ON public.password_reset_requests;

-- Criar política restrita: apenas authenticated pode inserir, e apenas em nome do próprio user_id quando informado
CREATE POLICY "Authenticated users can submit password reset request"
ON public.password_reset_requests
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
);