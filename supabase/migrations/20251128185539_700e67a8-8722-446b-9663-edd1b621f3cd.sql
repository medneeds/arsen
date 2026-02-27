-- Add UTI-specific columns to patients table
ALTER TABLE public.patients 
ADD COLUMN uti_admission_date TIMESTAMP WITH TIME ZONE NULL,
ADD COLUMN uti_discharge_prediction TEXT NULL,
ADD COLUMN uti_allergies TEXT NULL,
ADD COLUMN uti_admission_reason TEXT NULL,
ADD COLUMN uti_current_status TEXT NULL,
ADD COLUMN uti_devices TEXT NULL,
ADD COLUMN uti_cultures_antibiotics TEXT NULL,
ADD COLUMN uti_specialties TEXT NULL;

COMMENT ON COLUMN public.patients.uti_admission_date IS 'Data e hora de admissão na UTI';
COMMENT ON COLUMN public.patients.uti_discharge_prediction IS 'Previsão de alta da UTI';
COMMENT ON COLUMN public.patients.uti_allergies IS 'Alergias do paciente';
COMMENT ON COLUMN public.patients.uti_admission_reason IS 'Motivo da admissão na UTI';
COMMENT ON COLUMN public.patients.uti_current_status IS 'Quadro clínico atual do paciente';
COMMENT ON COLUMN public.patients.uti_devices IS 'Dispositivos em uso e datas de inserção';
COMMENT ON COLUMN public.patients.uti_cultures_antibiotics IS 'Culturas coletadas e antibióticos em curso';
COMMENT ON COLUMN public.patients.uti_specialties IS 'Especialidades médicas envolvidas no caso';