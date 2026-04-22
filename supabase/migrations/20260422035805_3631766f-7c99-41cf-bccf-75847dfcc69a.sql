-- 1) Ampliar constraint de department para incluir setores específicos
ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS valid_department;
ALTER TABLE public.patients ADD CONSTRAINT valid_department CHECK (
  department = ANY (ARRAY[
    'URGÊNCIA E EMERGÊNCIA ADULTO',
    'URGÊNCIA E EMERGÊNCIA PEDIÁTRICA',
    'UTI',
    'UTI 1',
    'UTI 2',
    'UCI 1',
    'UCI 2',
    'UE VERTICAL',
    'UE HORIZONTAL',
    'SALA VERMELHA',
    'SALA LARANJA',
    'OBSERVAÇÃO CLÍNICA',
    'INTERNAÇÃO UE',
    'POSTO INTERNAÇÃO',
    'UCC',
    'NEURO 01',
    'NEURO 02',
    'CLÍNICA CIRÚRGICA',
    'ENFERMARIA DE TRANSIÇÃO',
    'ENFERMARIA VASCULAR',
    'RIV',
    'CC PREPARO',
    'CC BLOCO CIRÚRGICO',
    'CC RPA',
    'CENTRO CIRÚRGICO',
    'OUTROS'
  ])
);

-- 2) Corrigir department dos leitos vagos para coincidir com o setor selecionado no SectorSelector
UPDATE public.patients SET department = 'UTI 1' WHERE is_vacant = true AND sector = 'red';
UPDATE public.patients SET department = 'UTI 2' WHERE is_vacant = true AND sector = 'yellow';
UPDATE public.patients SET department = 'UCI 1' WHERE is_vacant = true AND sector = 'blue';
UPDATE public.patients SET department = 'UCI 2' WHERE is_vacant = true AND sector = 'outside';

UPDATE public.patients SET department = 'SALA VERMELHA' WHERE is_vacant = true AND sector = 'sala_vermelha';
UPDATE public.patients SET department = 'SALA LARANJA' WHERE is_vacant = true AND sector = 'sala_laranja';
UPDATE public.patients SET department = 'OBSERVAÇÃO CLÍNICA' WHERE is_vacant = true AND sector = 'observacao_clinica';
UPDATE public.patients SET department = 'UE VERTICAL' WHERE is_vacant = true AND sector = 'ue_vertical';
UPDATE public.patients SET department = 'UE HORIZONTAL' WHERE is_vacant = true AND sector = 'ue_horizontal';