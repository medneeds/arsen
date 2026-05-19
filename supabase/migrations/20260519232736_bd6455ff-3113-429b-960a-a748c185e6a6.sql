-- ============================================================
-- FASE A.2: patient_registry_id em 5 tabelas clínicas
-- Padrão idêntico à Fase A (encounter_id): aditivo, nullable,
-- trigger autofill, backfill via encounter_id já carimbado.
-- Zero impacto em leitura/escrita atual.
-- ============================================================

-- 1) Adicionar coluna (nullable, sem default) nas 5 tabelas
ALTER TABLE public.clinical_evolutions  ADD COLUMN IF NOT EXISTS patient_registry_id uuid REFERENCES public.patient_registry(id) ON DELETE SET NULL;
ALTER TABLE public.exam_requests        ADD COLUMN IF NOT EXISTS patient_registry_id uuid REFERENCES public.patient_registry(id) ON DELETE SET NULL;
ALTER TABLE public.culture_results      ADD COLUMN IF NOT EXISTS patient_registry_id uuid REFERENCES public.patient_registry(id) ON DELETE SET NULL;
ALTER TABLE public.conduct_history      ADD COLUMN IF NOT EXISTS patient_registry_id uuid REFERENCES public.patient_registry(id) ON DELETE SET NULL;
ALTER TABLE public.patient_movements    ADD COLUMN IF NOT EXISTS patient_registry_id uuid REFERENCES public.patient_registry(id) ON DELETE SET NULL;

-- 2) Índices para queries longitudinais (fase B.3)
CREATE INDEX IF NOT EXISTS idx_clinical_evolutions_registry  ON public.clinical_evolutions(patient_registry_id) WHERE patient_registry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_exam_requests_registry        ON public.exam_requests(patient_registry_id)       WHERE patient_registry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_culture_results_registry      ON public.culture_results(patient_registry_id)     WHERE patient_registry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conduct_history_registry      ON public.conduct_history(patient_registry_id)     WHERE patient_registry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patient_movements_registry    ON public.patient_movements(patient_registry_id)   WHERE patient_registry_id IS NOT NULL;

-- 3) Função trigger autofill: deriva patient_registry_id via encounter_id
-- Roda DEPOIS do autofill_encounter_id (que já garante encounter_id quando há patient_id).
CREATE OR REPLACE FUNCTION public.autofill_patient_registry_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.patient_registry_id IS NULL AND NEW.encounter_id IS NOT NULL THEN
    SELECT pe.registry_id
      INTO NEW.patient_registry_id
      FROM public.patient_encounters pe
     WHERE pe.id = NEW.encounter_id
     LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

-- 4) Triggers BEFORE INSERT OR UPDATE — uma por tabela
--    Nome padronizado: trg_<tabela>_autofill_registry
DROP TRIGGER IF EXISTS trg_clinical_evolutions_autofill_registry ON public.clinical_evolutions;
CREATE TRIGGER trg_clinical_evolutions_autofill_registry
  BEFORE INSERT OR UPDATE ON public.clinical_evolutions
  FOR EACH ROW EXECUTE FUNCTION public.autofill_patient_registry_id();

DROP TRIGGER IF EXISTS trg_exam_requests_autofill_registry ON public.exam_requests;
CREATE TRIGGER trg_exam_requests_autofill_registry
  BEFORE INSERT OR UPDATE ON public.exam_requests
  FOR EACH ROW EXECUTE FUNCTION public.autofill_patient_registry_id();

DROP TRIGGER IF EXISTS trg_culture_results_autofill_registry ON public.culture_results;
CREATE TRIGGER trg_culture_results_autofill_registry
  BEFORE INSERT OR UPDATE ON public.culture_results
  FOR EACH ROW EXECUTE FUNCTION public.autofill_patient_registry_id();

DROP TRIGGER IF EXISTS trg_conduct_history_autofill_registry ON public.conduct_history;
CREATE TRIGGER trg_conduct_history_autofill_registry
  BEFORE INSERT OR UPDATE ON public.conduct_history
  FOR EACH ROW EXECUTE FUNCTION public.autofill_patient_registry_id();

DROP TRIGGER IF EXISTS trg_patient_movements_autofill_registry ON public.patient_movements;
CREATE TRIGGER trg_patient_movements_autofill_registry
  BEFORE INSERT OR UPDATE ON public.patient_movements
  FOR EACH ROW EXECUTE FUNCTION public.autofill_patient_registry_id();

-- 5) Backfill: registros antigos que já têm encounter_id carimbado
--    (cobre o que a Fase A.1 já marcou)
UPDATE public.clinical_evolutions ce
   SET patient_registry_id = pe.registry_id
  FROM public.patient_encounters pe
 WHERE ce.encounter_id = pe.id
   AND ce.patient_registry_id IS NULL
   AND pe.registry_id IS NOT NULL;

UPDATE public.exam_requests er
   SET patient_registry_id = pe.registry_id
  FROM public.patient_encounters pe
 WHERE er.encounter_id = pe.id
   AND er.patient_registry_id IS NULL
   AND pe.registry_id IS NOT NULL;

UPDATE public.culture_results cr
   SET patient_registry_id = pe.registry_id
  FROM public.patient_encounters pe
 WHERE cr.encounter_id = pe.id
   AND cr.patient_registry_id IS NULL
   AND pe.registry_id IS NOT NULL;

UPDATE public.conduct_history ch
   SET patient_registry_id = pe.registry_id
  FROM public.patient_encounters pe
 WHERE ch.encounter_id = pe.id
   AND ch.patient_registry_id IS NULL
   AND pe.registry_id IS NOT NULL;

UPDATE public.patient_movements pm
   SET patient_registry_id = pe.registry_id
  FROM public.patient_encounters pe
 WHERE pm.encounter_id = pe.id
   AND pm.patient_registry_id IS NULL
   AND pe.registry_id IS NOT NULL;