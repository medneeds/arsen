-- Alterar coluna age de integer para TEXT para suportar formatação pediátrica
ALTER TABLE public.patients 
ALTER COLUMN age TYPE TEXT USING age::TEXT;