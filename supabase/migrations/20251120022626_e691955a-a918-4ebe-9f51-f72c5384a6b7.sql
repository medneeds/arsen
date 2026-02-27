-- Permitir que usuários atualizem suas próprias roles
-- NOTA: Em produção, isso deveria ser mais restritivo
DROP POLICY IF EXISTS "Admins podem gerenciar roles" ON public.user_roles;

CREATE POLICY "Usuários podem atualizar própria role" 
ON public.user_roles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Admins podem gerenciar todas as roles" 
ON public.user_roles 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));