-- Migration: 20260529211200_recover_luis_carlos_uti1_transfer.sql
-- Resgate de transferência interna perdida: Luis Carlos Marques Figueredo
-- Causa raiz: releaseBedPreAdmission chamado sem executeOperationalRelocation — 
-- leito de origem foi liberado sem copiar dados para o destino (UTI 1 L02).
-- Esta migration é idempotente: guards verificam estado antes de agir.
-- Já executada em produção em 2026-05-29. Mantida no codebase para rastreabilidade.

DO $$
DECLARE
  v_source_patient_id  UUID := '03c99838-6cac-4047-9922-7cf9d0a82ae4';
  v_target_patient_id  UUID := 'd3e83e8b-0b49-4599-86b1-89bdf50f5da2';
  v_registry_id        UUID := '6e8d8c13-f69c-4a38-b04e-e966ab0896ab';
  v_encounter_id       UUID := 'aa6151fe-a11d-4476-9694-8c94e0bfc014';
  v_hospital_unit_id   UUID := '8297082d-bd9e-40da-a08b-8e3c0e53209f';
  v_state_id           UUID := 'f92ccaef-8f20-4025-bf8e-0bd64b0b5384';
  v_repoint_result     jsonb;
BEGIN

  -- Guard 1: só executa se L02 ainda estiver vago
  IF NOT EXISTS (
    SELECT 1 FROM patients WHERE id = v_target_patient_id AND is_vacant = TRUE
  ) THEN
    RAISE NOTICE 'SKIP: UTI 1 L02 não está vago — migração já aplicada ou leito ocupado.';
    RETURN;
  END IF;

  -- Guard 2: encounter deve estar closed
  IF NOT EXISTS (
    SELECT 1 FROM patient_encounters WHERE id = v_encounter_id AND status = 'closed'
  ) THEN
    RAISE NOTICE 'SKIP: encounter não está "closed" — estado inesperado, abortando.';
    RETURN;
  END IF;

  -- 1. Restaurar dados clínicos no UTI 1 L02
  UPDATE patients SET
    name                     = 'LUIS CARLOS MARQUES FIGUEREDO',
    age                      = '62a',
    diagnoses                = 'AVEi com transformação hemorrágica' || chr(10) || 'PNM broncoaspirativa',
    medical_history          = 'HAS' || chr(10) || 'DM2',
    relevant_exams           = NULL,
    pendencies               = 'TQT',
    schedule                 = NULL,
    admission_history        = 'QUEIXA PRINCIPAL: Paciente internado com déficit neurológico, hemiplegia à esquerda. Familiares relatam que o paciente apresentou tais alterações já ao acordar.' || chr(10) ||
                               'HISTÓRIA CLÍNICA: Paciente internado com déficit neurológico, hemiplegia à esquerda. Familiares relatam que o paciente apresentou tais alterações já ao acordar.' || chr(10) ||
                               'HIPÓTESE DIAGNÓSTICA: I64 - Acidente vascular cerebral não especificado como hemorrágico ou isquêmico' || chr(10) ||
                               'CONDUTA INICIAL: - suporte neurológico;' || chr(10) || '- Antiagregação;' || chr(10) ||
                               '- Controle pressórico;' || chr(10) || '- TC de controle.',
    admission_date           = '2026-05-21',
    patient_registry_id      = v_registry_id,
    medical_record           = '182915-1',
    admission_status         = 'pre_admitido',
    admitted_at              = '2026-05-21T20:00:00+00:00',
    is_vacant                = FALSE,
    clinical_status          = 'potencialmente_grave',
    uti_admission_date       = '2026-05-17T00:00:00+00:00',
    uti_admission_reason     = 'Suporte neurológico',
    uti_allergies            = 'ndam',
    uti_cultures_antibiotics = 'ATB: Meropenem, amicacina e bactrim;' || chr(10) || 'Culturas: A. baumannii (ST) e S. haemolyticus',
    uti_current_status       = NULL,
    uti_daily_conducts       = 'Vigilância neurológica' || chr(10) || 'Insulinoterapia' || chr(10) || 'ATBterapia',
    uti_devices              = 'SNE 22/05/2026' || chr(10) || 'SVD 21/05/2026' || chr(10) || 'TOT 23/05/2026' || chr(10) || 'CVC 23/05/2026',
    uti_discharge_prediction = '10/06/2026',
    uti_origin_sector        = 'Vermelha',
    uti_specialties          = 'Neurologia.',
    uti_weight_kg            = NULL,
    medical_responsibility   = '{"type":"rotineiro","responsibleDoctorId":"02895017-54f4-4e05-a62e-686bb0ff8b89","responsibleDoctorName":"JULIANA FONSECA CAVALCANTE","responsibleDoctorCrm":"11164"}'::jsonb,
    updated_at               = NOW()
  WHERE id = v_target_patient_id AND is_vacant = TRUE;

  -- 2. Reabrir encounter e reassociar ao patient_id do UTI 1 L02
  UPDATE patient_encounters SET
    status     = 'active',
    patient_id = v_target_patient_id,
    updated_at = NOW()
  WHERE id = v_encounter_id AND status = 'closed';

  -- 3. Repontar histórico clínico para o novo patient_id
  SELECT repoint_patient_history(
    v_source_patient_id,
    v_target_patient_id,
    'Recuperação de transferência interna perdida: Luis Carlos Marques Figueredo — L09/outside → UTI 1 L02'
  ) INTO v_repoint_result;

  -- 4. Registrar auditoria
  INSERT INTO patient_movements (
    patient_id, patient_registry_id, patient_name, patient_bed, patient_sector,
    movement_type, destination, notes, state_id, hospital_unit_id,
    release_status, released_at
  ) VALUES (
    v_target_patient_id, v_registry_id,
    'LUIS CARLOS MARQUES FIGUEREDO', 'L02', 'red',
    'TRANSFERÊNCIA INTERNA — CONCLUÍDA',
    'UTI 1 • Leito L02',
    'Migration de resgate: releaseBedPreAdmission chamado sem executeOperationalRelocation — dados restaurados do snapshot dc6e0f4a, encounter aa6151fe reaberto, evoluções clínicas repontadas para UTI 1 L02.',
    v_state_id, v_hospital_unit_id, 'released', NOW()
  );

  RAISE NOTICE 'SUCESSO: Luis Carlos restaurado em UTI 1 L02, admission_status=pre_admitido, encounter ativo, histórico repontado.';

END $$;