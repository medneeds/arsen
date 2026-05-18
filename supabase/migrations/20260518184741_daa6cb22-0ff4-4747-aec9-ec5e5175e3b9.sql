-- Auditoria de arquivamento/repoint reversível em registros clínicos vinculados a slot
ALTER TABLE public.clinical_evolutions
  ADD COLUMN IF NOT EXISTS archived_from_patient_id uuid,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archive_reason text,
  ADD COLUMN IF NOT EXISTS repointed_from_patient_id uuid,
  ADD COLUMN IF NOT EXISTS repointed_at timestamptz,
  ADD COLUMN IF NOT EXISTS repoint_reason text;

ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS archived_from_patient_id uuid,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archive_reason text,
  ADD COLUMN IF NOT EXISTS repointed_from_patient_id uuid,
  ADD COLUMN IF NOT EXISTS repointed_at timestamptz,
  ADD COLUMN IF NOT EXISTS repoint_reason text;

ALTER TABLE public.exam_requests
  ADD COLUMN IF NOT EXISTS archived_from_patient_id uuid,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archive_reason text,
  ADD COLUMN IF NOT EXISTS repointed_from_patient_id uuid,
  ADD COLUMN IF NOT EXISTS repointed_at timestamptz,
  ADD COLUMN IF NOT EXISTS repoint_reason text;

ALTER TABLE public.culture_results
  ADD COLUMN IF NOT EXISTS archived_from_patient_id uuid,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archive_reason text,
  ADD COLUMN IF NOT EXISTS repointed_from_patient_id uuid,
  ADD COLUMN IF NOT EXISTS repointed_at timestamptz,
  ADD COLUMN IF NOT EXISTS repoint_reason text;

-- Índices para reversão rápida
CREATE INDEX IF NOT EXISTS idx_clinical_evolutions_archived ON public.clinical_evolutions(archived_from_patient_id) WHERE archived_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prescriptions_archived ON public.prescriptions(archived_from_patient_id) WHERE archived_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_exam_requests_archived ON public.exam_requests(archived_from_patient_id) WHERE archived_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_culture_results_archived ON public.culture_results(archived_from_patient_id) WHERE archived_at IS NOT NULL;