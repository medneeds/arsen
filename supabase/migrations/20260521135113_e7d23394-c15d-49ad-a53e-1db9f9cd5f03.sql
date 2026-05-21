
-- Remove UNIQUE(patient_id) — it incorrectly assumed one admission per bed row forever.
-- A bed (patients row) can be reused by multiple registries over time, so we key uniqueness
-- by (patient_id, patient_registry_id) instead.

ALTER TABLE public.admission_histories
  DROP CONSTRAINT IF EXISTS admission_histories_patient_id_key;

-- Backfill patient_registry_id from patients when possible (legacy rows often missing it).
UPDATE public.admission_histories ah
SET patient_registry_id = p.patient_registry_id
FROM public.patients p
WHERE ah.patient_id = p.id
  AND ah.patient_registry_id IS NULL
  AND p.patient_registry_id IS NOT NULL;

-- Partial unique index: one admission per (bed row, registry). NULL registry rows
-- (legacy/previous occupant) won't block new occupants.
CREATE UNIQUE INDEX IF NOT EXISTS admission_histories_patient_registry_unique
  ON public.admission_histories(patient_id, patient_registry_id)
  WHERE patient_registry_id IS NOT NULL;
