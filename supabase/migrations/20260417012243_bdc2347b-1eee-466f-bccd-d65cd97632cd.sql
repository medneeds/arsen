
-- 1. Add unit_code to hospital_units (3 digits)
ALTER TABLE public.hospital_units
ADD COLUMN IF NOT EXISTS unit_code TEXT;

-- Backfill default code for the existing unit (Socorrão I = 117)
UPDATE public.hospital_units
SET unit_code = '117'
WHERE unit_code IS NULL;

-- Enforce 3-digit numeric format
ALTER TABLE public.hospital_units
ADD CONSTRAINT hospital_units_unit_code_format CHECK (unit_code ~ '^[0-9]{3}$');

ALTER TABLE public.hospital_units
ADD CONSTRAINT hospital_units_unit_code_unique UNIQUE (unit_code);

-- 2. Sequence control table (per year + unit)
CREATE TABLE IF NOT EXISTS public.medical_record_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_ref TEXT NOT NULL,
  unit_code TEXT NOT NULL,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT medical_record_sequences_unique UNIQUE (year_ref, unit_code),
  CONSTRAINT medical_record_sequences_year_format CHECK (year_ref ~ '^[0-9]{2}$'),
  CONSTRAINT medical_record_sequences_unit_format CHECK (unit_code ~ '^[0-9]{3}$')
);

ALTER TABLE public.medical_record_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view sequences"
ON public.medical_record_sequences FOR SELECT
TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage sequences"
ON public.medical_record_sequences FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3. Medical records table
CREATE TABLE IF NOT EXISTS public.medical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_prontuario TEXT NOT NULL UNIQUE,
  numero_base TEXT NOT NULL,
  dv SMALLINT NOT NULL,
  ano_referencia TEXT NOT NULL,
  codigo_unidade TEXT NOT NULL,
  sequencia INTEGER NOT NULL,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  patient_registry_id UUID REFERENCES public.patient_registry(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT medical_records_format CHECK (numero_prontuario ~ '^[0-9]{2}-[0-9]{3}-[0-9]{6}-[0-9]$')
);

CREATE INDEX IF NOT EXISTS idx_medical_records_year_unit
  ON public.medical_records(ano_referencia, codigo_unidade);

CREATE INDEX IF NOT EXISTS idx_medical_records_patient_registry
  ON public.medical_records(patient_registry_id);

ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view medical records"
ON public.medical_records FOR SELECT
TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can insert medical records"
ON public.medical_records FOR INSERT
TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update medical records"
ON public.medical_records FOR UPDATE
TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete medical records"
ON public.medical_records FOR DELETE
TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. DV calculator (módulo 11, pesos cíclicos 2..9 da direita p/ esquerda)
CREATE OR REPLACE FUNCTION public.calc_dv_mod11(p_base TEXT)
RETURNS SMALLINT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  pesos INTEGER[] := ARRAY[2,3,4,5,6,7,8,9];
  soma INTEGER := 0;
  idx_peso INTEGER := 1;
  i INTEGER;
  digito INTEGER;
  resto INTEGER;
  dv INTEGER;
BEGIN
  IF p_base !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'BASE inválida: deve conter apenas dígitos';
  END IF;

  FOR i IN REVERSE length(p_base)..1 LOOP
    digito := substring(p_base FROM i FOR 1)::INTEGER;
    soma := soma + (digito * pesos[idx_peso]);
    idx_peso := idx_peso + 1;
    IF idx_peso > array_length(pesos, 1) THEN
      idx_peso := 1;
    END IF;
  END LOOP;

  resto := soma % 11;
  dv := 11 - resto;

  IF dv = 10 OR dv = 11 THEN
    dv := 0;
  END IF;

  RETURN dv::SMALLINT;
END;
$$;

-- 5. Main generator (transactional with row-level lock)
CREATE OR REPLACE FUNCTION public.generate_medical_record_number(
  p_codigo_unidade TEXT,
  p_data_criacao TIMESTAMPTZ DEFAULT now(),
  p_patient_registry_id UUID DEFAULT NULL,
  p_patient_id UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aa TEXT;
  v_seq INTEGER;
  v_ssssss TEXT;
  v_base TEXT;
  v_dv SMALLINT;
  v_numero TEXT;
  v_user UUID;
BEGIN
  -- Validations
  IF p_codigo_unidade IS NULL OR p_codigo_unidade !~ '^[0-9]{3}$' THEN
    RAISE EXCEPTION 'codigo_unidade inválido: deve ter exatamente 3 dígitos numéricos';
  END IF;

  IF p_data_criacao IS NULL THEN
    RAISE EXCEPTION 'data_criacao inválida';
  END IF;

  v_aa := to_char(p_data_criacao, 'YY');
  v_user := auth.uid();

  -- Atomic upsert + lock + increment
  INSERT INTO public.medical_record_sequences (year_ref, unit_code, last_sequence, updated_at)
  VALUES (v_aa, p_codigo_unidade, 1, now())
  ON CONFLICT (year_ref, unit_code)
  DO UPDATE SET
    last_sequence = public.medical_record_sequences.last_sequence + 1,
    updated_at = now()
  RETURNING last_sequence INTO v_seq;

  v_ssssss := lpad(v_seq::TEXT, 6, '0');
  v_base := v_aa || p_codigo_unidade || v_ssssss;
  v_dv := public.calc_dv_mod11(v_base);
  v_numero := v_aa || '-' || p_codigo_unidade || '-' || v_ssssss || '-' || v_dv::TEXT;

  -- Uniqueness guard (the UNIQUE constraint also enforces this)
  IF EXISTS (SELECT 1 FROM public.medical_records WHERE numero_prontuario = v_numero) THEN
    RAISE EXCEPTION 'Conflito de unicidade ao gerar prontuário %', v_numero;
  END IF;

  INSERT INTO public.medical_records (
    numero_prontuario, numero_base, dv, ano_referencia,
    codigo_unidade, sequencia, data_criacao,
    patient_registry_id, patient_id, created_by
  ) VALUES (
    v_numero, v_base, v_dv, v_aa,
    p_codigo_unidade, v_seq, p_data_criacao,
    p_patient_registry_id, p_patient_id, v_user
  );

  RETURN v_numero;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_medical_record_number(TEXT, TIMESTAMPTZ, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calc_dv_mod11(TEXT) TO authenticated;
