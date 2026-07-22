-- ════════════════════════════════════════════════════════════════════════
-- FIX: column "medical_responsibility" is of type jsonb but expression is text
-- ════════════════════════════════════════════════════════════════════════
-- Reportado com print ao fazer alocação direta de um paciente desalocado
-- (transferência interna → alocação no leito destino).
--
-- Causa raiz: na migration 20260716181000 (cópia dinâmica de dados clínicos
-- na movimentação — auditoria de preservação de 16/07), o UPDATE de
-- complete_internal_transfer_atomic extraía medical_responsibility com ->>
-- (retorna TEXT), mas a coluna é JSONB. Postgres recusa text direto em jsonb.
--
-- Bug irmão na mesma linha: hospital_discharge_prediction é DATE, gravada
-- via ->> sem cast nem guarda de vazio — quebraria com '' ou formato ruim.
--
-- Correção: reescreve a função com a definição REAL (mantida integralmente),
-- alterando apenas as 2 linhas desses campos. Demais campos são TEXT e o ->>
-- está correto para eles.
CREATE OR REPLACE FUNCTION public.complete_internal_transfer_atomic(
  p_request_id uuid, p_target_patient_id uuid, p_destination jsonb,
  p_hospital_unit_id uuid, p_state_id uuid,
  p_repoint_reason text DEFAULT NULL::text,
  p_current_user_id uuid DEFAULT NULL::uuid,
  p_department text DEFAULT NULL::text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_req            record;
  v_source_id      uuid;
  v_classification text;
  v_needs_saps     boolean;
  v_movement_id    uuid;
BEGIN
  IF p_request_id IS NULL OR p_target_patient_id IS NULL THEN
    RAISE EXCEPTION 'request_id e target_patient_id são obrigatórios';
  END IF;
  SELECT * INTO v_req FROM public.internal_transfer_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request não encontrado: %', p_request_id; END IF;
  IF v_req.status != 'pending' THEN RAISE EXCEPTION 'Request já está %', v_req.status; END IF;
  v_source_id := v_req.source_patient_id;
  v_classification := v_req.classification;
  v_needs_saps := v_req.requires_saps;
  UPDATE public.patients SET
    name = (p_destination->>'name'),
    age = (p_destination->>'age'),
    diagnoses = (p_destination->>'diagnoses'),
    medical_history = (p_destination->>'medical_history'),
    relevant_exams = (p_destination->>'relevant_exams'),
    pendencies = (p_destination->>'pendencies'),
    schedule = (p_destination->>'schedule'),
    admission_history = (p_destination->>'admission_history'),
    admission_date = CASE WHEN p_destination->>'admission_date' IS NOT NULL
                       AND p_destination->>'admission_date' != ''
                       THEN (p_destination->>'admission_date')::timestamptz ELSE NULL END,
    highlighted_diagnoses = CASE
      WHEN p_destination->'highlighted_diagnoses' IS NOT NULL
        AND jsonb_typeof(p_destination->'highlighted_diagnoses') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(p_destination->'highlighted_diagnoses')::integer)
      ELSE NULL END,
    highlighted_medical_history = CASE
      WHEN p_destination->'highlighted_medical_history' IS NOT NULL
        AND jsonb_typeof(p_destination->'highlighted_medical_history') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(p_destination->'highlighted_medical_history')::integer)
      ELSE NULL END,
    highlighted_pendencies = CASE
      WHEN p_destination->'highlighted_pendencies' IS NOT NULL
        AND jsonb_typeof(p_destination->'highlighted_pendencies') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(p_destination->'highlighted_pendencies')::integer)
      ELSE NULL END,
    highlighted_conducts = CASE
      WHEN p_destination->'highlighted_conducts' IS NOT NULL
        AND jsonb_typeof(p_destination->'highlighted_conducts') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(p_destination->'highlighted_conducts')::integer)
      ELSE NULL END,
    uti_admission_date = CASE WHEN p_destination->>'uti_admission_date' IS NOT NULL
                            AND p_destination->>'uti_admission_date' != ''
                            THEN (p_destination->>'uti_admission_date')::timestamptz ELSE NULL END,
    uti_discharge_prediction = (p_destination->>'uti_discharge_prediction'),
    uti_allergies = (p_destination->>'uti_allergies'),
    uti_admission_reason = (p_destination->>'uti_admission_reason'),
    uti_current_status = (p_destination->>'uti_current_status'),
    uti_devices = (p_destination->>'uti_devices'),
    uti_cultures_antibiotics = (p_destination->>'uti_cultures_antibiotics'),
    uti_specialties = (p_destination->>'uti_specialties'),
    uti_origin_sector = (p_destination->>'uti_origin_sector'),
    uti_daily_conducts = (p_destination->>'uti_daily_conducts'),
    clinical_status = (p_destination->>'clinical_status'),
    psm_status = (p_destination->>'psm_status'),
    admission_status = (p_destination->>'admission_status'),
    admitted_at = CASE WHEN p_destination->>'admitted_at' IS NOT NULL
                    AND p_destination->>'admitted_at' != ''
                    THEN (p_destination->>'admitted_at')::timestamptz ELSE NULL END,
    patient_registry_id = CASE WHEN p_destination->>'patient_registry_id' IS NOT NULL
                            THEN (p_destination->>'patient_registry_id')::uuid ELSE NULL END,
    medical_record = (p_destination->>'medical_record'),
    -- Campos adicionados pela auditoria de preservação (16/07/2026):
    -- medical_responsibility é JSONB — usar -> (não ->>) p/ não virar texto.
    -- Fix de 21/07/2026 (erro "column ... is of type jsonb but expression is text").
    medical_responsibility = COALESCE(p_destination->'medical_responsibility', 'null'::jsonb),
    internment_status = (p_destination->>'internment_status'),
    internment_notes = (p_destination->>'internment_notes'),
    uti_weight_kg = CASE WHEN p_destination->>'uti_weight_kg' IS NOT NULL
                       AND p_destination->>'uti_weight_kg' != ''
                       THEN (p_destination->>'uti_weight_kg')::numeric ELSE NULL END,
    is_palliative = COALESCE((p_destination->>'is_palliative')::boolean, false),
    isolation_precautions = (p_destination->>'isolation_precautions'),
    -- hospital_discharge_prediction é DATE — cast explícito + guarda de vazio.
    hospital_discharge_prediction = CASE
      WHEN p_destination->>'hospital_discharge_prediction' IS NOT NULL
       AND p_destination->>'hospital_discharge_prediction' != ''
      THEN (p_destination->>'hospital_discharge_prediction')::date ELSE NULL END,
    is_door_patient = COALESCE((p_destination->>'is_door_patient')::boolean, false),
    is_vacant = false, updated_at = now()
  WHERE id = p_target_patient_id;
  PERFORM public.repoint_patient_history(v_source_id, p_target_patient_id,
    COALESCE(p_repoint_reason, 'Transferência interna (etapa 2)'));
  UPDATE public.internal_transfer_requests
     SET status = 'completed', completed_by = p_current_user_id, completed_at = now(),
         completed_target_patient_id = p_target_patient_id
   WHERE id = p_request_id;
  BEGIN
    UPDATE public.admission_histories SET patient_id = p_target_patient_id, updated_at = now()
     WHERE patient_id = v_source_id AND archived_at IS NULL;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[complete_internal_transfer_atomic] falha admission_histories: %', SQLERRM;
  END;
  BEGIN
    INSERT INTO public.patient_movements (patient_id, patient_name, patient_bed, patient_sector,
      patient_registry_id, movement_type, destination, notes, created_by, department,
      state_id, hospital_unit_id, patient_snapshot)
    VALUES (p_target_patient_id, v_req.patient_name, v_req.source_bed, v_req.source_sector,
      (p_destination->>'patient_registry_id')::uuid,
      'TRANSFERÊNCIA INTERNA — CONCLUÍDA', p_target_patient_id::text,
      'Etapa 2/2 — Alocação concluída (' || COALESCE(v_classification, 'N/A') || ')'
        || CASE WHEN v_needs_saps THEN ' — SAPS 3 pendente no destino.' ELSE '' END,
      p_current_user_id, p_department, p_state_id, p_hospital_unit_id, v_req.patient_snapshot)
    RETURNING id INTO v_movement_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[complete_internal_transfer_atomic] falha audit: % | request=%',
      SQLERRM, p_request_id;
  END;
  RETURN jsonb_build_object('success', true, 'request_id', p_request_id,
    'source_id', v_source_id, 'target_id', p_target_patient_id,
    'classification', v_classification, 'needs_saps', v_needs_saps,
    'movement_id', v_movement_id);
END;
$$;
