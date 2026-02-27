-- Update internment_status constraint to match new status values
ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_internment_status_check;

ALTER TABLE public.patients ADD CONSTRAINT patients_internment_status_check 
CHECK (internment_status IN ('SOLICITACAO_PENDENTE', 'PSM_FAVORAVEL', 'AGUARDANDO_VAGA'));