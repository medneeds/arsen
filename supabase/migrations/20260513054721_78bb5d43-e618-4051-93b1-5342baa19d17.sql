ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS saps_pending boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS saps_pending_since timestamptz,
  ADD COLUMN IF NOT EXISTS saps_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS saps_acknowledged_by uuid,
  ADD COLUMN IF NOT EXISTS saps_acknowledged_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_patients_saps_pending ON public.patients(saps_pending) WHERE saps_pending = true;