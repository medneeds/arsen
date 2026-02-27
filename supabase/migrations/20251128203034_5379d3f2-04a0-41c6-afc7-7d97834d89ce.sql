-- Adicionar campo uti_origin_sector para armazenar setor de origem do paciente na UTI
ALTER TABLE public.patients 
ADD COLUMN uti_origin_sector text;