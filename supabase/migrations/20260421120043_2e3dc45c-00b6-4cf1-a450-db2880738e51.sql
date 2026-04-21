-- Helper function para checar se o usuário é dev (ou admin)
CREATE OR REPLACE FUNCTION public.is_dev_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('dev'::app_role, 'admin'::app_role)
  )
$$;