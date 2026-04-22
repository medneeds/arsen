-- 1) Ampliar constraint de sector
ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_sector_check;
ALTER TABLE public.patients ADD CONSTRAINT patients_sector_check CHECK (
  sector = ANY (ARRAY[
    'red','yellow','blue','outside',
    'UTI 1','UTI 2','UCI 1','UCI 2',
    'ucc',
    'neuro_01','neuro_02','clinica_cirurgica','enfermaria_transicao','enfermaria_vascular',
    'sala_vermelha','sala_laranja','observacao_clinica','internacao_ue',
    'ue_vertical','ue_horizontal',
    'riv',
    'cc_preparo','cc_bloco','cc_rpa'
  ])
);

-- 2) Ampliar constraint de department
ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS valid_department;
ALTER TABLE public.patients ADD CONSTRAINT valid_department CHECK (
  department = ANY (ARRAY[
    'URGÊNCIA E EMERGÊNCIA ADULTO',
    'URGÊNCIA E EMERGÊNCIA PEDIÁTRICA',
    'UTI',
    'POSTO INTERNAÇÃO',
    'UCC',
    'NEURO 01',
    'NEURO 02',
    'CLÍNICA CIRÚRGICA',
    'ENFERMARIA DE TRANSIÇÃO',
    'ENFERMARIA VASCULAR',
    'RIV',
    'CENTRO CIRÚRGICO',
    'OUTROS'
  ])
);

-- 3) Popular leitos vagos a partir de bed_census
INSERT INTO public.patients (
  hospital_unit_id, state_id, department, sector, bed_number,
  name, age, is_vacant, diagnoses, medical_history, relevant_exams,
  pendencies, schedule, admission_history
)
SELECT 
  bc.hospital_unit_id,
  bc.state_id,
  CASE bc.sector
    WHEN 'red' THEN 'UTI'
    WHEN 'yellow' THEN 'UTI'
    WHEN 'blue' THEN 'UTI'
    WHEN 'outside' THEN 'UTI'
    WHEN 'ucc' THEN 'UCC'
    WHEN 'neuro_01' THEN 'NEURO 01'
    WHEN 'neuro_02' THEN 'NEURO 02'
    WHEN 'clinica_cirurgica' THEN 'CLÍNICA CIRÚRGICA'
    WHEN 'enfermaria_transicao' THEN 'ENFERMARIA DE TRANSIÇÃO'
    WHEN 'enfermaria_vascular' THEN 'ENFERMARIA VASCULAR'
    WHEN 'sala_vermelha' THEN 'URGÊNCIA E EMERGÊNCIA ADULTO'
    WHEN 'sala_laranja' THEN 'URGÊNCIA E EMERGÊNCIA ADULTO'
    WHEN 'observacao_clinica' THEN 'URGÊNCIA E EMERGÊNCIA ADULTO'
    WHEN 'ue_vertical' THEN 'URGÊNCIA E EMERGÊNCIA ADULTO'
    WHEN 'ue_horizontal' THEN 'URGÊNCIA E EMERGÊNCIA ADULTO'
    WHEN 'riv' THEN 'RIV'
    ELSE 'OUTROS'
  END AS department,
  bc.sector,
  bc.bed_number,
  '', '', true, '', '', '', '', '', ''
FROM public.bed_census bc
WHERE NOT EXISTS (
  SELECT 1 FROM public.patients p
  WHERE p.hospital_unit_id = bc.hospital_unit_id
    AND p.sector = bc.sector
    AND p.bed_number = bc.bed_number
);