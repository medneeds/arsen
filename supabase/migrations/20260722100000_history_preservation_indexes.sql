-- ════════════════════════════════════════════════════════════════════════
-- AUDITORIA 22/07/2026 — ÍNDICES DE FK + PRESERVAÇÃO DE HISTÓRICO
-- ════════════════════════════════════════════════════════════════════════
-- APLICADA NO STAGING EM 22/07/2026 (via SQL Editor, em etapas).
--
-- Versão DEFENSIVA: durante a aplicação descobrimos que o schema real do
-- banco diverge do git — 'saps' não existe, 'dhd_patients' e 'pre_admissions'
-- não têm coluna patient_id (a migration antiga do repoint no git referencia
-- essas tabelas, mas a função REAL no banco não as menciona). Por isso os
-- índices são criados condicionalmente à existência da coluna, tornando a
-- migration aplicável em qualquer ambiente.
--
-- Nota: round_sessions foi excluída da lista — o UNIQUE composto existente
-- (patient_id, round_date, hospital_unit_id) já cobre lookups por paciente.
-- admission_histories/medical_records tinham apenas índices PARCIAIS
-- (WHERE archived_at IS NULL), inúteis para o repoint que atualiza TODAS as
-- linhas — o índice completo é necessário.

-- ── Parte 1: índices condicionais ─────────────────────────────────────────
DO $idx$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sepsis_protocols','medical_records','admission_histories',
                           'saps','dhd_patients','pre_admissions','bed_allocation_requests']
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = t
                 AND column_name = 'patient_id') THEN
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_patient_id ON public.%I(patient_id)', t, t);
    END IF;
  END LOOP;
END
$idx$;

-- ── Parte 2: FK do histórico de transferências → SET NULL ─────────────────
-- internal_transfer_requests.source_patient_id era ON DELETE CASCADE: se a
-- linha do paciente-origem fosse deletada, o registro HISTÓRICO da
-- transferência era apagado junto. Requests concluídos são histórico de
-- movimentação — devem sobreviver: SET NULL.
--
-- ACHADO FORENSE na aplicação: a primeira tentativa de ADD CONSTRAINT falhou
-- porque existiam 2 requests ÓRFÃOS (source apontando para pacientes
-- inexistentes) — impossível sob FK CASCADE ativa. Confirma que a deleção em
-- massa de julho/2026 contornou as FKs (acesso direto ao banco), consistente
-- com a investigação da patient_registry. Os órfãos são anulados (request
-- preservado, referência limpa) no mesmo bloco atômico.
DO $fix$
DECLARE
  v_con text;
  v_orfaos int;
BEGIN
  SELECT con.conname INTO v_con
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY (con.conkey)
  WHERE rel.relname = 'internal_transfer_requests'
    AND con.contype = 'f' AND att.attname = 'source_patient_id'
  LIMIT 1;

  ALTER TABLE public.internal_transfer_requests
    ALTER COLUMN source_patient_id DROP NOT NULL;

  UPDATE public.internal_transfer_requests r
     SET source_patient_id = NULL
   WHERE r.source_patient_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.id = r.source_patient_id);
  GET DIAGNOSTICS v_orfaos = ROW_COUNT;

  IF v_con IS NOT NULL AND v_con <> 'internal_transfer_requests_source_patient_id_fkey' THEN
    EXECUTE format('ALTER TABLE public.internal_transfer_requests DROP CONSTRAINT %I', v_con);
  ELSIF v_con = 'internal_transfer_requests_source_patient_id_fkey' THEN
    -- Reaplicação: só recria se ainda for CASCADE
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = v_con AND confdeltype = 'c') THEN
      EXECUTE format('ALTER TABLE public.internal_transfer_requests DROP CONSTRAINT %I', v_con);
    ELSE
      RAISE NOTICE 'FK já é SET NULL — nada a fazer (órfãos anulados: %).', v_orfaos;
      RETURN;
    END IF;
  END IF;

  ALTER TABLE public.internal_transfer_requests
    ADD CONSTRAINT internal_transfer_requests_source_patient_id_fkey
    FOREIGN KEY (source_patient_id) REFERENCES public.patients(id) ON DELETE SET NULL;

  RAISE NOTICE 'Órfãos anulados: % | FK recriada como SET NULL.', v_orfaos;
END
$fix$;
