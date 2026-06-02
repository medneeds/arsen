DROP POLICY IF EXISTS "Admins/gestores can view pre-registrations" ON public.pre_registration_requests;
DROP POLICY IF EXISTS "Admins/gestores can update pre-registrations" ON public.pre_registration_requests;

CREATE POLICY "Admins gestores coordenadores can view pre-registrations"
ON public.pre_registration_requests
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'coordenador')
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.access_profile = 'gestor'
  )
);

CREATE POLICY "Admins gestores coordenadores can update pre-registrations"
ON public.pre_registration_requests
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'coordenador')
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.access_profile = 'gestor'
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'coordenador')
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.access_profile = 'gestor'
  )
);