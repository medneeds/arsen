
CREATE OR REPLACE FUNCTION public.prevent_profile_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins (real role from user_roles) can change anything.
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- For everyone else, role-bearing fields are immutable on UPDATE.
  IF NEW.access_profile IS DISTINCT FROM OLD.access_profile THEN
    RAISE EXCEPTION 'Não é permitido alterar access_profile do próprio perfil';
  END IF;

  IF NEW.access_profiles IS DISTINCT FROM OLD.access_profiles THEN
    RAISE EXCEPTION 'Não é permitido alterar access_profiles do próprio perfil';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Não é permitido alterar status do próprio perfil';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_role_self_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_role_self_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_role_self_escalation();
