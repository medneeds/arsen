
-- ============================================================================
-- FASE A — Identidade longitudinal por atendimento (encounter_id)
-- ============================================================================
-- 1) Função resolvedora: dado um patient_id (linha-leito), descobre o encounter
--    ativo correspondente através do patient_registry_id.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_active_encounter_for_patient(p_patient_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT pe.id
    FROM public.patient_encounters pe
    JOIN public.patients p ON p.patient_registry_id = pe.registry_id
   WHERE p.id = p_patient_id
     AND pe.status = 'active'
   ORDER BY pe.created_at DESC
   LIMIT 1;
$$;

-- 2) Trigger function genérico: preenche NEW.encounter_id se vier NULL.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.autofill_encounter_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.encounter_id IS NULL AND NEW.patient_id IS NOT NULL THEN
    NEW.encounter_id := public.resolve_active_encounter_for_patient(NEW.patient_id);
  END IF;
  RETURN NEW;
END;
$$;

-- 3) Adicionar coluna encounter_id + índice + trigger em cada tabela filha.
-- ----------------------------------------------------------------------------

-- clinical_evolutions
ALTER TABLE public.clinical_evolutions
  ADD COLUMN IF NOT EXISTS encounter_id uuid REFERENCES public.patient_encounters(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_clinical_evolutions_encounter_id
  ON public.clinical_evolutions(encounter_id);
DROP TRIGGER IF EXISTS trg_autofill_encounter_clinical_evolutions ON public.clinical_evolutions;
CREATE TRIGGER trg_autofill_encounter_clinical_evolutions
  BEFORE INSERT ON public.clinical_evolutions
  FOR EACH ROW EXECUTE FUNCTION public.autofill_encounter_id();

-- culture_results
ALTER TABLE public.culture_results
  ADD COLUMN IF NOT EXISTS encounter_id uuid REFERENCES public.patient_encounters(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_culture_results_encounter_id
  ON public.culture_results(encounter_id);
DROP TRIGGER IF EXISTS trg_autofill_encounter_culture_results ON public.culture_results;
CREATE TRIGGER trg_autofill_encounter_culture_results
  BEFORE INSERT ON public.culture_results
  FOR EACH ROW EXECUTE FUNCTION public.autofill_encounter_id();

-- exam_requests
ALTER TABLE public.exam_requests
  ADD COLUMN IF NOT EXISTS encounter_id uuid REFERENCES public.patient_encounters(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_exam_requests_encounter_id
  ON public.exam_requests(encounter_id);
DROP TRIGGER IF EXISTS trg_autofill_encounter_exam_requests ON public.exam_requests;
CREATE TRIGGER trg_autofill_encounter_exam_requests
  BEFORE INSERT ON public.exam_requests
  FOR EACH ROW EXECUTE FUNCTION public.autofill_encounter_id();

-- conduct_history
ALTER TABLE public.conduct_history
  ADD COLUMN IF NOT EXISTS encounter_id uuid REFERENCES public.patient_encounters(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_conduct_history_encounter_id
  ON public.conduct_history(encounter_id);
DROP TRIGGER IF EXISTS trg_autofill_encounter_conduct_history ON public.conduct_history;
CREATE TRIGGER trg_autofill_encounter_conduct_history
  BEFORE INSERT ON public.conduct_history
  FOR EACH ROW EXECUTE FUNCTION public.autofill_encounter_id();

-- patient_movements
ALTER TABLE public.patient_movements
  ADD COLUMN IF NOT EXISTS encounter_id uuid REFERENCES public.patient_encounters(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_patient_movements_encounter_id
  ON public.patient_movements(encounter_id);
DROP TRIGGER IF EXISTS trg_autofill_encounter_patient_movements ON public.patient_movements;
CREATE TRIGGER trg_autofill_encounter_patient_movements
  BEFORE INSERT ON public.patient_movements
  FOR EACH ROW EXECUTE FUNCTION public.autofill_encounter_id();

-- 4) Backfill dos registros existentes.
-- ----------------------------------------------------------------------------
-- Estratégia: para cada linha sem encounter_id, escolher o encounter do MESMO
-- patient_registry_id cujo created_at é o maior <= row.created_at. Se não houver
-- candidato anterior, usa o encounter mais antigo do registry.
-- ----------------------------------------------------------------------------

-- Helper CTE inline por tabela
WITH candidates AS (
  SELECT ce.id AS row_id,
         (
           SELECT pe.id
             FROM public.patient_encounters pe
            WHERE pe.registry_id = ce.patient_registry_id
              AND pe.created_at <= ce.created_at
            ORDER BY pe.created_at DESC
            LIMIT 1
         ) AS enc_prev,
         (
           SELECT pe2.id
             FROM public.patient_encounters pe2
            WHERE pe2.registry_id = ce.patient_registry_id
            ORDER BY pe2.created_at ASC
            LIMIT 1
         ) AS enc_first
    FROM public.clinical_evolutions ce
   WHERE ce.encounter_id IS NULL
     AND ce.patient_registry_id IS NOT NULL
)
UPDATE public.clinical_evolutions ce
   SET encounter_id = COALESCE(c.enc_prev, c.enc_first)
  FROM candidates c
 WHERE ce.id = c.row_id
   AND COALESCE(c.enc_prev, c.enc_first) IS NOT NULL;

WITH candidates AS (
  SELECT cr.id AS row_id,
         (SELECT pe.id FROM public.patient_encounters pe
           WHERE pe.registry_id = cr.patient_registry_id
             AND pe.created_at <= cr.created_at
           ORDER BY pe.created_at DESC LIMIT 1) AS enc_prev,
         (SELECT pe2.id FROM public.patient_encounters pe2
           WHERE pe2.registry_id = cr.patient_registry_id
           ORDER BY pe2.created_at ASC LIMIT 1) AS enc_first
    FROM public.culture_results cr
   WHERE cr.encounter_id IS NULL
     AND cr.patient_registry_id IS NOT NULL
)
UPDATE public.culture_results cr
   SET encounter_id = COALESCE(c.enc_prev, c.enc_first)
  FROM candidates c
 WHERE cr.id = c.row_id
   AND COALESCE(c.enc_prev, c.enc_first) IS NOT NULL;

WITH candidates AS (
  SELECT er.id AS row_id,
         (SELECT pe.id FROM public.patient_encounters pe
           WHERE pe.registry_id = er.patient_registry_id
             AND pe.created_at <= er.created_at
           ORDER BY pe.created_at DESC LIMIT 1) AS enc_prev,
         (SELECT pe2.id FROM public.patient_encounters pe2
           WHERE pe2.registry_id = er.patient_registry_id
           ORDER BY pe2.created_at ASC LIMIT 1) AS enc_first
    FROM public.exam_requests er
   WHERE er.encounter_id IS NULL
     AND er.patient_registry_id IS NOT NULL
)
UPDATE public.exam_requests er
   SET encounter_id = COALESCE(c.enc_prev, c.enc_first)
  FROM candidates c
 WHERE er.id = c.row_id
   AND COALESCE(c.enc_prev, c.enc_first) IS NOT NULL;

WITH candidates AS (
  SELECT ch.id AS row_id,
         (SELECT pe.id FROM public.patient_encounters pe
           WHERE pe.registry_id = ch.patient_registry_id
             AND pe.created_at <= ch.created_at
           ORDER BY pe.created_at DESC LIMIT 1) AS enc_prev,
         (SELECT pe2.id FROM public.patient_encounters pe2
           WHERE pe2.registry_id = ch.patient_registry_id
           ORDER BY pe2.created_at ASC LIMIT 1) AS enc_first
    FROM public.conduct_history ch
   WHERE ch.encounter_id IS NULL
     AND ch.patient_registry_id IS NOT NULL
)
UPDATE public.conduct_history ch
   SET encounter_id = COALESCE(c.enc_prev, c.enc_first)
  FROM candidates c
 WHERE ch.id = c.row_id
   AND COALESCE(c.enc_prev, c.enc_first) IS NOT NULL;

WITH candidates AS (
  SELECT pm.id AS row_id,
         (SELECT pe.id FROM public.patient_encounters pe
           WHERE pe.registry_id = pm.patient_registry_id
             AND pe.created_at <= pm.created_at
           ORDER BY pe.created_at DESC LIMIT 1) AS enc_prev,
         (SELECT pe2.id FROM public.patient_encounters pe2
           WHERE pe2.registry_id = pm.patient_registry_id
           ORDER BY pe2.created_at ASC LIMIT 1) AS enc_first
    FROM public.patient_movements pm
   WHERE pm.encounter_id IS NULL
     AND pm.patient_registry_id IS NOT NULL
)
UPDATE public.patient_movements pm
   SET encounter_id = COALESCE(c.enc_prev, c.enc_first)
  FROM candidates c
 WHERE pm.id = c.row_id
   AND COALESCE(c.enc_prev, c.enc_first) IS NOT NULL;
