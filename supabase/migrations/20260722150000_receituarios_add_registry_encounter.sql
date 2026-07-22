-- ════════════════════════════════════════════════════════════════════════
-- receituarios: adiciona patient_registry_id (+ encounter_id) para o vínculo
-- estável, alinhando a tabela ao modelo das demais tabelas clínicas.
-- ════════════════════════════════════════════════════════════════════════
-- 22/07/2026. A tabela receituarios só tinha patient_id (linha-LEITO). A
-- correcao de leitura do useReceituario (ler por registry para o receituario
-- seguir o paciente entre leitos) referenciava patient_registry_id, que NAO
-- existia no banco → "column receituarios.patient_registry_id does not exist"
-- quebrava o carregamento. Esta migration cria a coluna e faz backfill a
-- partir da linha-leito atual. O hook ja tem fallback defensivo, mas com a
-- coluna presente o vinculo estavel passa a funcionar de fato.

ALTER TABLE public.receituarios
  ADD COLUMN IF NOT EXISTS patient_registry_id uuid REFERENCES public.patient_registry(id) ON DELETE SET NULL;

ALTER TABLE public.receituarios
  ADD COLUMN IF NOT EXISTS encounter_id uuid REFERENCES public.patient_encounters(id) ON DELETE SET NULL;

-- Backfill: deriva o registry a partir da linha-leito (patients) referenciada.
UPDATE public.receituarios r
SET patient_registry_id = p.patient_registry_id
FROM public.patients p
WHERE r.patient_id = p.id
  AND r.patient_registry_id IS NULL
  AND p.patient_registry_id IS NOT NULL;

-- Índice para a nova via de busca.
CREATE INDEX IF NOT EXISTS idx_receituarios_patient_registry_id
  ON public.receituarios(patient_registry_id);

COMMENT ON COLUMN public.receituarios.patient_registry_id IS
  'PESSOA (vinculo estavel) — segue o paciente entre leitos. Preferir a patient_id (linha-leito) na leitura.';
