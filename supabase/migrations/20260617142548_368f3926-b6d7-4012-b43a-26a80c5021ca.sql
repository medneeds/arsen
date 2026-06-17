
-- =========================================================================
-- Security fixes 2026-06: hospital scoping + storage ownership + profile UPDATE
-- =========================================================================

-- (1) can_access_hospital: restrict coordenador & gestor to assigned units.
-- admin/dev remain global (platform operators).
CREATE OR REPLACE FUNCTION public.can_access_hospital(_unit uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dev')
    OR (_unit IS NOT NULL AND public.user_in_hospital(auth.uid(), _unit))
  );
$$;

-- (2) exam-results storage: scope by hospital via path {hospital_unit_id}/{userId}/{requestId}/...
-- Legacy paths {userId}/{requestId}/... remain accessible to uploader and admin (backwards compat).
DROP POLICY IF EXISTS "Exam results: owner or admin can view"   ON storage.objects;
DROP POLICY IF EXISTS "Exam results: user uploads to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Exam results: owner or admin can update" ON storage.objects;
DROP POLICY IF EXISTS "Exam results: owner or admin can delete" ON storage.objects;

CREATE POLICY "Exam results: hospital scoped read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'exam-results' AND (
      public.has_role(auth.uid(), 'admin')
      OR (
        (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
        AND public.can_access_hospital(((storage.foldername(name))[1])::uuid)
      )
      OR (auth.uid())::text = (storage.foldername(name))[1]  -- legacy uploader fallback
    )
  );

CREATE POLICY "Exam results: hospital scoped insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'exam-results'
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    AND public.can_access_hospital(((storage.foldername(name))[1])::uuid)
    AND (auth.uid())::text = (storage.foldername(name))[2]
  );

CREATE POLICY "Exam results: hospital scoped update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'exam-results' AND (
      public.has_role(auth.uid(), 'admin')
      OR (
        (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
        AND public.can_access_hospital(((storage.foldername(name))[1])::uuid)
        AND (auth.uid())::text = (storage.foldername(name))[2]
      )
      OR (auth.uid())::text = (storage.foldername(name))[1]  -- legacy uploader
    )
  );

CREATE POLICY "Exam results: hospital scoped delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'exam-results' AND (
      public.has_role(auth.uid(), 'admin')
      OR (
        (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
        AND public.can_access_hospital(((storage.foldername(name))[1])::uuid)
        AND (auth.uid())::text = (storage.foldername(name))[2]
      )
      OR (auth.uid())::text = (storage.foldername(name))[1]  -- legacy uploader
    )
  );

-- (3) profiles UPDATE: remove coordenador from broad UPDATE; only self or admin.
DROP POLICY IF EXISTS profiles_update_self_or_admin ON public.profiles;
CREATE POLICY profiles_update_self_or_admin
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

-- (4) receituarios.hospital_unit_id NOT NULL (no NULL rows exist).
ALTER TABLE public.receituarios
  ALTER COLUMN hospital_unit_id SET NOT NULL;
