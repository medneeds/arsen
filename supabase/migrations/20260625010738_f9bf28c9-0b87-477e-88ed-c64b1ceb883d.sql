REVOKE ALL ON FUNCTION public.stamp_admission_identity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stamp_admission_evolution_identity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stamp_admission_identity() TO service_role;
GRANT EXECUTE ON FUNCTION public.stamp_admission_evolution_identity() TO service_role;