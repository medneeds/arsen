-- 1) Modo por unidade hospitalar
ALTER TABLE public.hospital_units
  ADD COLUMN IF NOT EXISTS medical_record_mode text NOT NULL DEFAULT 'legacy'
    CHECK (medical_record_mode IN ('legacy','auto'));

-- 2) Novos campos em medical_records
ALTER TABLE public.medical_records
  ADD COLUMN IF NOT EXISTS hospital_unit_id uuid REFERENCES public.hospital_units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS numero_prontuario_legado text,
  ADD COLUMN IF NOT EXISTS generation_mode text NOT NULL DEFAULT 'auto'
    CHECK (generation_mode IN ('auto','manual_legacy')),
  ADD COLUMN IF NOT EXISTS is_legacy boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_medical_records_hospital_unit
  ON public.medical_records(hospital_unit_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_legado
  ON public.medical_records(numero_prontuario_legado)
  WHERE numero_prontuario_legado IS NOT NULL;

-- 3) Relaxar restrições para conviver com legados
ALTER TABLE public.medical_records DROP CONSTRAINT IF EXISTS medical_records_format;
ALTER TABLE public.medical_records
  ADD CONSTRAINT medical_records_format CHECK (
    numero_prontuario ~ '^[0-9]{2}-[0-9]{3}-[0-9]{6}-[0-9]$'
    OR length(trim(numero_prontuario)) BETWEEN 1 AND 64
  );

ALTER TABLE public.medical_records ALTER COLUMN numero_base DROP NOT NULL;
ALTER TABLE public.medical_records ALTER COLUMN dv DROP NOT NULL;
ALTER TABLE public.medical_records ALTER COLUMN ano_referencia DROP NOT NULL;
ALTER TABLE public.medical_records ALTER COLUMN codigo_unidade DROP NOT NULL;
ALTER TABLE public.medical_records ALTER COLUMN sequencia DROP NOT NULL;

-- 4) Trigger BEFORE INSERT: decide modo conforme unidade
CREATE OR REPLACE FUNCTION public.medical_records_apply_mode()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode text;
  v_unit_code text;
  v_aa text;
  v_seq integer;
  v_ssssss text;
  v_base text;
  v_dv smallint;
  v_numero text;
BEGIN
  -- Determina modo da unidade (default legacy se não houver unidade)
  IF NEW.hospital_unit_id IS NOT NULL THEN
    SELECT medical_record_mode, unit_code
      INTO v_mode, v_unit_code
      FROM public.hospital_units
      WHERE id = NEW.hospital_unit_id;
  END IF;
  v_mode := COALESCE(v_mode, 'legacy');

  -- Caso 1: número informado manualmente → trata como legacy
  IF NEW.numero_prontuario IS NOT NULL AND length(trim(NEW.numero_prontuario)) > 0 THEN
    -- Se não bate com formato seguro, marca como legacy
    IF NEW.numero_prontuario !~ '^[0-9]{2}-[0-9]{3}-[0-9]{6}-[0-9]$' THEN
      NEW.is_legacy := true;
      NEW.generation_mode := 'manual_legacy';
      NEW.numero_prontuario_legado := COALESCE(NEW.numero_prontuario_legado, NEW.numero_prontuario);
    ELSE
      NEW.is_legacy := COALESCE(NEW.is_legacy, false);
      NEW.generation_mode := COALESCE(NEW.generation_mode, 'auto');
    END IF;
    RETURN NEW;
  END IF;

  -- Caso 2: número vazio em unidade legacy → bloquear, exigir entrada manual
  IF v_mode = 'legacy' THEN
    RAISE EXCEPTION 'Unidade em modo legacy: numero_prontuario é obrigatório (informe o número do sistema antigo).';
  END IF;

  -- Caso 3: modo auto + número vazio → gera automaticamente
  IF v_unit_code IS NULL OR v_unit_code !~ '^[0-9]{3}$' THEN
    RAISE EXCEPTION 'Unidade hospitalar sem unit_code válido para geração automática.';
  END IF;

  v_aa := to_char(COALESCE(NEW.data_criacao, now()), 'YY');

  INSERT INTO public.medical_record_sequences (year_ref, unit_code, last_sequence, updated_at)
  VALUES (v_aa, v_unit_code, 1, now())
  ON CONFLICT (year_ref, unit_code)
  DO UPDATE SET last_sequence = public.medical_record_sequences.last_sequence + 1, updated_at = now()
  RETURNING last_sequence INTO v_seq;

  v_ssssss := lpad(v_seq::text, 6, '0');
  v_base := v_aa || v_unit_code || v_ssssss;
  v_dv := public.calc_dv_mod11(v_base);
  v_numero := v_aa || '-' || v_unit_code || '-' || v_ssssss || '-' || v_dv::text;

  NEW.numero_prontuario := v_numero;
  NEW.numero_base := v_base;
  NEW.dv := v_dv;
  NEW.ano_referencia := v_aa;
  NEW.codigo_unidade := v_unit_code;
  NEW.sequencia := v_seq;
  NEW.is_legacy := false;
  NEW.generation_mode := 'auto';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_medical_records_apply_mode ON public.medical_records;
CREATE TRIGGER trg_medical_records_apply_mode
  BEFORE INSERT ON public.medical_records
  FOR EACH ROW EXECUTE FUNCTION public.medical_records_apply_mode();

-- 5) Auditoria automática (usa o trigger genérico já existente)
DROP TRIGGER IF EXISTS trg_medical_records_audit ON public.medical_records;
CREATE TRIGGER trg_medical_records_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.medical_records
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();