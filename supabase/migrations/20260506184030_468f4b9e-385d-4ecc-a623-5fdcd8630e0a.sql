-- 1. Add 'coordenador' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coordenador';

-- 2. Helper: is the user a coordinator (by access_profile)?
CREATE OR REPLACE FUNCTION public.is_coordenador(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND access_profile IN ('coord_medico', 'coord_enfermagem', 'coord_multi')
  );
$$;

-- 3. Update is_global_profile to also treat coordinators as "no-department" profiles
--    (their scope is hospital-wide, expanded at runtime)
CREATE OR REPLACE FUNCTION public.is_global_profile(_access_profile text, _app_role text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(_access_profile, '') IN ('gestor', 'coord_medico', 'coord_enfermagem', 'coord_multi')
      OR COALESCE(_app_role, '')       = 'admin';
$$;

-- 4. Update validation trigger error message to be friendlier for coordinators
CREATE OR REPLACE FUNCTION public.validate_user_department_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF public.user_is_global(NEW.user_id) THEN
    RAISE EXCEPTION 'Perfis globais (admin, gestor, coordenador) não podem ter setores individuais — o acesso é por unidade hospitalar inteira.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_caller IS NOT NULL THEN
    IF NOT public.can_assign_department(v_caller, NEW.user_id) THEN
      RAISE EXCEPTION 'Você não tem permissão para atribuir setores a este usuário (fora do seu escopo).'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 5. When a user becomes a coordinator, clear any individual department rows
CREATE OR REPLACE FUNCTION public.sync_coordenador_clears_departments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.access_profile IN ('coord_medico','coord_enfermagem','coord_multi')
     AND COALESCE(OLD.access_profile, '') NOT IN ('coord_medico','coord_enfermagem','coord_multi') THEN
    DELETE FROM public.user_departments WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_coordenador_clears_departments_trg ON public.profiles;
CREATE TRIGGER sync_coordenador_clears_departments_trg
AFTER UPDATE OF access_profile ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_coordenador_clears_departments();
