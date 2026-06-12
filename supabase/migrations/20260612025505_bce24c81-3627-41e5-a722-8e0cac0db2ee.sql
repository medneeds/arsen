-- 1) pre_registration_requests: remove anon INSERT, mantém authenticated
DROP POLICY IF EXISTS "Anyone can submit pre-registration" ON public.pre_registration_requests;

CREATE POLICY "Authenticated can submit pre-registration"
ON public.pre_registration_requests
FOR INSERT
TO authenticated
WITH CHECK (status = 'pending');

-- 2) user_roles: blindagem explícita contra self-grant
-- Adiciona política RESTRICTIVE que bloqueia INSERT por não-admins
-- (combina via AND com as permissivas existentes do admin)
CREATE POLICY "no_self_role_grant"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Idem para UPDATE/DELETE como defesa em profundidade
CREATE POLICY "no_self_role_update"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "no_self_role_delete"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));