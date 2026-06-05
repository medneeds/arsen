
-- ════════════════════════════════════════════════════════════════════
-- execute_operational_relocation_atomic
-- Encapsula o remanejamento operacional em uma única transação.
-- ════════════════════════════════════════════════════════════════════
--
-- PROBLEMA CORRIGIDO:
--   executeOperationalRelocation fazia 5 operações independentes:
--     1. UPDATE patients (destino) ← commitado
--     2. CALL repoint_patient_history ← commitado separado
--     3. CALL archive_patient_bed_data ← commitado separado
--     4. UPDATE patients (origem = vazio) ← commitado separado
--     5. INSERT patient_movements ← commitado separado
--
--   Falha em qualquer passo deixava o banco em estado inconsistente.
--
-- SOLUÇÃO:
--   Passos 1-4 dentro de uma única transação PL/pgSQL.
--   Passo 5 (auditoria) isolado — falha no log não desfaz o remanejamento.
--
-- DEPLOY SEGURO:
--   O TypeScript detecta se esta função existe (erro 42883 = não existe)
--   e cai automaticamente para o código sequencial anterior.
--   Pode ser aplicada antes ou depois do deploy do frontend — sem risco.
--
-- ROLLBACK:
--   DROP FUNCTION public.execute_operational_relocation_atomic(uuid,uuid,text,uuid,uuid,text,uuid);
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.execute_operational_relocation_atomic(
  p_source_patient_id uuid,
  p_target_patient_id uuid,
  p_reason            text,
  p_hospital_unit_id  uuid,
  p_state_id          uuid,
  p_department        text DEFAULT NULL,
  p_created_by        uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_source             public.patients%ROWTYPE;
  v_target_bed_number  text;
  v_target_sector      text;
  v_movement_id        uuid;
BEGIN
  IF p_source_patient_id IS NULL OR p_target_patient_id IS NULL THEN
    RAISE EXCEPTION 'source e target são obrigatórios';
  END IF;
  IF p_source_patient_id = p_target_patient_id THEN
    RAISE EXCEPTION 'Leito de origem e destino são iguais';
  END IF;

  -- Lê e bloqueia os dois leitos para evitar condição de corrida
  SELECT * INTO v_source
    FROM public.patients
   WHERE id = p_source_patient_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leito de origem não encontrado: %', p_source_patient_id;
  END IF;

  SELECT bed_number, sector
    INTO v_target_bed_number, v_target_sector
    FROM public.patients
   WHERE id = p_target_patient_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leito de destino não encontrado: %', p_target_patient_id;
  END IF;

  -- ── PASSO 1: Popula destino com dados clínicos da origem ─────────────────
  UPDATE public.patients SET
    name                     = v_source.name,
    age                      = v_source.age,
    diagnoses                = v_source.diagnoses,
    medical_history          = v_source.medical_history,
    relevant_exams           = v_source.relevant_exams,
    pendencies               = v_source.pendencies,
    schedule                 = v_source.schedule,
    admission_history        = v_source.admission_history,
    admission_date           = v_source.admission_date,
    highlighted_diagnoses    = v_source.highlighted_diagnoses,
    highlighted_medical_history = v_source.highlighted_medical_history,
    highlighted_pendencies   = v_source.highlighted_pendencies,
    highlighted_conducts     = v_source.highlighted_conducts,
    medical_responsibility   = v_source.medical_responsibility,
    uti_admission_date       = v_source.uti_admission_date,
    uti_discharge_prediction = v_source.uti_discharge_prediction,
    uti_allergies            = v_source.uti_allergies,
    uti_admission_reason     = v_source.uti_admission_reason,
    uti_current_status       = v_source.uti_current_status,
    uti_devices              = v_source.uti_devices,
    uti_cultures_antibiotics = v_source.uti_cultures_antibiotics,
    uti_specialties          = v_source.uti_specialties,
    uti_origin_sector        = v_source.uti_origin_sector,
    uti_daily_conducts       = v_source.uti_daily_conducts,
    uti_weight_kg            = v_source.uti_weight_kg,
    internment_status        = v_source.internment_status,
    internment_notes         = v_source.internment_notes,
    clinical_status          = v_source.clinical_status,
    psm_status               = v_source.psm_status,
    patient_registry_id      = v_source.patient_registry_id,
    medical_record           = v_source.medical_record,
    admission_status         = v_source.admission_status,
    admitted_at              = v_source.admitted_at,
    is_vacant                = false,
    updated_at               = now()
  WHERE id = p_target_patient_id;

  -- ── PASSO 2: Repointa histórico clínico ──────────────────────────────────
  PERFORM public.repoint_patient_history(
    p_source_patient_id,
    p_target_patient_id,
    'Remanejamento operacional: ' || p_reason
  );

  -- ── PASSO 3: Arquiva dados residuais da origem (segurança pós-repoint) ───
  -- Após o repoint, clinical_evolutions/prescriptions já têm patient_id = target.
  -- archive_patient_bed_data encontrará 0 registros clínicos — é uma rede de
  -- segurança que garante que nenhum dado órfão permaneça na origem.
  PERFORM public.archive_patient_bed_data(
    p_source_patient_id,
    'operational_relocation_source_release'
  );

  -- ── PASSO 4: Esvazia leito de origem ─────────────────────────────────────
  UPDATE public.patients SET
    name                     = '',
    age                      = NULL,
    diagnoses                = NULL,
    medical_history          = NULL,
    relevant_exams           = NULL,
    pendencies               = NULL,
    schedule                 = NULL,
    admission_history        = NULL,
    admission_date           = NULL,
    highlighted_diagnoses    = NULL,
    highlighted_medical_history = NULL,
    highlighted_pendencies   = NULL,
    highlighted_conducts     = NULL,
    medical_responsibility   = NULL,
    uti_admission_date       = NULL,
    uti_discharge_prediction = NULL,
    uti_allergies            = NULL,
    uti_admission_reason     = NULL,
    uti_current_status       = NULL,
    uti_devices              = NULL,
    uti_cultures_antibiotics = NULL,
    uti_specialties          = NULL,
    uti_origin_sector        = NULL,
    uti_daily_conducts       = NULL,
    uti_weight_kg            = NULL,
    internment_status        = NULL,
    internment_notes         = NULL,
    clinical_status          = NULL,
    psm_status               = NULL,
    patient_registry_id      = NULL,
    medical_record           = NULL,
    admission_status         = NULL,
    admitted_at              = NULL,
    is_vacant                = true,
    updated_at               = now()
  WHERE id = p_source_patient_id;

  -- ── PASSO 5: Auditoria em patient_movements (não-bloqueante) ─────────────
  -- Falha aqui NÃO desfaz os passos 1-4. O remanejamento já ocorreu.
  BEGIN
    INSERT INTO public.patient_movements (
      patient_id,
      patient_name,
      patient_bed,
      patient_sector,
      patient_registry_id,
      movement_type,
      destination,
      notes,
      created_by,
      department,
      state_id,
      hospital_unit_id,
      patient_snapshot
    ) VALUES (
      p_target_patient_id,
      v_source.name,
      v_source.bed_number,
      v_source.sector,
      v_source.patient_registry_id,
      'REMANEJAMENTO_OPERACIONAL',
      v_target_bed_number || ' (' || COALESCE(v_target_sector, '?') || ')',
      p_reason,
      p_created_by,
      p_department,
      p_state_id,
      p_hospital_unit_id,
      to_jsonb(v_source)
    ) RETURNING id INTO v_movement_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[execute_operational_relocation_atomic] falha ao registrar patient_movements: % | source=% target=%',
      SQLERRM, p_source_patient_id, p_target_patient_id;
  END;

  RETURN jsonb_build_object(
    'success',     true,
    'source_id',   p_source_patient_id,
    'target_id',   p_target_patient_id,
    'movement_id', v_movement_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_operational_relocation_atomic(
  uuid, uuid, text, uuid, uuid, text, uuid
) TO authenticated;
