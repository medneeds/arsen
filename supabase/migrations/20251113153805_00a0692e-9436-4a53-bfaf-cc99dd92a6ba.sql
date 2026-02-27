-- Adicionar coluna para médicos que estão passando o plantão
ALTER TABLE public.shift_handovers
ADD COLUMN IF NOT EXISTS handover_from TEXT;

COMMENT ON COLUMN public.shift_handovers.handover_from IS 'Médico(s) que estão passando o plantão - múltiplos nomes separados por vírgula';
COMMENT ON COLUMN public.shift_handovers.handover_to IS 'Médico(s) que estão recebendo o plantão - múltiplos nomes separados por vírgula';