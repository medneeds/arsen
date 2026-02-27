-- Adicionar campos de dados do paciente à tabela de solicitações de internação
ALTER TABLE public.internment_requests
ADD COLUMN patient_name TEXT NOT NULL DEFAULT 'NÃO INFORMADO',
ADD COLUMN patient_age INTEGER,
ADD COLUMN patient_sex TEXT,
ADD COLUMN patient_record TEXT;

-- Remover constraint de default depois
ALTER TABLE public.internment_requests
ALTER COLUMN patient_name DROP DEFAULT;