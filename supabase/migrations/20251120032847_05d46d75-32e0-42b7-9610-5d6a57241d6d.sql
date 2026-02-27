-- Adicionar coluna department à tabela patients
ALTER TABLE public.patients 
ADD COLUMN department text NOT NULL DEFAULT 'URGÊNCIA E EMERGÊNCIA ADULTO';

-- Criar índice para melhorar performance de queries por departamento
CREATE INDEX idx_patients_department ON public.patients(department);

-- Adicionar constraint para validar departamentos permitidos
ALTER TABLE public.patients
ADD CONSTRAINT valid_department CHECK (
  department IN (
    'URGÊNCIA E EMERGÊNCIA ADULTO',
    'URGÊNCIA E EMERGÊNCIA PEDIÁTRICA',
    'UTI',
    'POSTO INTERNAÇÃO'
  )
);

-- Adicionar coluna department às outras tabelas relacionadas
ALTER TABLE public.shift_handovers
ADD COLUMN department text NOT NULL DEFAULT 'URGÊNCIA E EMERGÊNCIA ADULTO';

ALTER TABLE public.patient_versions
ADD COLUMN department text NOT NULL DEFAULT 'URGÊNCIA E EMERGÊNCIA ADULTO';

-- Criar índices
CREATE INDEX idx_shift_handovers_department ON public.shift_handovers(department);
CREATE INDEX idx_patient_versions_department ON public.patient_versions(department);