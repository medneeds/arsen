-- Add internment_status column to patients table
ALTER TABLE public.patients 
ADD COLUMN internment_status TEXT DEFAULT NULL 
CHECK (internment_status IS NULL OR internment_status IN ('SOLICITACAO_PENDENTE', 'PSM_FAVORAVEL', 'AGUARDANDO_VAGA'));

-- Add internment_notes column for additional observations
ALTER TABLE public.patients 
ADD COLUMN internment_notes TEXT DEFAULT NULL;

COMMENT ON COLUMN public.patients.internment_status IS 'Status da solicitação de internação: SOLICITACAO_PENDENTE, PSM_FAVORAVEL, AGUARDANDO_VAGA';
COMMENT ON COLUMN public.patients.internment_notes IS 'Observações adicionais sobre o status de internação';