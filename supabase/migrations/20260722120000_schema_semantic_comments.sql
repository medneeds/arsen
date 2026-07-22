-- ════════════════════════════════════════════════════════════════════════
-- CLAREZA SEMÂNTICA (Nível 3) — COMMENTs que corrigem a nomenclatura enganosa
-- ════════════════════════════════════════════════════════════════════════
-- 22/07/2026. Descoberta na auditoria: os nomes das tabelas INVERTEM o
-- significado do modelo de negócio de 3 níveis. Renomear é caro e arriscado
-- (21 FKs, ~20 RPCs SECURITY DEFINER, RLS, realtime); estes COMMENTs
-- documentam a verdade no proprio schema, sem migração destrutiva, para que
-- devs e ferramentas (inclusive IA que inspeciona o banco) não caiam na
-- armadilha de tratar patients/patient_id como "a pessoa".
--
-- MODELO DE 3 NÍVEIS (regra de negócio essencial):
--   • patient_registry   = a PESSOA (prontuário único, permanente; N atendimentos)
--   • patient_encounters = o ATENDIMENTO (uma internação, início→alta; readmissão = novo)
--   • patients           = o LEITO (slot físico REUTILIZÁVEL entre ocupantes)
-- Dado clínico deve se ancorar em encounter_id + patient_registry_id.
-- Ancorar só em patient_id (=linha-leito) VAZA dados entre ocupantes.

COMMENT ON TABLE public.patients IS
  'LEITOS (nome histórico enganoso). Cada linha é um LEITO físico reutilizável '
  '(bed_number, is_vacant), NÃO uma pessoa. A pessoa é patient_registry; o '
  'atendimento é patient_encounters. As colunas patient_id nas tabelas-filhas '
  'referenciam ESTA linha-leito (patients.id) — por isso dado clínico deve '
  'sempre ser filtrado/repontado por encounter_id + patient_registry_id, nunca '
  'só por patient_id, sob risco de vazar entre ocupantes do leito.';

COMMENT ON TABLE public.patient_registry IS
  'PESSOA / PRONTUÁRIO — identidade permanente e única do paciente. Pode conter '
  'MÚLTIPLOS patient_encounters ao longo do tempo (readmissões após alta). '
  'Este é o vínculo estável que segue a pessoa entre leitos e internações.';

COMMENT ON TABLE public.patient_encounters IS
  'ATENDIMENTO — uma internação específica, do início à alta (status=closed). '
  'Readmissão após alta é um encounter NOVO sob o mesmo patient_registry_id; '
  'o histórico de um atendimento NÃO deve se misturar com o de outro.';

-- Colunas patient_id nas tabelas clínicas: apontam para a linha-LEITO.
DO $c$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'vital_signs','round_sessions','conduct_history','culture_results',
    'exam_requests','discharge_documents','clinical_evolutions',
    'admission_histories','prescriptions','medical_records'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name=t AND column_name='patient_id') THEN
      EXECUTE format(
        'COMMENT ON COLUMN public.%I.patient_id IS %L',
        t,
        'FK para patients.id = a linha-LEITO (reutilizável), NÃO a pessoa. '
        'Para isolar o paciente/atendimento use patient_registry_id + encounter_id.'
      );
    END IF;
  END LOOP;
END
$c$;
