DROP POLICY IF EXISTS "Authenticated can submit pre-registration" ON public.pre_registration_requests;

CREATE POLICY "Anyone can submit pre-registration"
ON public.pre_registration_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (status = 'pending');