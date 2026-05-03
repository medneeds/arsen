-- ============================================================
-- NIR · Censo de Leitos — Indicadores de tempo e sincronização
-- ============================================================
-- 1) Novas colunas de tempo no bed_census (parametrizáveis e mensuráveis)
ALTER TABLE public.bed_census
  ADD COLUMN IF NOT EXISTS admission_at timestamptz,
  ADD COLUMN IF NOT EXISTS medical_discharge_at timestamptz,
  ADD COLUMN IF NOT EXISTS administrative_discharge_at timestamptz,
  ADD COLUMN IF NOT EXISTS destination_released_at timestamptz,
  ADD COLUMN IF NOT EXISTS deallocated_at timestamptz,
  ADD COLUMN IF NOT EXISTS cleaning_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS cleaning_finished_at timestamptz,
  ADD COLUMN IF NOT EXISTS ready_for_admission_at timestamptz,
  ADD COLUMN IF NOT EXISTS occupied_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_patient_id uuid,
  ADD COLUMN IF NOT EXISTS last_patient_name text;

CREATE INDEX IF NOT EXISTS idx_bed_census_status ON public.bed_census(status);
CREATE INDEX IF NOT EXISTS idx_bed_census_sector_status ON public.bed_census(sector, status);

-- 2) Trigger: ao trocar status, registra timestamps por transição
CREATE OR REPLACE FUNCTION public.bed_census_track_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.status_changed_at := COALESCE(NEW.status_changed_at, now());
    IF NEW.status = 'ocupado' AND NEW.occupied_at IS NULL THEN
      NEW.occupied_at := now();
      NEW.admission_at := COALESCE(NEW.admission_at, now());
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changed_at := now();

    -- Saída de ocupação: alta médica
    IF OLD.status = 'ocupado' AND NEW.status = 'alta_medica_dada' THEN
      NEW.medical_discharge_at := COALESCE(NEW.medical_discharge_at, now());
      NEW.last_patient_id := OLD.patient_id;
      NEW.last_patient_name := OLD.patient_name;
    END IF;

    -- Alta administrativa (liberação do destino + desalocação)
    IF NEW.status IN ('higienizacao', 'vago') AND OLD.status IN ('alta_medica_dada','ocupado') THEN
      NEW.administrative_discharge_at := COALESCE(NEW.administrative_discharge_at, now());
      NEW.deallocated_at := COALESCE(NEW.deallocated_at, now());
      NEW.destination_released_at := COALESCE(NEW.destination_released_at, now());
      IF NEW.last_patient_id IS NULL THEN NEW.last_patient_id := OLD.patient_id; END IF;
      IF NEW.last_patient_name IS NULL THEN NEW.last_patient_name := OLD.patient_name; END IF;
    END IF;

    -- Início e fim do preparo (higienização)
    IF NEW.status = 'higienizacao' AND OLD.status <> 'higienizacao' THEN
      NEW.cleaning_started_at := now();
      NEW.cleaning_finished_at := NULL;
      NEW.ready_for_admission_at := NULL;
    END IF;
    IF OLD.status = 'higienizacao' AND NEW.status <> 'higienizacao' THEN
      NEW.cleaning_finished_at := COALESCE(NEW.cleaning_finished_at, now());
    END IF;

    -- Liberação para nova admissão
    IF NEW.status = 'vago' AND OLD.status IN ('higienizacao','alta_medica_dada','bloqueado','manutencao','interditado','reservado') THEN
      NEW.ready_for_admission_at := COALESCE(NEW.ready_for_admission_at, now());
    END IF;

    -- Ocupação por novo paciente (reset ciclo)
    IF NEW.status = 'ocupado' AND OLD.status <> 'ocupado' THEN
      NEW.occupied_at := now();
      NEW.admission_at := now();
      NEW.medical_discharge_at := NULL;
      NEW.administrative_discharge_at := NULL;
      NEW.destination_released_at := NULL;
      NEW.deallocated_at := NULL;
      NEW.cleaning_started_at := NULL;
      NEW.cleaning_finished_at := NULL;
      NEW.ready_for_admission_at := NULL;
    END IF;

    -- Bloqueios / interdições
    IF NEW.status IN ('bloqueado','manutencao','interditado') AND OLD.status NOT IN ('bloqueado','manutencao','interditado') THEN
      NEW.block_started_at := COALESCE(NEW.block_started_at, now());
    END IF;
    IF OLD.status IN ('bloqueado','manutencao','interditado') AND NEW.status NOT IN ('bloqueado','manutencao','interditado') THEN
      NEW.block_started_at := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bed_census_track_status ON public.bed_census;
CREATE TRIGGER trg_bed_census_track_status
BEFORE INSERT OR UPDATE ON public.bed_census
FOR EACH ROW EXECUTE FUNCTION public.bed_census_track_status();

-- 3) Sincroniza censo com pacientes fictícios já existentes (ocupação real)
-- Marca como ocupado todos os leitos que correspondem a pacientes com nome cadastrado.
UPDATE public.bed_census bc
SET
  status        = 'ocupado',
  patient_id    = p.id,
  patient_name  = p.name,
  occupied_at   = COALESCE(bc.occupied_at, p.uti_admission_date, p.admission_date, p.created_at, now()),
  admission_at  = COALESCE(bc.admission_at, p.uti_admission_date, p.admission_date, p.created_at, now()),
  status_changed_at = COALESCE(bc.status_changed_at, p.created_at, now()),
  updated_at    = now()
FROM public.patients p
WHERE p.hospital_unit_id = bc.hospital_unit_id
  AND lower(trim(p.sector)) = lower(trim(bc.sector))
  AND lower(trim(p.bed_number)) = lower(trim(bc.bed_number))
  AND COALESCE(p.name, '') <> ''
  AND bc.status = 'vago';
