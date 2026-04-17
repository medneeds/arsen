-- 1) Sequência global única para códigos de atendimento (monotônica, nunca reinicia)
CREATE SEQUENCE IF NOT EXISTS public.encounter_global_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  CACHE 1;

-- 2) Vincular atendimento ao prontuário (medical_records.id)
ALTER TABLE public.patient_encounters
  ADD COLUMN IF NOT EXISTS medical_record_id UUID REFERENCES public.medical_records(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_patient_encounters_medical_record_id
  ON public.patient_encounters(medical_record_id);

-- 3) Garantir unicidade do código de atendimento
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'patient_encounters_encounter_code_key'
  ) THEN
    ALTER TABLE public.patient_encounters
      ADD CONSTRAINT patient_encounters_encounter_code_key UNIQUE (encounter_code);
  END IF;
END$$;

-- 4) Função RPC para gerar o código no padrão CCCCCCCCCCCC (12 dígitos)
CREATE OR REPLACE FUNCTION public.generate_encounter_code_v2(
  p_medical_record_id UUID,
  p_data_hora_admissao TIMESTAMP WITH TIME ZONE DEFAULT now()
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_next BIGINT;
  v_codigo TEXT;
BEGIN
  -- Validações obrigatórias
  IF p_medical_record_id IS NULL THEN
    RAISE EXCEPTION 'prontuario_id é obrigatório';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.medical_records WHERE id = p_medical_record_id) THEN
    RAISE EXCEPTION 'Prontuário não encontrado: %', p_medical_record_id;
  END IF;

  IF p_data_hora_admissao IS NULL THEN
    RAISE EXCEPTION 'data_hora_admissao inválida';
  END IF;

  -- Obter próximo valor do sequencial global (atomic, concurrency-safe)
  v_next := nextval('public.encounter_global_seq');
  v_codigo := lpad(v_next::TEXT, 12, '0');

  -- Validação de unicidade (defensiva - sequence + UNIQUE garantem)
  IF EXISTS (SELECT 1 FROM public.patient_encounters WHERE encounter_code = v_codigo) THEN
    RAISE EXCEPTION 'Conflito de unicidade no código de atendimento %', v_codigo;
  END IF;

  RETURN v_codigo;
END;
$$;

-- 5) Atualizar trigger antigo para usar o novo formato quando código não for fornecido
CREATE OR REPLACE FUNCTION public.generate_encounter_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.encounter_code IS NULL OR NEW.encounter_code = '' THEN
    NEW.encounter_code := lpad(nextval('public.encounter_global_seq')::TEXT, 12, '0');
  END IF;
  RETURN NEW;
END;
$$;