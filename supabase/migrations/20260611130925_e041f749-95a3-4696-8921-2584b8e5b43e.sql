
-- 1) Receituarios: remove NULL hospital_unit_id branch (restrict to admin/dev/gestor + tenant)
DROP POLICY IF EXISTS tenant_select_receituarios ON public.receituarios;
CREATE POLICY tenant_select_receituarios ON public.receituarios FOR SELECT
USING (
  (hospital_unit_id IS NOT NULL AND can_access_hospital(hospital_unit_id))
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'dev'::app_role)
  OR is_gestor(auth.uid())
);

-- Also harden INSERT to require a hospital_unit_id the caller can access
DROP POLICY IF EXISTS tenant_insert_receituarios ON public.receituarios;
CREATE POLICY tenant_insert_receituarios ON public.receituarios FOR INSERT
WITH CHECK (
  auth.uid() = created_by
  AND hospital_unit_id IS NOT NULL
  AND can_access_hospital(hospital_unit_id)
);

-- 2) prescription_affinity_audit: restrict INSERT to caller + tenant
DROP POLICY IF EXISTS affinity_audit_insert_authenticated ON public.prescription_affinity_audit;
CREATE POLICY affinity_audit_insert_authenticated ON public.prescription_affinity_audit FOR INSERT
WITH CHECK (
  performed_by = auth.uid()
  AND (hospital_unit_id IS NULL OR can_access_hospital(hospital_unit_id))
);

-- 3) Function search_path mutable
ALTER FUNCTION public.touch_receituarios_updated_at() SET search_path = public;
