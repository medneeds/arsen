
-- =====================================================================
-- 1. system_maintenance_mode (singleton row, id=1)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.system_maintenance_mode (
  id              smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_active       boolean NOT NULL DEFAULT false,
  started_at      timestamptz,
  started_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason          text,
  expected_end_at timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.system_maintenance_mode TO authenticated, anon;
GRANT ALL ON public.system_maintenance_mode TO service_role;

ALTER TABLE public.system_maintenance_mode ENABLE ROW LEVEL SECURITY;

INSERT INTO public.system_maintenance_mode (id, is_active)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "anyone can read maintenance state" ON public.system_maintenance_mode;
CREATE POLICY "anyone can read maintenance state"
  ON public.system_maintenance_mode FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "only super_admin can toggle maintenance" ON public.system_maintenance_mode;
CREATE POLICY "only super_admin can toggle maintenance"
  ON public.system_maintenance_mode FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- =====================================================================
-- 2. db_backups
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.db_backups (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  kind          text NOT NULL CHECK (kind IN ('full','partial')),
  tables        text[] NOT NULL DEFAULT '{}',
  object_paths  text[] NOT NULL DEFAULT '{}',
  row_counts    jsonb NOT NULL DEFAULT '{}'::jsonb,
  size_bytes    bigint NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'running'
                  CHECK (status IN ('running','completed','failed','partial')),
  error         text,
  notes         text
);

CREATE INDEX IF NOT EXISTS idx_db_backups_created_at ON public.db_backups (created_at DESC);

GRANT SELECT ON public.db_backups TO authenticated;
GRANT ALL ON public.db_backups TO service_role;

ALTER TABLE public.db_backups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin can read db_backups" ON public.db_backups;
CREATE POLICY "super_admin can read db_backups"
  ON public.db_backups FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- =====================================================================
-- 3. db_restore_audit (immutable)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.db_restore_audit (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  backup_id       uuid REFERENCES public.db_backups(id) ON DELETE SET NULL,
  mode            text NOT NULL CHECK (mode IN ('full','partial')),
  tables          text[] NOT NULL DEFAULT '{}',
  rows_before     jsonb NOT NULL DEFAULT '{}'::jsonb,
  rows_after      jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  status          text NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running','completed','failed','partial')),
  error           text,
  reason          text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_db_restore_audit_started_at ON public.db_restore_audit (started_at DESC);

GRANT SELECT ON public.db_restore_audit TO authenticated;
GRANT ALL ON public.db_restore_audit TO service_role;

ALTER TABLE public.db_restore_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin can read db_restore_audit" ON public.db_restore_audit;
CREATE POLICY "super_admin can read db_restore_audit"
  ON public.db_restore_audit FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- =====================================================================
-- 4. Maintenance-mode write blocker
-- =====================================================================
CREATE OR REPLACE FUNCTION public.is_maintenance_mode_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_active FROM public.system_maintenance_mode WHERE id = 1), false)
$$;
REVOKE ALL ON FUNCTION public.is_maintenance_mode_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_maintenance_mode_active() TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.block_writes_during_maintenance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('service_role','postgres','supabase_admin','supabase_auth_admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF public.is_maintenance_mode_active() THEN
    RAISE EXCEPTION 'O sistema está em MODO MANUTENÇÃO. Escritas estão temporariamente bloqueadas. Tente novamente em alguns minutos.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE
  r record;
  excluded text[] := ARRAY[
    'system_maintenance_mode',
    'db_backups',
    'db_restore_audit',
    'audit_logs',
    'user_admin_audit'
  ];
BEGIN
  FOR r IN
    SELECT c.relname AS tname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname <> ALL(excluded)
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS zz_block_writes_maintenance ON public.%I;', r.tname
    );
    EXECUTE format(
      'CREATE TRIGGER zz_block_writes_maintenance
         BEFORE INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.block_writes_during_maintenance();',
      r.tname
    );
  END LOOP;
END$$;

-- =====================================================================
-- 5. promote_to_super_admin RPC
-- =====================================================================
CREATE OR REPLACE FUNCTION public.promote_to_super_admin(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  caller_email text;
  target_email text;
  target_name text;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;
  IF NOT public.has_role(caller, 'admin'::public.app_role)
     AND NOT public.has_role(caller, 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas admin ou super_admin pode promover a super_admin'
      USING ERRCODE = '42501';
  END IF;
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id é obrigatório';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'super_admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  SELECT email INTO caller_email FROM auth.users WHERE id = caller;
  SELECT email INTO target_email FROM auth.users WHERE id = target_user_id;
  SELECT full_name INTO target_name FROM public.profiles WHERE id = target_user_id;

  INSERT INTO public.user_admin_audit (
    actor_id, actor_email, target_user_id, target_email, target_name,
    action, app_role, new_data, metadata
  ) VALUES (
    caller, caller_email, target_user_id, target_email, target_name,
    'user.role.promoted_super_admin', 'super_admin',
    jsonb_build_object('role', 'super_admin'),
    jsonb_build_object('source', 'promote_to_super_admin_rpc')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.promote_to_super_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_to_super_admin(uuid) TO authenticated;

-- =====================================================================
-- 6. updated_at trigger on system_maintenance_mode
-- =====================================================================
CREATE OR REPLACE FUNCTION public._touch_maintenance_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_touch_maintenance ON public.system_maintenance_mode;
CREATE TRIGGER trg_touch_maintenance
  BEFORE UPDATE ON public.system_maintenance_mode
  FOR EACH ROW EXECUTE FUNCTION public._touch_maintenance_updated_at();
