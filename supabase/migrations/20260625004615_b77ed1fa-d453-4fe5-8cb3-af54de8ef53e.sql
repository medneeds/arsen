
UPDATE public.admission_histories ah
SET archived_at = now(),
    archive_reason = 'cleanup_orphan_legacy_registry_mismatch',
    archived_from_patient_id = ah.patient_id
FROM public.patients p
WHERE ah.archived_at IS NULL
  AND ah.patient_registry_id IS NOT NULL
  AND p.id = ah.patient_id
  AND p.patient_registry_id IS NOT NULL
  AND p.patient_registry_id <> ah.patient_registry_id;
