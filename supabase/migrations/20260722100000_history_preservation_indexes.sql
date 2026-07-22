-- ════════════════════════════════════════════════════════════════════════
-- AUDITORIA 22/07/2026 — ÍNDICES DE FK + PRESERVAÇÃO DE HISTÓRICO
-- ════════════════════════════════════════════════════════════════════════
-- Parte 1: 8 tabelas clínicas com FK patient_id (CASCADE ou repontadas pelo
-- repoint_patient_history) NÃO tinham índice na coluna — todo repoint
-- (UPDATE ... WHERE patient_id = X) e todo DELETE em patients fazia seq scan
-- nessas tabelas, segurando locks durante movimentações.
--
-- Parte 2: internal_transfer_requests.source_patient_id era ON DELETE CASCADE:
-- se a linha do paciente de origem fosse deletada (ex. exclusão de leito
-- extra), o REGISTRO HISTÓRICO da transferência era apagado junto. O request
-- concluído é histórico de movimentação — deve sobreviver: SET NULL.
-- (O front já foi blindado para ARQUIVAR leitos extras com histórico em vez
-- de deletar; esta FK é a segunda linha de defesa no banco.)

-- ── Parte 1: índices ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_round_sessions_patient_id        ON public.round_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_sepsis_protocols_patient_id      ON public.sepsis_protocols(patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_patient_id       ON public.medical_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_admission_histories_patient_id   ON public.admission_histories(patient_id);
CREATE INDEX IF NOT EXISTS idx_saps_patient_id                  ON public.saps(patient_id);
CREATE INDEX IF NOT EXISTS idx_dhd_patients_patient_id          ON public.dhd_patients(patient_id);
CREATE INDEX IF NOT EXISTS idx_pre_admissions_patient_id        ON public.pre_admissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_bed_allocation_requests_patient_id ON public.bed_allocation_requests(patient_id);

-- ── Parte 2: FK de histórico de transferências ────────────────────────────
DO $fix$
DECLARE
  v_con text;
BEGIN
  -- Descobre o nome real da constraint de source_patient_id → patients
  SELECT con.conname INTO v_con
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY (con.conkey)
  WHERE rel.relname = 'internal_transfer_requests'
    AND con.contype = 'f'
    AND att.attname = 'source_patient_id'
  LIMIT 1;

  IF v_con IS NOT NULL THEN
    -- SET NULL exige coluna nullable
    BEGIN
      ALTER TABLE public.internal_transfer_requests
        ALTER COLUMN source_patient_id DROP NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- já era nullable
    END;
    EXECUTE format('ALTER TABLE public.internal_transfer_requests DROP CONSTRAINT %I', v_con);
    ALTER TABLE public.internal_transfer_requests
      ADD CONSTRAINT internal_transfer_requests_source_patient_id_fkey
      FOREIGN KEY (source_patient_id) REFERENCES public.patients(id) ON DELETE SET NULL;
  END IF;
END
$fix$;
