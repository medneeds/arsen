-- Migration: repontar evoluções D1-D6 do José Ribamar Serra Camara — UTI 2 L12
-- Causa: migration 20260529212150 restaurou o paciente no L12 mas NÃO chamou
-- repoint_patient_history — evoluções D1-D6 ficaram vinculadas ao patient_id
-- do leito antes da desalocação indevida.
-- Esta migration é idempotente: verifica estado antes de agir.

DO $$
DECLARE
  v_patient_id   UUID := '5f4e8994-12a3-4641-b68c-f52a8a273642'; -- L12 UTI 2 atual
  v_registry_id  UUID := '9b91603e-fb06-4d5d-a246-bf20a8f4d1c2';
  v_hospital_unit_id UUID := '8297082d-bd9e-40da-a08b-8e3c0e53209f';
  v_state_id     UUID := 'f92ccaef-8f20-4025-bf8e-0bd64b0b5384';
  v_evol_count   INT;
BEGIN
  -- Guard: paciente deve estar ativo no L12
  IF NOT EXISTS (
    SELECT 1 FROM patients
    WHERE id = v_patient_id AND is_vacant = FALSE AND patient_registry_id = v_registry_id
  ) THEN
    RAISE NOTICE 'SKIP: L12 não está com José Ribamar ativo. Verificar estado.';
    RETURN;
  END IF;

  -- 1. Repontar evoluções vinculadas ao registry_id mas com patient_id diferente do atual
  --    (ficaram com patient_id do leito antes da desalocação indevida)
  UPDATE public.clinical_evolutions
  SET patient_id = v_patient_id,
      updated_at = NOW()
  WHERE patient_registry_id = v_registry_id
    AND patient_id <> v_patient_id
    AND archived_at IS NULL
    AND hospital_unit_id = v_hospital_unit_id;

  GET DIAGNOSTICS v_evol_count = ROW_COUNT;
  RAISE NOTICE 'Evoluções repontadas: %', v_evol_count;

  -- 2. Repontar evoluções sem registry_id que estavam no leito (fallback por nome)
  UPDATE public.clinical_evolutions
  SET patient_id = v_patient_id,
      patient_registry_id = v_registry_id,
      updated_at = NOW()
  WHERE patient_name ILIKE '%JOSE RIBAMAR SERRA CAMARA%'
    AND patient_sector = 'yellow'
    AND patient_bed = 'L12'
    AND archived_at IS NULL
    AND patient_id <> v_patient_id
    AND hospital_unit_id = v_hospital_unit_id;

  GET DIAGNOSTICS v_evol_count = ROW_COUNT;
  RAISE NOTICE 'Evoluções repontadas por nome: %', v_evol_count;

  -- 3. Garantir patient_registry_id em todas as evoluções do paciente
  UPDATE public.clinical_evolutions
  SET patient_registry_id = v_registry_id,
      updated_at = NOW()
  WHERE patient_id = v_patient_id
    AND patient_registry_id IS NULL
    AND archived_at IS NULL
    AND hospital_unit_id = v_hospital_unit_id;

  GET DIAGNOSTICS v_evol_count = ROW_COUNT;
  RAISE NOTICE 'Evoluções com registry_id preenchido: %', v_evol_count;

  -- 4. Auditoria
  INSERT INTO patient_movements (
    patient_id, patient_registry_id, patient_name, patient_bed, patient_sector,
    movement_type, destination, notes, state_id, hospital_unit_id
  ) VALUES (
    v_patient_id, v_registry_id,
    'JOSE RIBAMAR SERRA CAMARA', 'L12', 'yellow',
    'CORREÇÃO DE DADOS — EVOLUÇÕES REPONTADAS',
    'UTI 2 • Leito L12',
    'Migration de correção: evoluções D1-D6 repontadas para patient_id correto do L12. '
    'Causa: migration de resgate 20260529212150 não chamou repoint_patient_history.',
    v_state_id, v_hospital_unit_id
  );

  RAISE NOTICE 'SUCESSO: Evoluções de José Ribamar repontadas para L12.';
END $$;
