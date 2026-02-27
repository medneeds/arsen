-- Criar tabela para anotações e lembretes com sistema de notificações
CREATE TABLE IF NOT EXISTS public.notes_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  department TEXT NOT NULL DEFAULT 'URGÊNCIA E EMERGÊNCIA ADULTO',
  content TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('free_text', 'checklist_item')),
  completed BOOLEAN DEFAULT false,
  scheduled_popup_time TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Habilitar RLS
ALTER TABLE public.notes_reminders ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Usuários autenticados podem visualizar suas anotações"
ON public.notes_reminders FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem criar anotações"
ON public.notes_reminders FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem atualizar suas anotações"
ON public.notes_reminders FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem deletar suas anotações"
ON public.notes_reminders FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_notes_reminders_updated_at
BEFORE UPDATE ON public.notes_reminders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_notes_reminders_user_department ON public.notes_reminders(user_id, department);
CREATE INDEX idx_notes_reminders_scheduled_popup ON public.notes_reminders(scheduled_popup_time) WHERE scheduled_popup_time IS NOT NULL AND is_active = true;