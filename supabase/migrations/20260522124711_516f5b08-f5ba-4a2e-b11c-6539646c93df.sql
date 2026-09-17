REVOKE EXECUTE ON FUNCTION public.ensure_active_encounter_for_patient_row() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.autofill_encounter_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.autofill_patient_registry_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_active_encounter_for_patient(uuid) FROM PUBLIC, anon, authenticated;