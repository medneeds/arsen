DROP POLICY IF EXISTS "Admins view merge audit" ON public.patient_merge_audit;
CREATE POLICY "Dev and admins view merge audit"
ON public.patient_merge_audit
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'dev'::app_role));