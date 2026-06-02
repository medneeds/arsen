DO $$
DECLARE
  v_patient_id       UUID := '83bdfe28-dad2-4de0-9222-f7ac1968ed23';
  v_registry_id      UUID := '187a8274-ad1d-47e6-ba0d-febc3e69036a';
  v_encounter_id     UUID := '46d2a77a-4485-4aba-9a6b-2a26245f3a39';
  v_movement_id      UUID := '86a580b7-6434-4840-baa8-50190cf69b1f';
  v_hospital_unit_id UUID := '8297082d-bd9e-40da-a08b-8e3c0e53209f';
  v_state_id         UUID := 'f92ccaef-8f20-4025-bf8e-0bd64b0b5384';
  v_archive_result   jsonb;
BEGIN
  IF EXISTS (SELECT 1 FROM patients WHERE id = v_patient_id AND is_vacant = TRUE) THEN
    RAISE NOTICE 'SKIP: UCC L03 já está vago.'; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM patient_encounters WHERE id = v_encounter_id AND status = 'closed') THEN
    RAISE NOTICE 'SKIP: encounter já está closed.'; RETURN;
  END IF;
  SELECT archive_patient_bed_data(v_patient_id, 'alta_hospitalar_liberacao_pendente_26mai2026') INTO v_archive_result;
  UPDATE patients SET name='', age=NULL, diagnoses=NULL, medical_history=NULL, relevant_exams=NULL, pendencies=NULL, schedule=NULL, admission_history=NULL, admission_date=NULL, patient_registry_id=NULL, medical_record=NULL, admission_status=NULL, admitted_at=NULL, is_vacant=TRUE, clinical_status=NULL, medical_responsibility=NULL, uti_admission_date=NULL, uti_admission_reason=NULL, uti_allergies=NULL, uti_cultures_antibiotics=NULL, uti_current_status=NULL, uti_daily_conducts=NULL, uti_devices=NULL, uti_discharge_prediction=NULL, uti_origin_sector=NULL, uti_specialties=NULL, uti_weight_kg=NULL, internment_status=NULL, internment_notes=NULL, psm_status=NULL, allocation_status=NULL, is_door_patient=FALSE, highlighted_pendencies=ARRAY[]::integer[], highlighted_diagnoses=ARRAY[]::integer[], highlighted_medical_history=ARRAY[]::integer[], highlighted_conducts=ARRAY[]::integer[], updated_at=NOW() WHERE id = v_patient_id AND is_vacant = FALSE;
  UPDATE patient_encounters SET status='closed', discharge_date='2026-05-26 13:17:26+00', updated_at=NOW() WHERE id = v_encounter_id AND status = 'active';
  UPDATE patient_movements SET release_status='released', released_at=NOW(), released_by_name='Migration: liberação pendente 26/05/2026' WHERE id = v_movement_id AND release_status = 'pending_release';
  INSERT INTO patient_movements (patient_id, patient_registry_id, patient_name, patient_bed, patient_sector, movement_type, destination, notes, state_id, hospital_unit_id, release_status, released_at) VALUES (v_patient_id, v_registry_id, 'DIOGO COSTA DE ASSUNCAO', 'L03', 'ucc', 'ALTA_HOSPITALAR', 'PRONTUÁRIO PRESERVADO — LEITO LIBERADO', 'Migration de resgate: alta sinalizada em 26/05/2026 com pending_release nunca confirmado. Leito liberado com archive prévio. Encounter 46d2a77a fechado.', v_state_id, v_hospital_unit_id, 'released', NOW());
  RAISE NOTICE 'SUCESSO: UCC L03 liberado, encounter fechado, histórico preservado.';
END $$;