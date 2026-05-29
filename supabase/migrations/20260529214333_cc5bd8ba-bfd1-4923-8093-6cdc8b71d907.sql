DO $$
DECLARE
  v_patient_id uuid := 'd3e83e8b-0b49-4599-86b1-89bdf50f5da2';
  v_registry_id uuid := '6e8d8c13-f69c-4a38-b04e-e966ab0896ab';
  v_canonical_enc uuid := 'aa6151fe-a11d-4476-9694-8c94e0bfc014';
  v_dup_enc uuid := 'ac92da9c-c1e7-49cf-8114-82204fbd15fd';
  v_source_patient_id uuid := '03c99838-6cac-4047-9922-7cf9d0a82ae4';
  v_unarchived int;
  v_stamped_pres int;
BEGIN
  -- 1. Desarquivar evoluções do encounter canônico
  UPDATE clinical_evolutions
     SET archived_at = NULL, archive_reason = NULL, archived_from_patient_id = NULL
   WHERE patient_id = v_patient_id
     AND patient_registry_id = v_registry_id
     AND encounter_id = v_canonical_enc
     AND archived_at IS NOT NULL;
  GET DIAGNOSTICS v_unarchived = ROW_COUNT;
  RAISE NOTICE 'Evoluções desarquivadas: %', v_unarchived;

  -- 2. Reabrir encounter canônico como ativo de UTI 1
  UPDATE patient_encounters
     SET status = 'active', discharge_date = NULL, department = 'UTI 1', updated_at = NOW()
   WHERE id = v_canonical_enc;
  RAISE NOTICE 'Encounter canônico aa6151fe reaberto em UTI 1.';

  -- 3. Remover encounter duplicado se vazio
  IF NOT EXISTS (
    SELECT 1 FROM clinical_evolutions WHERE encounter_id = v_dup_enc
    UNION ALL SELECT 1 FROM prescriptions WHERE encounter_id = v_dup_enc
    UNION ALL SELECT 1 FROM admission_histories WHERE encounter_id = v_dup_enc
  ) THEN
    DELETE FROM patient_encounters WHERE id = v_dup_enc;
    RAISE NOTICE 'Encounter duplicado ac92da9c removido (vazio).';
  ELSE
    UPDATE patient_encounters
       SET status = 'closed', discharge_date = COALESCE(discharge_date, NOW()), updated_at = NOW()
     WHERE id = v_dup_enc;
    RAISE NOTICE 'Encounter duplicado ac92da9c fechado (tinha dados).';
  END IF;

  -- 4. Carimbar encounter_id nas prescrições do registry
  UPDATE prescriptions
     SET encounter_id = v_canonical_enc
   WHERE patient_registry_id = v_registry_id AND encounter_id IS NULL;
  GET DIAGNOSTICS v_stamped_pres = ROW_COUNT;
  RAISE NOTICE 'Prescrições carimbadas: %', v_stamped_pres;

  -- 5. Remover admission_history órfã (source_patient, sem registry, redundante)
  DELETE FROM admission_histories
   WHERE id = '7a9d3c89-8471-41ca-80c2-bf2ee5d7cf10'
     AND patient_id = v_source_patient_id
     AND patient_registry_id IS NULL;
  RAISE NOTICE 'Admission órfã 7a9d3c89 removida.';

  -- 6. Repontar admission_history do Luis Carlos para o patient atual
  UPDATE admission_histories
     SET patient_id = v_patient_id,
         encounter_id = COALESCE(encounter_id, v_canonical_enc)
   WHERE id = 'adcf6e14-3aa6-489a-9f19-b71ec857870a'
     AND patient_registry_id = v_registry_id;
  RAISE NOTICE 'Admission adcf6e14 repontada para patient atual.';

  RAISE NOTICE 'RESGATE OK — Luis Carlos: % evoluções, % prescrições. Encounter aa6151fe (cód 162) ativo em UTI 1.',
    v_unarchived, v_stamped_pres;
END $$;