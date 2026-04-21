ALTER TABLE public.patients
ADD COLUMN IF NOT EXISTS hospital_discharge_prediction date;

COMMENT ON COLUMN public.patients.hospital_discharge_prediction IS 'Previsão de alta hospitalar — registrada na evolução clínica e sincronizada com Admissão/Painel Clínico.';
COMMENT ON COLUMN public.patients.uti_discharge_prediction IS 'Previsão de alta da UTI/UCI — registrada na evolução clínica e sincronizada com Admissão/Painel Clínico.';