-- Adicionar coluna department à tabela patient_movements para isolamento de dados
ALTER TABLE public.patient_movements
ADD COLUMN department text NOT NULL DEFAULT 'URGÊNCIA E EMERGÊNCIA ADULTO';

-- Criar índice para melhor performance nas queries filtradas por department
CREATE INDEX idx_patient_movements_department ON public.patient_movements(department);

-- Comentário explicativo
COMMENT ON COLUMN public.patient_movements.department IS 'Departamento hospitalar do paciente no momento da movimentação (isolamento de dados por setor)';
