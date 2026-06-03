-- Correção: permite que admins, coordenadores e gestores aprovem/rejeitem
-- cadastros de outros usuários (status, approved_at, approved_by)

-- Remove qualquer policy de UPDATE conflitante na tabela profiles
DO $$
DECLARE pol text;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'profiles' AND cmd = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol);
  END LOOP;
END $$;

-- Policy unificada: usuário edita o próprio perfil OU admin/coordenador/gestor edita qualquer perfil
CREATE POLICY "profiles_update_unified"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'coordenador')
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.access_profile IN ('gestor', 'coord_medico', 'coord_enfermagem', 'coord_multi')
  )
)
WITH CHECK (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'coordenador')
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.access_profile IN ('gestor', 'coord_medico', 'coord_enfermagem', 'coord_multi')
  )
);
