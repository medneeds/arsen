-- Criar tabela para controle de acesso aos departamentos
CREATE TABLE public.user_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(user_id, department)
);

-- Habilitar RLS
ALTER TABLE public.user_departments ENABLE ROW LEVEL SECURITY;

-- Política: usuários podem ver seus próprios departamentos
CREATE POLICY "Usuários podem ver próprios departamentos"
ON public.user_departments
FOR SELECT
USING (auth.uid() = user_id);

-- Política: coordenador pode ver todos
CREATE POLICY "Coordenador pode ver todos departamentos"
ON public.user_departments
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Política: coordenador pode gerenciar
CREATE POLICY "Coordenador pode gerenciar departamentos"
ON public.user_departments
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Criar índice para performance
CREATE INDEX idx_user_departments_user_id ON public.user_departments(user_id);

-- Comentários
COMMENT ON TABLE public.user_departments IS 'Controla quais departamentos cada usuário pode acessar';
COMMENT ON COLUMN public.user_departments.department IS 'Nome do departamento: URGÊNCIA E EMERGÊNCIA ADULTO, URGÊNCIA E EMERGÊNCIA PEDIÁTRICA, UTI, POSTO INTERNAÇÃO';
