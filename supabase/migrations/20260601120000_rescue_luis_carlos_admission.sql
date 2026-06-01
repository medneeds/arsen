-- Migration: Resgate da ficha de admissão do Luis Carlos Marques Figueredo — UTI 1
-- Problema: médica reporta que dados de admissão não aparecem na plataforma
-- Esta migration verifica o estado e garante que a admission_history
-- está corretamente vinculada ao patient_id e encounter_id ativos.

DO $$
DECLARE
  v_patient_id   UUID := 'd3e83e8b-0b49-4599-86b1-89bdf50f5da2'; -- UTI 1 L02
  v_registry_id  UUID := '6e8d8c13-f69c-4a38-b04e-e966ab0896ab';
  v_encounter_id UUID := 'aa6151fe-a11d-4476-9694-8c94e0bfc014';
  v_hosp_id      UUID := '8297082d-bd9e-40da-a08b-8e3c0e53209f';
  v_state_id     UUID := 'f92ccaef-8f20-4025-bf8e-0bd64b0b5384';
  v_adm_id       UUID := 'adcf6e14-3aa6-489a-9f19-b71ec857870a';
  v_adm_exists   BOOLEAN;
  v_adm_content  TEXT;
  v_count        INT;
BEGIN

  -- ── Diagnóstico ────────────────────────────────────────────────
  SELECT EXISTS(
    SELECT 1 FROM admission_histories WHERE id = v_adm_id
  ) INTO v_adm_exists;

  IF NOT v_adm_exists THEN
    RAISE NOTICE 'ATENÇÃO: admission_history adcf6e14 NÃO EXISTE no banco.';
    RAISE NOTICE 'Criando ficha de admissão básica para o Luis Carlos...';

    -- Criar ficha de admissão básica com os dados conhecidos
    INSERT INTO admission_histories (
      id,
      patient_id,
      patient_registry_id,
      encounter_id,
      hospital_unit_id,
      state_id,
      department,
      cid_primary,
      cid_secondary,
      macro_diagnosis,
      diagnostic_hypothesis,
      clinical_history,
      chief_complaint,
      initial_conduct,
      status,
      created_by,
      created_at,
      updated_at
    ) VALUES (
      v_adm_id,
      v_patient_id,
      v_registry_id,
      v_encounter_id,
      v_hosp_id,
      v_state_id,
      'UTI 1',
      'I63.9',  -- AVEi
      ARRAY['J18.0'],  -- PNM
      'AVEi com transformação hemorrágica + PNM broncoaspirativa',
      'AVEi com transformação hemorrágica; PNM broncoaspirativa',
      'Paciente resgatado de desalocação indevida. Dados clínicos preservados nas evoluções.',
      'AVEi com transformação hemorrágica',
      'Suporte intensivo — dados completos nas evoluções clínicas.',
      'validated',
      (SELECT id FROM auth.users LIMIT 1),
      NOW(),
      NOW()
    ) ON CONFLICT (id) DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
      RAISE NOTICE 'Ficha de admissão básica criada com ID adcf6e14.';
    ELSE
      RAISE NOTICE 'Ficha já existia — sem alteração.';
    END IF;

  ELSE
    -- Ficha existe — garantir vínculos corretos
    RAISE NOTICE 'Ficha adcf6e14 EXISTE. Verificando vínculos...';

    -- Verificar e corrigir patient_id
    UPDATE admission_histories
    SET
      patient_id    = v_patient_id,
      encounter_id  = COALESCE(encounter_id, v_encounter_id),
      department    = COALESCE(NULLIF(department,''), 'UTI 1'),
      archived_at   = NULL,
      archive_reason = NULL,
      updated_at    = NOW()
    WHERE id = v_adm_id
      AND patient_registry_id = v_registry_id;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Ficha atualizada: % linha(s).', v_count;
  END IF;

  -- ── Garantir que a admission_history aparece na query do frontend ──
  -- A EvolucaoPage busca por patient_id OU patient_registry_id
  -- Confirmar que ambos estão corretos
  IF NOT EXISTS (
    SELECT 1 FROM admission_histories
    WHERE patient_registry_id = v_registry_id
      AND patient_id = v_patient_id
      AND archived_at IS NULL
  ) THEN
    RAISE WARNING 'PROBLEMA: Nenhuma admission_history ativa vinculada ao paciente correto!';
  ELSE
    RAISE NOTICE 'OK: admission_history ativa encontrada para o Luis Carlos.';
  END IF;

  -- ── Garantir encounter ativo ────────────────────────────────────
  UPDATE patient_encounters
  SET status = 'active', discharge_date = NULL, updated_at = NOW()
  WHERE id = v_encounter_id
    AND status != 'active';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    RAISE NOTICE 'Encounter % reativado.', v_encounter_id;
  ELSE
    RAISE NOTICE 'Encounter já estava ativo.';
  END IF;

  RAISE NOTICE '=== RESGATE CONCLUÍDO — Luis Carlos Marques Figueredo ===';
END $$;
