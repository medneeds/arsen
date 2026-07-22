-- ════════════════════════════════════════════════════════════════════════
-- patient_encounters: adiciona pre_admission_id (rastreabilidade da
-- pré-admissão administrativa que originou o atendimento).
-- ════════════════════════════════════════════════════════════════════════
-- 22/07/2026. O fluxo de pré-admissão administrativa (PatientSearchActionsDialog,
-- "aloca + gera atendimento") inseria pre_admission_id em patient_encounters,
-- mas a coluna nunca foi criada (nao havia migration no git). Resultado na
-- staging: "Could not find the 'pre_admission_id' column of
-- 'patient_encounters' in the schema cache" quebrava a readmissao/abertura de
-- atendimento por esse caminho.
--
-- O codigo ja foi tornado resiliente (refaz o insert sem a coluna se ela
-- faltar), mas a coluna e util para rastreabilidade — esta migration a cria
-- de forma idempotente. FK defensiva: so referencia pre_admissions se a
-- tabela existir.

ALTER TABLE public.patient_encounters
  ADD COLUMN IF NOT EXISTS pre_admission_id uuid;

DO $fk$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='pre_admissions')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE table_schema='public'
         AND table_name='patient_encounters'
         AND constraint_name='patient_encounters_pre_admission_id_fkey'
     )
  THEN
    ALTER TABLE public.patient_encounters
      ADD CONSTRAINT patient_encounters_pre_admission_id_fkey
      FOREIGN KEY (pre_admission_id) REFERENCES public.pre_admissions(id) ON DELETE SET NULL;
  END IF;
END
$fk$;

CREATE INDEX IF NOT EXISTS idx_patient_encounters_pre_admission_id
  ON public.patient_encounters(pre_admission_id);

COMMENT ON COLUMN public.patient_encounters.pre_admission_id IS
  'Rastreabilidade: pre-admissao administrativa que originou este atendimento (opcional).';
