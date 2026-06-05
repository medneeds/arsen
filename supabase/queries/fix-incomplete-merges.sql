-- ════════════════════════════════════════════════════════════════════
-- DIAGNÓSTICO E CORREÇÃO: merges incompletos
-- ════════════════════════════════════════════════════════════════════
--
-- Contexto: a versão da merge de 20/05 não repontava 9 tabelas.
-- Qualquer merge executado entre 20/05 e hoje deixou registros
-- dessas tabelas ainda apontando para o prontuário perdedor.
--
-- PASSO 1: Diagnosticar — quantos registros afetados por tabela.
-- PASSO 2: Corrigir — repontar para o prontuário vencedor.
--
-- Rodar no SQL Editor do Supabase.
-- ════════════════════════════════════════════════════════════════════

-- ── PASSO 1: Diagnóstico ─────────────────────────────────────────────

-- Identifica todos os prontuários que foram perdedores em merges
-- e ainda têm registros nas tabelas que faltaram ser repontadas.
WITH losers AS (
  SELECT
    pr.id                       AS loser_id,
    pr.merged_into_registry_id  AS winner_id,
    pr.merged_at,
    pr.merged_by
  FROM patient_registry pr
  WHERE pr.merged_into_registry_id IS NOT NULL
    AND pr.merged_at IS NOT NULL
)
SELECT
  l.loser_id,
  l.winner_id,
  l.merged_at,
  (SELECT count(*) FROM admission_histories       WHERE patient_registry_id = l.loser_id) AS admission_histories_pendentes,
  (SELECT count(*) FROM culture_results           WHERE patient_registry_id = l.loser_id) AS culture_results_pendentes,
  (SELECT count(*) FROM conduct_history           WHERE patient_registry_id = l.loser_id) AS conduct_history_pendentes,
  (SELECT count(*) FROM patient_movements         WHERE patient_registry_id = l.loser_id) AS patient_movements_pendentes,
  (SELECT count(*) FROM dhd_patients              WHERE patient_registry_id = l.loser_id) AS dhd_patients_pendentes,
  (SELECT count(*) FROM pre_admissions            WHERE patient_registry_id = l.loser_id) AS pre_admissions_pendentes,
  (SELECT count(*) FROM discharge_documents       WHERE patient_registry_id = l.loser_id) AS discharge_documents_pendentes,
  (SELECT count(*) FROM medical_record_edit_history WHERE patient_registry_id = l.loser_id) AS med_rec_history_pendentes,
  (SELECT count(*) FROM patient_registry_edit_history WHERE patient_registry_id = l.loser_id) AS reg_edit_history_pendentes,
  (SELECT count(*) FROM patient_admission_date_history WHERE patient_registry_id = l.loser_id) AS admission_date_history_pendentes,
  (SELECT count(*) FROM prescriptions             WHERE patient_registry_id = l.loser_id) AS prescriptions_pendentes
FROM losers l
ORDER BY l.merged_at DESC;

-- ── PASSO 2: Correção — executar só após revisar o PASSO 1 ───────────
-- Repointa todos os registros pendentes de merges incompletos.
-- Rodar apenas se o PASSO 1 retornar linhas com contagens > 0.

DO $$
DECLARE
  r RECORD;
  total_fixed int := 0;
  n int;
BEGIN
  FOR r IN
    SELECT id AS loser_id, merged_into_registry_id AS winner_id
    FROM patient_registry
    WHERE merged_into_registry_id IS NOT NULL
      AND merged_at IS NOT NULL
  LOOP
    UPDATE admission_histories
       SET patient_registry_id = r.winner_id
     WHERE patient_registry_id = r.loser_id;
    GET DIAGNOSTICS n = ROW_COUNT; total_fixed := total_fixed + n;

    UPDATE culture_results
       SET patient_registry_id = r.winner_id
     WHERE patient_registry_id = r.loser_id;
    GET DIAGNOSTICS n = ROW_COUNT; total_fixed := total_fixed + n;

    UPDATE conduct_history
       SET patient_registry_id = r.winner_id
     WHERE patient_registry_id = r.loser_id;
    GET DIAGNOSTICS n = ROW_COUNT; total_fixed := total_fixed + n;

    UPDATE patient_movements
       SET patient_registry_id = r.winner_id
     WHERE patient_registry_id = r.loser_id;
    GET DIAGNOSTICS n = ROW_COUNT; total_fixed := total_fixed + n;

    UPDATE dhd_patients
       SET patient_registry_id = r.winner_id
     WHERE patient_registry_id = r.loser_id;
    GET DIAGNOSTICS n = ROW_COUNT; total_fixed := total_fixed + n;

    UPDATE pre_admissions
       SET patient_registry_id = r.winner_id
     WHERE patient_registry_id = r.loser_id;
    GET DIAGNOSTICS n = ROW_COUNT; total_fixed := total_fixed + n;

    UPDATE discharge_documents
       SET patient_registry_id = r.winner_id
     WHERE patient_registry_id = r.loser_id;
    GET DIAGNOSTICS n = ROW_COUNT; total_fixed := total_fixed + n;

    UPDATE medical_record_edit_history
       SET patient_registry_id = r.winner_id
     WHERE patient_registry_id = r.loser_id;
    GET DIAGNOSTICS n = ROW_COUNT; total_fixed := total_fixed + n;

    UPDATE patient_registry_edit_history
       SET patient_registry_id = r.winner_id
     WHERE patient_registry_id = r.loser_id;
    GET DIAGNOSTICS n = ROW_COUNT; total_fixed := total_fixed + n;

    UPDATE patient_admission_date_history
       SET patient_registry_id = r.winner_id
     WHERE patient_registry_id = r.loser_id;
    GET DIAGNOSTICS n = ROW_COUNT; total_fixed := total_fixed + n;

    UPDATE prescriptions
       SET patient_registry_id = r.winner_id
     WHERE patient_registry_id = r.loser_id;
    GET DIAGNOSTICS n = ROW_COUNT; total_fixed := total_fixed + n;
  END LOOP;

  RAISE NOTICE 'Correção concluída: % registros repontados', total_fixed;
END $$;
