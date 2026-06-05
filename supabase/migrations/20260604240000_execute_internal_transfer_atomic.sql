
-- ════════════════════════════════════════════════════════════════════
-- execute_internal_transfer_atomic
-- Encapsula a transferência interna em uma única transação PostgreSQL.
-- ════════════════════════════════════════════════════════════════════
--
-- PROBLEMA CORRIGIDO:
--   O fluxo anterior realizava 4 operações independentes em TypeScript:
--     1. UPDATE patients (destino) ← commitado
--     2. CALL repoint_patient_history ← commitado separado
--     3. UPDATE patients (origem = vazio) ← commitado separado
--     4. INSERT patient_movements ← commitado separado
--
--   Se qualquer operação falhasse depois da anterior, o banco ficava
--   em estado inconsistente (destino com paciente, origem também, ou
--   histórico não migrado). Não havia rollback automático.
--
-- SOLUÇÃO:
--   Os passos 1-3 executam dentro de uma única transação PL/pgSQL.
--   Se qualquer passo 1-3 lançar exceção → ROLLBACK automático de tudo.
--   O banco nunca fica com o paciente em dois leitos simultaneamente.
--
--   O passo 4 (auditoria em patient_movements) está isolado em bloco
--   BEGIN...EXCEPTION: falha no log NÃO desfaz a transferência clínica.
--   Prioridade: a transferência do paciente é crítica; o log é secundário.
--
-- ROLLBACK DESTA MIGRATION:
--   O TypeScript em internalTransfer.ts precisa ser revertido junto.
--   git checkout src/lib/internalTransfer.ts
--
-- AVISO:
--   Esta função substitui a lógica de executeInternalTransfer() em
--   TypeScript. Testar manualmente o fluxo completo de transferência
--   (lateral, escalada, desescalada) antes de aplicar em produção.
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.execute_internal_transfer_atomic(
  p_source_patient_id   uuid,
  p_target_patient_id   uuid,
  p_needs_saps          boolean DEFAULT false,
  p_needs_new_admission boolean DEFAULT false,
  p_reason              text    DEFAULT 'INTERNAL_TRANSFER',
  p_created_by          uuid    DEFAULT NULL,
  p_hospital_unit_id    uuid    DEFAULT NULL,
  p_state_id            uuid    DEFAULT NULL,
  p_department          text    DEFAULT NULL,
  p_classification      text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_source              public.patients%ROWTYPE;
  v_target_bed_number   text;
  v_target_sector       text;
  v_destination_status  text;
BEGIN
  -- ── Validações básicas ────────────────────────────────────────────────────
  IF p_source_patient_id IS NULL OR p_target_patient_id IS NULL THEN
    RAISE EXCEPTION 'source e target são obrigatórios';
  END IF;
  IF p_source_patient_id = p_target_patient_id THEN
    RAISE EXCEPTION 'source e target devem ser leitos diferentes';
  END IF;

  -- ── Lê o leito de origem com lock exclusivo ───────────────────────────────
  -- FOR UPDATE garante que nenhuma outra transação modifica o leito de origem
  -- enquanto esta operação está em andamento (evita condição de corrida).
  SELECT * INTO v_source
    FROM public.patients
   WHERE id = p_source_patient_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leito de origem não encontrado: %', p_source_patient_id;
  END IF;

  -- ── Lê dados do leito destino para o registro de auditoria ───────────────
  SELECT bed_number, sector
    INTO v_target_bed_number, v_target_sector
    FROM public.patients
   WHERE id = p_target_patient_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leito de destino não encontrado: %', p_target_patient_id;
  END IF;

  -- ── Determina status de admissão do destino ───────────────────────────────
  v_destination_status := CASE
    WHEN p_needs_saps          THEN 'saps_pendente'
    WHEN p_needs_new_admission THEN 'pre_admitido'
    ELSE COALESCE(v_source.admission_status, 'admitido')
  END;

  -- ── PASSO 1: Popula o leito destino com os dados do paciente ─────────────
  -- Copia todos os campos clínicos da origem para o destino.
  -- Os dados já estão em formato de banco (timestamptz, text) — sem conversão.
  UPDATE public.patients SET
    name                     = v_source.name,
    age                      = v_source.age,
    diagnoses                = v_source.diagnoses,
    medical_history          = v_source.medical_history,
    relevant_exams           = v_source.relevant_exams,
    pendencies               = v_source.pendencies,
    schedule                 = v_source.schedule,
    admission_date           = v_source.admission_date,
    highlighted_diagnoses    = v_source.highlighted_diagnoses,
    highlighted_medical_history = v_source.highlighted_medical_history,
    highlighted_pendencies   = v_source.highlighted_pendencies,
    highlighted_conducts     = v_source.highlighted_conducts,
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
    clinical_status          = v_source.clinical_status,
    psm_status               = v_source.psm_status,
    -- Em escalada: destino começa sem admission_history (nova admissão clínica)
    admission_history        = CASE WHEN p_needs_new_admission THEN NULL ELSE v_source.admission_history END,
    patient_registry_id      = v_source.patient_registry_id,
    medical_record           = v_source.medical_record,
    admission_status         = v_destination_status,
    -- Em escalada: admitted_at fica null até D0 ser preenchido no destino
    admitted_at              = CASE WHEN p_needs_new_admission THEN NULL ELSE v_source.admitted_at END,
    is_vacant                = false,
    updated_at               = now()
  WHERE id = p_target_patient_id;

  -- ── PASSO 2: Repointa o histórico clínico ────────────────────────────────
  -- Chama a RPC existente (v4) que já é atômica internamente.
  -- Erros críticos (clinical_evolutions, prescriptions) propagam aqui
  -- e causam ROLLBACK de toda a transação — incluindo o UPDATE do passo 1.
  PERFORM public.repoint_patient_history(
    p_source_patient_id,
    p_target_patient_id,
    p_reason
  );

  -- ── PASSO 3: Esvazia o leito de origem ───────────────────────────────────
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
    clinical_status          = NULL,
    psm_status               = NULL,
    admission_status         = NULL,
    patient_registry_id      = NULL,
    medical_record           = NULL,
    admitted_at              = NULL,
    is_vacant                = true,
    updated_at               = now()
  WHERE id = p_source_patient_id;

  -- ── PASSO 4: Registra auditoria em patient_movements ─────────────────────
  -- ISOLADO em bloco BEGIN...EXCEPTION: falha aqui NÃO desfaz a transferência.
  -- A transferência clínica (passos 1-3) é o que não pode falhar.
  -- O log de auditoria é secundário — se falhar, a transferência já ocorreu
  -- e o registro pode ser inserido manualmente se necessário.
  --
  -- Campos obrigatórios (NOT NULL sem DEFAULT):
  --   hospital_unit_id ← COALESCE(param, v_source) — nunca null para paciente ativo
  --   state_id         ← idem
  --   movement_type    ← hardcoded — sempre preenchido
  --   patient_name     ← v_source.name — sempre preenchido para paciente ativo
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
      'TRANSFERÊNCIA INTERNA',
      v_target_bed_number || ' (' || COALESCE(v_target_sector, '?') || ')',
      COALESCE(p_reason, 'Transferência interna')
        || ' — classificação: ' || COALESCE(p_classification, 'N/A')
        || CASE WHEN p_needs_saps THEN ' — SAPS 3 pendente.' ELSE '' END,
      p_created_by,
      p_department,
      COALESCE(p_state_id,         v_source.state_id),
      COALESCE(p_hospital_unit_id, v_source.hospital_unit_id),
      -- Snapshot do estado do paciente ANTES da transferência.
      -- v_source foi lido com FOR UPDATE no início da função,
      -- capturando os dados exatos no momento da operação.
      to_jsonb(v_source)
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log visível no console do Supabase mas não aborta a transação.
    RAISE WARNING '[execute_internal_transfer_atomic] falha ao registrar patient_movements: % | source=% target=%',
      SQLERRM, p_source_patient_id, p_target_patient_id;
  END;

  RETURN jsonb_build_object(
    'success',        true,
    'source_id',      p_source_patient_id,
    'target_id',      p_target_patient_id,
    'classification', p_classification,
    'needs_saps',     p_needs_saps,
    'destination_status', v_destination_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_internal_transfer_atomic(
  uuid, uuid, boolean, boolean, text, uuid, uuid, uuid, text, text
) TO authenticated;
