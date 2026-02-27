-- Remover o constraint conflitante que espera valores minúsculos
ALTER TABLE public.medical_codes DROP CONSTRAINT IF EXISTS category_valid;

-- O constraint medical_codes_category_check (que espera maiúsculas) permanece ativo