CREATE TABLE IF NOT EXISTS public.prescriptions_archive (
  id                    UUID PRIMARY KEY,
  patient_name          TEXT NOT NULL,
  patient_data          JSONB NOT NULL,
  items                 JSONB NOT NULL,
  digital_signature     JSONB,
  status                TEXT NOT NULL,
  version               INTEGER NOT NULL,
  parent_id             UUID,
  notes                 TEXT,
  department            TEXT NOT NULL,
  hospital_unit_id      UUID NOT NULL,
  state_id              UUID NOT NULL,
  created_by            UUID,
  encounter_id          UUID,
  patient_registry_id   UUID,
  original_created_at   TIMESTAMPTZ NOT NULL,
  original_updated_at   TIMESTAMPTZ NOT NULL,
  archived_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  archive_reason        TEXT NOT NULL DEFAULT 'orphan_draft_24h'
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_archive_registry
  ON public.prescriptions_archive (patient_registry_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_archive_archived_at
  ON public.prescriptions_archive (archived_at DESC);

ALTER TABLE public.prescriptions_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "archive_readable_by_admin_dev"
  ON public.prescriptions_archive
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'dev'::public.app_role)
  );

CREATE POLICY "archive_no_direct_writes"
  ON public.prescriptions_archive
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.archive_orphan_drafts()
RETURNS TABLE(archived_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinical_day_start TIMESTAMPTZ;
  v_count INTEGER := 0;
BEGIN
  v_clinical_day_start := (
    CASE
      WHEN EXTRACT(HOUR FROM (now() AT TIME ZONE 'America/Sao_Paulo')) < 5
      THEN (date_trunc('day', (now() AT TIME ZONE 'America/Sao_Paulo')) - INTERVAL '1 day' + INTERVAL '5 hours')
      ELSE (date_trunc('day', (now() AT TIME ZONE 'America/Sao_Paulo')) + INTERVAL '5 hours')
    END
  ) AT TIME ZONE 'America/Sao_Paulo';

  WITH orphan AS (
    SELECT p.*
    FROM public.prescriptions p
    WHERE p.status = 'draft'
      AND p.digital_signature IS NULL
      AND p.updated_at < (now() - INTERVAL '24 hours')
      AND p.updated_at < v_clinical_day_start
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p.items) AS it
        WHERE COALESCE((it->>'validated')::boolean, false) = true
      )
  ),
  moved AS (
    INSERT INTO public.prescriptions_archive (
      id, patient_name, patient_data, items, digital_signature, status, version,
      parent_id, notes, department, hospital_unit_id, state_id, created_by,
      encounter_id, patient_registry_id, original_created_at, original_updated_at,
      archive_reason
    )
    SELECT
      o.id, o.patient_name, o.patient_data, o.items, o.digital_signature, o.status, o.version,
      o.parent_id, o.notes, o.department, o.hospital_unit_id, o.state_id, o.created_by,
      o.encounter_id, o.patient_registry_id, o.created_at, o.updated_at,
      'orphan_draft_24h'
    FROM orphan o
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  ),
  deleted AS (
    DELETE FROM public.prescriptions
    WHERE id IN (SELECT id FROM moved)
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER INTO v_count FROM deleted;

  RETURN QUERY SELECT v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_orphan_drafts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_orphan_drafts() TO service_role;