
-- Função SECURITY DEFINER para checar se um user é gestor (sem disparar RLS)
CREATE OR REPLACE FUNCTION public.is_gestor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND access_profile = 'gestor'
  );
$$;

-- Substitui a policy recursiva
DROP POLICY IF EXISTS "Profiles visible to self admins and gestores" ON public.profiles;

CREATE POLICY "Profiles visible to self admins and gestores"
ON public.profiles FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_gestor(auth.uid())
);
