
-- 1. Remove privilege escalation: users updating their own role
DROP POLICY IF EXISTS "Usuários podem atualizar própria role" ON public.user_roles;

-- 2. Tighten notes_reminders: only owner can read/update/delete
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar suas anotações" ON public.notes_reminders;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar suas anotações" ON public.notes_reminders;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar suas anotações" ON public.notes_reminders;
DROP POLICY IF EXISTS "Usuários autenticados podem criar anotações" ON public.notes_reminders;

CREATE POLICY "Owners can view their notes"
ON public.notes_reminders FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR auth.uid() = created_by);

CREATE POLICY "Owners can update their notes"
ON public.notes_reminders FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR auth.uid() = created_by)
WITH CHECK (auth.uid() = user_id OR auth.uid() = created_by);

CREATE POLICY "Owners can delete their notes"
ON public.notes_reminders FOR DELETE
TO authenticated
USING (auth.uid() = user_id OR auth.uid() = created_by);

CREATE POLICY "Authenticated users can create their notes"
ON public.notes_reminders FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()) AND (created_by IS NULL OR created_by = auth.uid()));

-- 3. Make exam-results bucket private and remove public anon access
UPDATE storage.buckets SET public = false WHERE id = 'exam-results';

DROP POLICY IF EXISTS "Public can view exam results" ON storage.objects;
