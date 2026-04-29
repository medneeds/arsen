-- ============================================================
-- Validações de atribuição de setores (perfis globais e escopo do gestor)
-- ============================================================

-- 1) Helper: verifica se um perfil/role é "global" (ignora setores).
CREATE OR REPLACE FUNCTION public.is_global_profile(_access_profile text, _app_role text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(_access_profile, '') = 'gestor'
      OR COALESCE(_app_role, '')       = 'admin';
$$;

-- 2) Helper: retorna o app_role efetivo de um usuário (pega o primeiro registro
--    em user_roles; um usuário não deveria ter múltiplos roles).
CREATE OR REPLACE FUNCTION public.get_user_app_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
$$;

-- 3) Helper: verifica se um usuário é "global" hoje (admin ou gestor).
CREATE OR REPLACE FUNCTION public.user_is_global(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_global_profile(
    (SELECT access_profile FROM public.profiles WHERE id = _user_id),
    public.get_user_app_role(_user_id)
  );
$$;

-- 4) Helper: verifica se um caller (admin ou gestor) pode atribuir um
--    determinado setor para um determinado target.
--    Regra:
--      - admin: sempre pode.
--      - gestor: só pode se o target estiver dentro das mesmas unidades
--        hospitalares já atribuídas ao gestor.
--      - demais: bloqueado.
CREATE OR REPLACE FUNCTION public.can_assign_department(
  _caller uuid,
  _target uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_profile text;
  v_caller_is_admin boolean;
BEGIN
  SELECT public.has_role(_caller, 'admin'::app_role) INTO v_caller_is_admin;
  IF v_caller_is_admin THEN
    RETURN true;
  END IF;

  SELECT access_profile INTO v_caller_profile FROM public.profiles WHERE id = _caller;
  IF v_caller_profile <> 'gestor' THEN
    RETURN false;
  END IF;

  -- Gestor: target precisa compartilhar pelo menos uma unidade hospitalar
  RETURN EXISTS (
    SELECT 1
    FROM public.user_hospital_assignments c
    JOIN public.user_hospital_assignments t
      ON t.hospital_unit_id = c.hospital_unit_id
    WHERE c.user_id = _caller
      AND t.user_id = _target
  );
END;
$$;

-- 5) Trigger em user_departments:
--    a) bloqueia inserção se o usuário-alvo for "global" (perfis globais
--       ignoram setores automaticamente);
--    b) bloqueia inserção se o caller for gestor e o alvo estiver fora de
--       suas unidades. Admin via service-role (auth.uid() IS NULL) é ignorado.
CREATE OR REPLACE FUNCTION public.validate_user_department_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  -- (a) perfil global ignora setores
  IF public.user_is_global(NEW.user_id) THEN
    RAISE EXCEPTION 'Perfis globais (admin/gestor) não podem ter setores atribuídos.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- (b) escopo do caller (apenas quando há sessão de usuário; service-role bypass)
  IF v_caller IS NOT NULL THEN
    IF NOT public.can_assign_department(v_caller, NEW.user_id) THEN
      RAISE EXCEPTION 'Você não tem permissão para atribuir setores a este usuário (fora do seu escopo).'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_user_department_assignment ON public.user_departments;
CREATE TRIGGER trg_validate_user_department_assignment
BEFORE INSERT OR UPDATE ON public.user_departments
FOR EACH ROW EXECUTE FUNCTION public.validate_user_department_assignment();

-- 6) Trigger em profiles: ao mudar access_profile para "gestor", remove
--    setores existentes automaticamente (consistência com regra "global ignora setores").
CREATE OR REPLACE FUNCTION public.sync_global_profile_clears_departments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.access_profile = 'gestor'
     AND COALESCE(OLD.access_profile, '') <> 'gestor' THEN
    DELETE FROM public.user_departments WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_global_profile_clears_departments ON public.profiles;
CREATE TRIGGER trg_sync_global_profile_clears_departments
AFTER UPDATE OF access_profile ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_global_profile_clears_departments();

-- 7) Trigger em user_roles: ao virar admin, limpa setores também.
CREATE OR REPLACE FUNCTION public.sync_admin_role_clears_departments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role::text = 'admin' THEN
    DELETE FROM public.user_departments WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_admin_role_clears_departments ON public.user_roles;
CREATE TRIGGER trg_sync_admin_role_clears_departments
AFTER INSERT OR UPDATE OF role ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.sync_admin_role_clears_departments();
