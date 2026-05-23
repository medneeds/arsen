REVOKE ALL ON FUNCTION public.verify_own_password(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verify_own_password(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.verify_own_password(text) TO authenticated;