-- ============================================================
-- Backup & Restore Module — Sprint 1: Foundation
-- ============================================================

-- ─── backup_jobs ─────────────────────────────────────────────
CREATE TABLE public.backup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_by_email text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','completed','failed','cancelled')),
  progress jsonb NOT NULL DEFAULT '{"step":"pending","percent":0,"current":null,"total":null}'::jsonb,
  storage_path text,
  file_size_bytes bigint,
  manifest jsonb,
  checksum_sha256 text,
  table_counts jsonb,
  auth_user_count integer,
  source_instance text,
  reason text,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.backup_jobs TO authenticated;
GRANT ALL ON public.backup_jobs TO service_role;

ALTER TABLE public.backup_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view backup jobs"
  ON public.backup_jobs FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE INDEX idx_backup_jobs_created_at ON public.backup_jobs (created_at DESC);
CREATE INDEX idx_backup_jobs_status ON public.backup_jobs (status);

-- ─── restore_jobs ────────────────────────────────────────────
CREATE TABLE public.restore_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_by_email text,
  backup_job_id uuid REFERENCES public.backup_jobs(id) ON DELETE SET NULL,
  uploaded_file_path text,
  dry_run boolean NOT NULL DEFAULT true,
  conflict_strategy text NOT NULL DEFAULT 'ignore'
    CHECK (conflict_strategy IN ('ignore','replace','merge','create_new')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','validating','dry_run','awaiting_confirm','running','completed','failed','cancelled')),
  progress jsonb NOT NULL DEFAULT '{"step":"pending","percent":0}'::jsonb,
  report jsonb,
  conflicts jsonb,
  target_instance text,
  reason text,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.restore_jobs TO authenticated;
GRANT ALL ON public.restore_jobs TO service_role;

ALTER TABLE public.restore_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view restore jobs"
  ON public.restore_jobs FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE INDEX idx_restore_jobs_created_at ON public.restore_jobs (created_at DESC);
CREATE INDEX idx_restore_jobs_status ON public.restore_jobs (status);

-- ─── backup_audit ────────────────────────────────────────────
CREATE TABLE public.backup_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  actor_name text,
  action text NOT NULL,
  backup_job_id uuid,
  restore_job_id uuid,
  source_instance text,
  target_instance text,
  result text,
  duration_ms integer,
  error text,
  payload jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.backup_audit TO authenticated;
GRANT ALL ON public.backup_audit TO service_role;

ALTER TABLE public.backup_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read backup audit"
  ON public.backup_audit FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Authenticated can insert backup audit"
  ON public.backup_audit FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- No UPDATE / DELETE policies → table is append-only (immutable trail).

CREATE INDEX idx_backup_audit_created_at ON public.backup_audit (created_at DESC);
CREATE INDEX idx_backup_audit_actor ON public.backup_audit (actor_id);
CREATE INDEX idx_backup_audit_action ON public.backup_audit (action);
CREATE INDEX idx_backup_audit_backup_job ON public.backup_audit (backup_job_id);
CREATE INDEX idx_backup_audit_restore_job ON public.backup_audit (restore_job_id);

-- ─── updated_at triggers ─────────────────────────────────────
CREATE TRIGGER trg_backup_jobs_updated_at
  BEFORE UPDATE ON public.backup_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_restore_jobs_updated_at
  BEFORE UPDATE ON public.restore_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();