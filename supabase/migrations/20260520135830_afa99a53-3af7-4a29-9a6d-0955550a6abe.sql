-- Fase B.3 — encounter_id em vital_signs, round_sessions, discharge_documents
-- Padrão idêntico ao da Fase A: coluna nullable + índice + trigger autofill (reusa
-- public.autofill_encounter_id já existente) + backfill via patient_encounters.

-- ============ vital_signs ============
ALTER TABLE public.vital_signs
  ADD COLUMN IF NOT EXISTS encounter_id uuid REFERENCES public.patient_encounters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vital_signs_encounter_id
  ON public.vital_signs(encounter_id) WHERE encounter_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_autofill_encounter_vital_signs ON public.vital_signs;
CREATE TRIGGER trg_autofill_encounter_vital_signs
  BEFORE INSERT ON public.vital_signs
  FOR EACH ROW EXECUTE FUNCTION public.autofill_encounter_id();

-- ============ round_sessions ============
ALTER TABLE public.round_sessions
  ADD COLUMN IF NOT EXISTS encounter_id uuid REFERENCES public.patient_encounters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_round_sessions_encounter_id
  ON public.round_sessions(encounter_id) WHERE encounter_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_autofill_encounter_round_sessions ON public.round_sessions;
CREATE TRIGGER trg_autofill_encounter_round_sessions
  BEFORE INSERT ON public.round_sessions
  FOR EACH ROW EXECUTE FUNCTION public.autofill_encounter_id();

-- ============ discharge_documents ============
-- já possui encounter_code; adicionamos encounter_id (FK) para filtro uniforme.
ALTER TABLE public.discharge_documents
  ADD COLUMN IF NOT EXISTS encounter_id uuid REFERENCES public.patient_encounters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_discharge_documents_encounter_id
  ON public.discharge_documents(encounter_id) WHERE encounter_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_autofill_encounter_discharge_documents ON public.discharge_documents;
CREATE TRIGGER trg_autofill_encounter_discharge_documents
  BEFORE INSERT ON public.discharge_documents
  FOR EACH ROW EXECUTE FUNCTION public.autofill_encounter_id();

-- ============ Backfill ============
-- Estratégia: para cada linha existente com patient_id, vincula ao encounter
-- cujo created_at é o maior <= ao created_at da linha (fallback: primeiro
-- encounter do paciente). Idêntico ao backfill da Fase A.

UPDATE public.vital_signs vs
SET encounter_id = sub.enc_id
FROM (
  SELECT v.id AS row_id,
         (SELECT pe.id FROM public.patient_encounters pe
           WHERE pe.patient_id = v.patient_id
             AND pe.created_at <= v.created_at
           ORDER BY pe.created_at DESC LIMIT 1) AS enc_id
  FROM public.vital_signs v
  WHERE v.encounter_id IS NULL AND v.patient_id IS NOT NULL
) sub
WHERE vs.id = sub.row_id AND sub.enc_id IS NOT NULL;

UPDATE public.round_sessions rs
SET encounter_id = sub.enc_id
FROM (
  SELECT r.id AS row_id,
         (SELECT pe.id FROM public.patient_encounters pe
           WHERE pe.patient_id = r.patient_id
             AND pe.created_at <= r.created_at
           ORDER BY pe.created_at DESC LIMIT 1) AS enc_id
  FROM public.round_sessions r
  WHERE r.encounter_id IS NULL AND r.patient_id IS NOT NULL
) sub
WHERE rs.id = sub.row_id AND sub.enc_id IS NOT NULL;

UPDATE public.discharge_documents dd
SET encounter_id = sub.enc_id
FROM (
  SELECT d.id AS row_id,
         (SELECT pe.id FROM public.patient_encounters pe
           WHERE pe.patient_id = d.patient_id
             AND pe.created_at <= d.created_at
           ORDER BY pe.created_at DESC LIMIT 1) AS enc_id
  FROM public.discharge_documents d
  WHERE d.encounter_id IS NULL AND d.patient_id IS NOT NULL
) sub
WHERE dd.id = sub.row_id AND sub.enc_id IS NOT NULL;