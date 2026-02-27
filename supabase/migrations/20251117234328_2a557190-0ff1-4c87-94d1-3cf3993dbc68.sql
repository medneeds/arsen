-- Atualizar política de DELETE para permitir que médicos autenticados também possam deletar
DROP POLICY IF EXISTS "Admins podem deletar pacientes" ON patients;

CREATE POLICY "Usuários autenticados podem deletar pacientes" 
ON patients 
FOR DELETE 
USING (auth.uid() IS NOT NULL);