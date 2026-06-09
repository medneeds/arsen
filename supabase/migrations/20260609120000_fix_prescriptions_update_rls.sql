-- Fix: política UPDATE de prescriptions muito restritiva.
-- Problema: só criador original ou admin podiam atualizar.
-- Isso bloqueava qualquer médico diferente do criador de imprimir
-- (a impressão chama persistItems → UPDATE antes de abrir o print dialog).
-- Também bloqueava quando created_by IS NULL (auth.uid() = NULL → NULL, não TRUE).
--
-- Solução: qualquer usuário autenticado pode atualizar prescrições.
-- Mantém DELETE restrito a admin.

DROP POLICY IF EXISTS "Creators and admins can update prescriptions" ON public.prescriptions;

CREATE POLICY "prescriptions_update_authenticated"
  ON public.prescriptions FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
