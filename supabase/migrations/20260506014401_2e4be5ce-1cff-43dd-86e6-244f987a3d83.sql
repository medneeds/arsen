
-- 1) Helper: user belongs to a hospital unit (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.user_in_hospital(_user_id uuid, _hospital_unit_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_hospital_assignments
    WHERE user_id = _user_id
      AND hospital_unit_id = _hospital_unit_id
  );
$$;

-- ============================================================
-- 2) profiles: prevent self-elevation to gestor/admin via UPDATE
-- ============================================================
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON public.profiles;

CREATE POLICY "Users can update own profile (no privilege fields)"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  -- Privilege/admin fields cannot be changed by the user themselves.
  AND access_profile  IS NOT DISTINCT FROM (SELECT p.access_profile  FROM public.profiles p WHERE p.id = auth.uid())
  AND access_profiles IS NOT DISTINCT FROM (SELECT p.access_profiles FROM public.profiles p WHERE p.id = auth.uid())
  AND status          IS NOT DISTINCT FROM (SELECT p.status          FROM public.profiles p WHERE p.id = auth.uid())
  AND approved_at     IS NOT DISTINCT FROM (SELECT p.approved_at     FROM public.profiles p WHERE p.id = auth.uid())
  AND approved_by     IS NOT DISTINCT FROM (SELECT p.approved_by     FROM public.profiles p WHERE p.id = auth.uid())
);

-- ============================================================
-- 3) password_reset_requests: bind insert to auth.uid()
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can submit password reset request" ON public.password_reset_requests;

CREATE POLICY "Users can submit own password reset request"
ON public.password_reset_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 4) internment_requests: scope admin access by hospital_unit_id
-- ============================================================
DROP POLICY IF EXISTS "Admins can view all internment requests"   ON public.internment_requests;
DROP POLICY IF EXISTS "Admins can update all internment requests" ON public.internment_requests;
DROP POLICY IF EXISTS "Admins can delete all internment requests" ON public.internment_requests;

CREATE POLICY "Admins can view internment requests in their hospitals"
ON public.internment_requests
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND public.user_in_hospital(auth.uid(), hospital_unit_id)
);

CREATE POLICY "Admins can update internment requests in their hospitals"
ON public.internment_requests
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND public.user_in_hospital(auth.uid(), hospital_unit_id)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND public.user_in_hospital(auth.uid(), hospital_unit_id)
);

CREATE POLICY "Admins can delete internment requests in their hospitals"
ON public.internment_requests
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND public.user_in_hospital(auth.uid(), hospital_unit_id)
);
