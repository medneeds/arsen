
-- 1) prescription_affinity_audit: restringe INSERT a authenticated
DROP POLICY IF EXISTS affinity_audit_insert_any ON public.prescription_affinity_audit;
CREATE POLICY affinity_audit_insert_authenticated
  ON public.prescription_affinity_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 2) locked_sector_cleanup_log: SELECT só admin/dev
DROP POLICY IF EXISTS auth_read_cleanup_log ON public.locked_sector_cleanup_log;
CREATE POLICY admin_dev_read_cleanup_log
  ON public.locked_sector_cleanup_log
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_developer_profile(auth.uid())
  );

-- 3) module_ip_allowlist: SELECT só admin
DROP POLICY IF EXISTS "Authenticated can read allowlist" ON public.module_ip_allowlist;
CREATE POLICY "Admins read allowlist"
  ON public.module_ip_allowlist
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
