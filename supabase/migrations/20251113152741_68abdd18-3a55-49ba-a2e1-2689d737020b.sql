-- Adicionar coluna para data/hora específica da passagem
ALTER TABLE public.shift_handovers
ADD COLUMN IF NOT EXISTS handover_datetime TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

COMMENT ON COLUMN public.shift_handovers.handover_datetime IS 'Data e hora específica do registro da passagem';