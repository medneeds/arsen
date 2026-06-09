DROP POLICY IF EXISTS "Creators and admins can update prescriptions" ON public.prescriptions;

CREATE POLICY "prescriptions_update_authenticated"
  ON public.prescriptions FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);