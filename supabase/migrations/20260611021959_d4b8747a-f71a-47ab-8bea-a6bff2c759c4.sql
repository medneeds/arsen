-- 1) patient_registry_edit_history — scope SELECT to hospital access
DROP POLICY IF EXISTS "Authenticated can read preh" ON public.patient_registry_edit_history;

CREATE POLICY "Read preh scoped to hospital"
ON public.patient_registry_edit_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.patient_registry pr
    WHERE pr.id = patient_registry_edit_history.patient_registry_id
      AND public.can_access_hospital(pr.hospital_unit_id)
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- 2) dispensations — scope by hospital_unit_id
DROP POLICY IF EXISTS "Authenticated users can view dispensations" ON public.dispensations;
DROP POLICY IF EXISTS "Authenticated users can create dispensations" ON public.dispensations;
DROP POLICY IF EXISTS "Authenticated users can update dispensations" ON public.dispensations;

CREATE POLICY "View dispensations in own hospital"
ON public.dispensations
FOR SELECT
TO authenticated
USING (
  public.can_access_hospital(hospital_unit_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Create dispensations in own hospital"
ON public.dispensations
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (public.can_access_hospital(hospital_unit_id) OR public.has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Update dispensations in own hospital"
ON public.dispensations
FOR UPDATE
TO authenticated
USING (
  public.can_access_hospital(hospital_unit_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);