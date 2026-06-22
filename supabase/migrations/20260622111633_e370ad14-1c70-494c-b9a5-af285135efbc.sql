-- Defense-in-depth: restrict storage.objects access in the db-backups bucket to admin/super_admin.
-- Edge functions use service_role and bypass RLS, so this only locks down direct client access.

DROP POLICY IF EXISTS "db_backups_admin_select" ON storage.objects;
DROP POLICY IF EXISTS "db_backups_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "db_backups_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "db_backups_admin_delete" ON storage.objects;

CREATE POLICY "db_backups_admin_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'db-backups'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
);

CREATE POLICY "db_backups_admin_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'db-backups'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
);

CREATE POLICY "db_backups_admin_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'db-backups'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
)
WITH CHECK (
  bucket_id = 'db-backups'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
);

CREATE POLICY "db_backups_admin_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'db-backups'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
);