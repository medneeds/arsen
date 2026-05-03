
-- 1) password_reset_requests: remover policy anônima
DROP POLICY IF EXISTS "Anyone can request password reset" ON public.password_reset_requests;

-- 2) audit_logs INSERT: exigir match com auth.uid()
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated insert own audit logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()));

-- 3) user_admin_audit INSERT: actor_id = auth.uid()
DROP POLICY IF EXISTS "Authenticated can insert user admin audit" ON public.user_admin_audit;
CREATE POLICY "Authenticated insert own user admin audit"
  ON public.user_admin_audit FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- 4) patient_merge_audit INSERT: performed_by = auth.uid()
DROP POLICY IF EXISTS "Authenticated insert merge audit" ON public.patient_merge_audit;
CREATE POLICY "Authenticated insert own merge audit"
  ON public.patient_merge_audit FOR INSERT TO authenticated
  WITH CHECK (performed_by = auth.uid());

-- 5) profiles: SELECT geral apenas self, admin e gestor
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Admins podem ver todos os perfis" ON public.profiles;
CREATE POLICY "Profiles visible to self admins and gestores"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.access_profile = 'gestor')
  );

-- 6) medical_codes: write restrito a admin
DROP POLICY IF EXISTS "Authenticated users can create medical codes" ON public.medical_codes;
DROP POLICY IF EXISTS "Authenticated users can update medical codes" ON public.medical_codes;
DROP POLICY IF EXISTS "Authenticated users can delete medical codes" ON public.medical_codes;
CREATE POLICY "Admins can create medical codes"
  ON public.medical_codes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update medical codes"
  ON public.medical_codes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete medical codes"
  ON public.medical_codes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 7) storage exam-results: ownership por pasta = auth.uid()
DROP POLICY IF EXISTS "Authenticated users can view exam results" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload exam results" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete exam results" ON storage.objects;

CREATE POLICY "Exam results: owner or admin can view"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'exam-results'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "Exam results: user uploads to own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'exam-results'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Exam results: owner or admin can update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'exam-results'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "Exam results: owner or admin can delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'exam-results'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );
