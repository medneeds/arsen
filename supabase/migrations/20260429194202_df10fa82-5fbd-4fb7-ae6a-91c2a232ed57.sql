REVOKE EXECUTE ON FUNCTION public.is_global_profile(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_app_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_is_global(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_assign_department(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_global_profile(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_app_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_global(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_assign_department(uuid, uuid) TO authenticated;