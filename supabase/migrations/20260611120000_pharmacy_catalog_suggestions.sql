-- ──────────────────────────────────────────────────────────────────────────
-- Migration: Sugestões farmacêuticas no catálogo clínico
--
-- Adiciona à tabela medication_presentations:
--   iv_bolus                   → indica administração em bolus (sem diluição/tempo)
--   pharmacy_suggestion_enabled → ativa o popup de sugestão automática na prescrição
--
-- Atualiza RLS para permitir que usuários com role 'farmacia' editem
-- os campos de evidência clínica (standard_dilution, infusion_time,
-- max_daily_dose, iv_bolus, pharmacy_suggestion_enabled).
-- ──────────────────────────────────────────────────────────────────────────

-- 1. Novas colunas
ALTER TABLE medication_presentations
  ADD COLUMN IF NOT EXISTS iv_bolus boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pharmacy_suggestion_enabled boolean NOT NULL DEFAULT false;

-- 2. Comentários documentando o propósito
COMMENT ON COLUMN medication_presentations.iv_bolus IS
  'Quando true, o medicamento deve ser administrado em bolus EV (sem diluição adicional nem tempo de infusão).';
COMMENT ON COLUMN medication_presentations.pharmacy_suggestion_enabled IS
  'Quando true, ao prescrever este medicamento o sistema exibe um popup de sugestão automática com os dados da farmácia clínica (diluição, tempo, bolus).';

-- 3. RLS — permitir que farmacia edite campos de evidência clínica
-- (mantém o select público para médicos leitores)

-- Dropar a policy de update existente (somente admin) e recriar incluindo farmacia
DROP POLICY IF EXISTS "admin_update_presentations" ON medication_presentations;
DROP POLICY IF EXISTS "catalog_update_clinical_evidence" ON medication_presentations;

CREATE POLICY "catalog_update_clinical_evidence"
  ON medication_presentations
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'farmacia')
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'farmacia')
  );
