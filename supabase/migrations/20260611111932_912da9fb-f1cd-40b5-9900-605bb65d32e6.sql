
-- 1) internment_requests: enforce hospital-scoped access on INSERT/UPDATE/SELECT/DELETE
DROP POLICY IF EXISTS "Users can create own internment requests" ON public.internment_requests;
DROP POLICY IF EXISTS "Users can view own internment requests" ON public.internment_requests;
DROP POLICY IF EXISTS "Users can update own internment requests" ON public.internment_requests;
DROP POLICY IF EXISTS "Users can delete own internment requests" ON public.internment_requests;

CREATE POLICY "tenant_insert_internment_requests"
ON public.internment_requests
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND public.can_access_hospital(hospital_unit_id)
);

CREATE POLICY "tenant_select_internment_requests"
ON public.internment_requests
FOR SELECT TO authenticated
USING (public.can_access_hospital(hospital_unit_id));

CREATE POLICY "tenant_update_own_internment_requests"
ON public.internment_requests
FOR UPDATE TO authenticated
USING (auth.uid() = created_by AND public.can_access_hospital(hospital_unit_id))
WITH CHECK (auth.uid() = created_by AND public.can_access_hospital(hospital_unit_id));

CREATE POLICY "tenant_delete_own_internment_requests"
ON public.internment_requests
FOR DELETE TO authenticated
USING (auth.uid() = created_by AND public.can_access_hospital(hospital_unit_id));

-- 2) conduct_history: explicit UPDATE-denied policy to document intent
DROP POLICY IF EXISTS "tenant_no_update_conduct_history" ON public.conduct_history;
CREATE POLICY "tenant_no_update_conduct_history"
ON public.conduct_history
FOR UPDATE TO authenticated
USING (false)
WITH CHECK (false);

-- 3) patient_admission_date_history: denormalize hospital_unit_id and enforce directly
ALTER TABLE public.patient_admission_date_history
  ADD COLUMN IF NOT EXISTS hospital_unit_id uuid;

UPDATE public.patient_admission_date_history h
SET hospital_unit_id = p.hospital_unit_id
FROM public.patients p
WHERE h.patient_id = p.id
  AND h.hospital_unit_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_padh_hospital_unit_id
  ON public.patient_admission_date_history(hospital_unit_id);

CREATE OR REPLACE FUNCTION public.set_padh_hospital_unit_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.hospital_unit_id IS NULL AND NEW.patient_id IS NOT NULL THEN
    SELECT hospital_unit_id INTO NEW.hospital_unit_id
    FROM public.patients WHERE id = NEW.patient_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_padh_set_hospital_unit_id ON public.patient_admission_date_history;
CREATE TRIGGER trg_padh_set_hospital_unit_id
BEFORE INSERT ON public.patient_admission_date_history
FOR EACH ROW EXECUTE FUNCTION public.set_padh_hospital_unit_id();

DROP POLICY IF EXISTS "tenant_select_padh" ON public.patient_admission_date_history;
DROP POLICY IF EXISTS "tenant_insert_padh" ON public.patient_admission_date_history;

CREATE POLICY "tenant_select_padh"
ON public.patient_admission_date_history
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'coordenador'::app_role)
  OR has_role(auth.uid(), 'dev'::app_role)
  OR is_gestor(auth.uid())
  OR (hospital_unit_id IS NOT NULL AND public.can_access_hospital(hospital_unit_id))
  OR EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = patient_admission_date_history.patient_id
      AND public.can_access_hospital(p.hospital_unit_id)
  )
);

CREATE POLICY "tenant_insert_padh"
ON public.patient_admission_date_history
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'coordenador'::app_role)
  OR has_role(auth.uid(), 'dev'::app_role)
  OR is_gestor(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = patient_admission_date_history.patient_id
      AND public.can_access_hospital(p.hospital_unit_id)
  )
);

-- 4) realtime.messages: drop unused shared topics that lacked hospital scoping
DROP POLICY IF EXISTS "Restricted realtime topic read" ON realtime.messages;
DROP POLICY IF EXISTS "Restricted realtime topic write" ON realtime.messages;

CREATE POLICY "Restricted realtime topic read"
ON realtime.messages
FOR SELECT TO authenticated
USING (
  realtime.topic() = ANY (ARRAY['online-users'::text, 'online-users-monitor'::text])
  OR realtime.topic() = ('user:'::text || (auth.uid())::text)
);

CREATE POLICY "Restricted realtime topic write"
ON realtime.messages
FOR INSERT TO authenticated
WITH CHECK (
  realtime.topic() = ANY (ARRAY['online-users'::text, 'online-users-monitor'::text])
  OR realtime.topic() = ('user:'::text || (auth.uid())::text)
);
