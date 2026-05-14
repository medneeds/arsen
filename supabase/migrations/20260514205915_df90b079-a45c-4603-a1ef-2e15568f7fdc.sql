ALTER TABLE public.saps3_assessments
  ADD COLUMN IF NOT EXISTS clinical_history jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS lifestyle_habits jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS vasoactive_drugs jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.saps3_assessments.clinical_history IS 'Antecedentes clínicos não-SAPS (HAS, DM, DPOC, etc.) — não pontuam no escore';
COMMENT ON COLUMN public.saps3_assessments.lifestyle_habits IS 'Hábitos de vida (tabagismo, etilismo, drogas) — não pontuam no escore';
COMMENT ON COLUMN public.saps3_assessments.vasoactive_drugs IS 'Drogas vasoativas em uso na admissão — não pontuam no escore';