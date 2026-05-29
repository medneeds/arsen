-- Migration: 20260529212000_recover_jose_ribamar_uti2_l12.sql
-- Resgate de desalocação indevida: Jose Ribamar Serra Camara — UTI 2 L12
-- Causa raiz: releaseBedPreAdmission chamado após sinal de transferência interna
-- sem executeOperationalRelocation — paciente não transferido fisicamente.
-- Idempotente: guards verificam is_vacant e status do encounter antes de agir.
-- Já executada em produção em 2026-05-29.

DO $$
DECLARE
  v_patient_id       UUID := '5f4e8994-12a3-4641-b68c-f52a8a273642';
  v_registry_id      UUID := '9b91603e-fb06-4d5d-a246-bf20a8f4d1c2';
  v_encounter_id     UUID := '07c193ee-8798-47d7-b2dc-410bda05cec0';
  v_hospital_unit_id UUID := '8297082d-bd9e-40da-a08b-8e3c0e53209f';
  v_state_id         UUID := 'f92ccaef-8f20-4025-bf8e-0bd64b0b5384';
BEGIN

  -- Guard 1: só executa se L12 ainda estiver vago
  IF NOT EXISTS (
    SELECT 1 FROM patients WHERE id = v_patient_id AND is_vacant = TRUE
  ) THEN
    RAISE NOTICE 'SKIP: UTI 2 L12 não está vago — migração já aplicada.';
    RETURN;
  END IF;

  -- Guard 2: encounter deve estar closed
  IF NOT EXISTS (
    SELECT 1 FROM patient_encounters WHERE id = v_encounter_id AND status = 'closed'
  ) THEN
    RAISE NOTICE 'SKIP: encounter não está "closed" — estado inesperado, abortando.';
    RETURN;
  END IF;

  -- 1. Restaurar dados clínicos em UTI 2 L12
  UPDATE patients SET
    name                     = 'JOSE RIBAMAR SERRA CAMARA',
    age                      = '58 anos',
    diagnoses                = 'Epilepsia' || chr(10) || 'Encefalopatia de Wernicke' || chr(10) || 'Pneumonia',
    medical_history          = NULL,
    relevant_exams           = NULL,
    pendencies               = 'Otimizadas medidas para broncodilatação + sedoanalgesia' || chr(10) ||
                               'Programação de TQT para amanhã' || chr(10) ||
                               'Nova gasometria para as 15h > Em vigilância para critérios de SARA',
    schedule                 = NULL,
    admission_history        = 'QUEIXA PRINCIPAL: Paciente etilista crônico, previamente epiléptico, encaminhado à sala vermelha por hipoglicemia após ingestão alcoólica recente.' || chr(10) ||
                               'HIPÓTESE DIAGNÓSTICA: R56 - Convulsões não classificadas em outra parte' || chr(10) ||
                               'CONDUTA INICIAL: Admissão, exames de rotina, culturas, desmame de sedoanalgesia e VM conforme tolerado.',
    admission_date           = '2026-05-19',
    patient_registry_id      = v_registry_id,
    medical_record           = NULL,
    admission_status         = 'admitido',
    admitted_at              = '2026-05-22T11:05:59.497+00:00',
    is_vacant                = FALSE,
    clinical_status          = 'grave',
    uti_admission_date       = '2026-05-16T00:00:00+00:00',
    uti_admission_reason     = 'Necessidade de suporte e monitorização contínua' || chr(10) ||
                               'Risco de deterioramento clínico' || chr(10) ||
                               'Controle rigoroso de sinais vitais e balanço hídrico' || chr(10) ||
                               'Distúrbios hidroeletrolíticos e ácido-base críticos',
    uti_allergies            = 'NDAM',
    uti_cultures_antibiotics = 'Em curso  - Ceftriaxona e Clindamicina',
    uti_current_status       = NULL,
    uti_daily_conducts       = NULL,
    uti_devices              = 'IOT' || chr(10) || 'SVD' || chr(10) || 'SNE',
    uti_discharge_prediction = '2026-06-05',
    uti_origin_sector        = 'Sala vermelha',
    uti_specialties          = NULL,
    uti_weight_kg            = NULL,
    medical_responsibility   = NULL,
    updated_at               = NOW()
  WHERE id = v_patient_id AND is_vacant = TRUE;

  -- 2. Reabrir encounter e zerar discharge_date
  UPDATE patient_encounters SET
    status         = 'active',
    discharge_date = NULL,
    updated_at     = NOW()
  WHERE id = v_encounter_id AND status = 'closed';

  -- 3. Auditoria
  INSERT INTO patient_movements (
    patient_id, patient_registry_id, patient_name, patient_bed, patient_sector,
    movement_type, destination, notes, state_id, hospital_unit_id,
    release_status, released_at
  ) VALUES (
    v_patient_id, v_registry_id,
    'JOSE RIBAMAR SERRA CAMARA', 'L12', 'yellow',
    'TRANSFERÊNCIA INTERNA — CONCLUÍDA',
    'UTI 2 • Leito L12 (restaurado)',
    'Migration de resgate: releaseBedPreAdmission chamado indevidamente após sinal de transferência. Paciente não transferido fisicamente. Dados restaurados do snapshot 3b7f56e7. Encounter 07c193ee reaberto.',
    v_state_id, v_hospital_unit_id,
    'released', NOW()
  );

  RAISE NOTICE 'SUCESSO: Jose Ribamar restaurado em UTI 2 L12, admission_status=admitido, encounter ativo.';

END $$;