-- ════════════════════════════════════════════════════════════════════════
-- FIX: não é possível excluir leito extra que já teve paciente admitido
-- ════════════════════════════════════════════════════════════════════════
-- Reportado com print: leito extra criado E com paciente admitido não pode
-- ser excluído ("Não foi possível excluir o leito"); leito extra virgem
-- (nunca admitido) exclui normalmente.
--
-- Causa raiz: deletePatient() faz DELETE da linha em patients para leitos
-- extras. Levantamento das FKs que referenciam patients(id) mostrou que
-- TODAS tratam o delete (CASCADE ou SET NULL) — EXCETO uma:
--   sepsis_protocols.patient_id → NO ACTION
-- Se o paciente daquele leito extra teve um protocolo de sepse aberto, essa
-- FK bloqueia o DELETE, e o leito fica preso. Leito virgem nunca teve
-- protocolo, por isso exclui sem problema.
--
-- Correção: alinha sepsis_protocols ao mesmo padrão das outras tabelas de
-- documento clínico (clinical_evolutions, receituarios, saps3_assessments,
-- medical_records, exam_requests, regulatory_guides... todas SET NULL):
-- ON DELETE SET NULL. Isso PRESERVA o protocolo de sepse no histórico —
-- só desvincula do registro de leito que está sendo removido. Nenhum dado
-- clínico é perdido (CASCADE apagaria o protocolo, o que seria inaceitável).
--
-- Descobre o nome real da constraint dinamicamente (foi criada inline, sem
-- nome explícito, então o Postgres gerou o nome padrão).

DO $fix$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT tc.constraint_name INTO v_constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'sepsis_protocols'
    AND kcu.column_name = 'patient_id'
    AND ccu.table_name = 'patients'
  LIMIT 1;

  IF v_constraint_name IS NULL THEN
    RAISE NOTICE 'FK de sepsis_protocols.patient_id não encontrada — nada a fazer.';
    RETURN;
  END IF;

  EXECUTE format('ALTER TABLE public.sepsis_protocols DROP CONSTRAINT %I', v_constraint_name);

  ALTER TABLE public.sepsis_protocols
    ADD CONSTRAINT sepsis_protocols_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE SET NULL;

  RAISE NOTICE 'FK sepsis_protocols.patient_id agora é ON DELETE SET NULL (era %).', v_constraint_name;
END;
$fix$;
