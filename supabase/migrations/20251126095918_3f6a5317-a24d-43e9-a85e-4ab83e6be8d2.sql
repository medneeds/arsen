-- Adicionar coluna 'read' à tabela notes_reminders
ALTER TABLE public.notes_reminders
ADD COLUMN read boolean DEFAULT false;