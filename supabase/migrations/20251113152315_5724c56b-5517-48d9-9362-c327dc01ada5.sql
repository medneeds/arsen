-- Adicionar coluna para registrar o médico destinatário da passagem
ALTER TABLE public.shift_handovers
ADD COLUMN handover_to TEXT;

-- Adicionar coluna para data/hora específica da passagem
ALTER TABLE public.shift_handovers
ADD COLUMN handover_datetime TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

COMMENT ON COLUMN public.shift_handovers.handover_to IS 'Nome do médico para quem o plantão foi passado (opcional)';
COMMENT ON COLUMN public.shift_handovers.handover_datetime IS 'Data e hora específica do registro da passagem';