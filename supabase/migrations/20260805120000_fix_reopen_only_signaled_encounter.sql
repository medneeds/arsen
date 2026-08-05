-- ════════════════════════════════════════════════════════════════════════
-- Suspensao/cancelamento de sinalizacao: reabrir APENAS o atendimento certo
-- ════════════════════════════════════════════════════════════════════════
-- 05/08/2026. Relatado: erro ao suspender sinalizacao de OBITO.
--
-- CAUSA — nao e especifica do obito. Duas funcoes vivas reabriam o atendimento
-- com o mesmo filtro largo demais:
--
--     UPDATE public.patient_encounters
--        SET status = 'active', discharge_date = NULL
--      WHERE patient_id = <id> AND status = 'closed';
--
-- Sem LIMIT e sem amarrar ao atendimento daquela sinalizacao. Como
-- `public.patients` e a tabela de LEITOS (tem bed_number, is_vacant), esse
-- filtro alcanca TODOS os atendimentos ja encerrados naquele leito — inclusive
-- os de ocupantes anteriores.
--
-- Dois modos de falha, um barulhento e um silencioso:
--
--  1) ERRO (o relatado): se o leito tem 2+ atendimentos encerrados do MESMO
--     prontuario (paciente reinternado no mesmo leito), o UPDATE reabre os
--     dois. O trigger enforce_one_open_encounter, criado depois destas funcoes
--     em 22/07, barra o segundo com ERRCODE 23505 e a suspensao inteira falha.
--     Nao aparecia para admin/gestor, que o trigger deixa passar — o que
--     explica o erro ser intermitente conforme quem tenta.
--
--  2) CORRUPCAO SILENCIOSA (pior): quando os atendimentos encerrados sao de
--     PACIENTES DIFERENTES que passaram pelo mesmo leito, os registry_id
--     diferem, o trigger nao ve conflito e nada falha — mas atendimentos de
--     pacientes que ja tiveram alta voltam a ficar 'active', com
--     discharge_date apagada.
--
-- O obito so aparece mais porque suspensao de obito e rara e recente; a alta e
-- a transferencia externa passam pelo mesmo caminho.
--
-- CORRECAO: um helper unico reabre UM atendimento so, preferindo o vinculo
-- explicito `discharge_documents.encounter_id` (que ja existe e nunca era
-- usado aqui) e caindo, na falta dele, no atendimento encerrado mais recente
-- DO PRONTUARIO — nunca do leito.
--
-- NAO ha reparo de dado nesta migration: nao da para saber quais atendimentos
-- foram reabertos indevidamente sem revisar caso a caso, e reencerrar em massa
-- seria repetir o erro na direcao oposta. A consulta de auditoria esta no
-- rodape.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public._reopen_signaled_encounter(
  p_encounter_id uuid,
  p_registry_id  uuid,
  p_patient_id   uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_target uuid;
BEGIN
  -- 1) Vinculo explicito: o atendimento que a propria sinalizacao encerrou.
  IF p_encounter_id IS NOT NULL THEN
    SELECT id INTO v_target
      FROM public.patient_encounters
     WHERE id = p_encounter_id AND status = 'closed';
  END IF;

  -- 2) Sem vinculo (registros antigos): o encerrado mais recente DO PRONTUARIO.
  --    Escopo por registry_id, nao por patient_id: patient_id e o LEITO, e o
  --    leito ja teve outros ocupantes.
  IF v_target IS NULL AND p_registry_id IS NOT NULL THEN
    SELECT id INTO v_target
      FROM public.patient_encounters
     WHERE registry_id = p_registry_id AND status = 'closed'
     ORDER BY discharge_date DESC NULLS LAST, updated_at DESC
     LIMIT 1;
  END IF;

  -- 3) Ultimo recurso: prontuario desconhecido. Restringe ao leito E exige que
  --    o atendimento seja do ocupante ATUAL, para nao tocar em ocupante antigo.
  IF v_target IS NULL AND p_patient_id IS NOT NULL THEN
    SELECT pe.id INTO v_target
      FROM public.patient_encounters pe
      JOIN public.patients p ON p.id = pe.patient_id
     WHERE pe.patient_id = p_patient_id
       AND pe.status = 'closed'
       AND (p.patient_registry_id IS NULL OR pe.registry_id = p.patient_registry_id)
     ORDER BY pe.discharge_date DESC NULLS LAST, pe.updated_at DESC
     LIMIT 1;
  END IF;

  IF v_target IS NULL THEN
    RETURN NULL;  -- nada a reabrir nao e erro: a sinalizacao segue suspensa
  END IF;

  UPDATE public.patient_encounters
     SET status = 'active', discharge_date = NULL, updated_at = now()
   WHERE id = v_target;

  RETURN v_target;
END;
$fn$;

REVOKE ALL ON FUNCTION public._reopen_signaled_encounter(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ── 1) Suspensao de ALTA e OBITO ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._suspend_discharge_document_internal(
  p_doc_id uuid,
  p_reason text,
  p_min_reason_len integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_doc record;
  v_actor_name text;
  v_actor_email text;
  v_actor_role text;
  v_movement_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF p_reason IS NULL OR length(btrim(p_reason)) < p_min_reason_len THEN
    RAISE EXCEPTION 'reason_too_short';
  END IF;

  SELECT * INTO v_doc FROM public.discharge_documents WHERE id = p_doc_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'doc_not_found';
  END IF;

  IF v_doc.suspended_at IS NOT NULL THEN
    RAISE EXCEPTION 'already_suspended';
  END IF;

  SELECT COALESCE(full_name, email), email INTO v_actor_name, v_actor_email
  FROM public.profiles WHERE id = v_uid;
  SELECT role::text INTO v_actor_role FROM public.user_roles WHERE user_id = v_uid LIMIT 1;

  UPDATE public.discharge_documents
     SET suspended_at = now(),
         suspended_by = v_uid,
         suspended_by_name = COALESCE(v_actor_name, 'Sistema'),
         suspension_reason = btrim(p_reason),
         updated_at = now()
   WHERE id = p_doc_id;

  v_movement_id := v_doc.movement_id;
  IF v_movement_id IS NOT NULL THEN
    UPDATE public.patient_movements
       SET status = 'cancelled', updated_at = now()
     WHERE id = v_movement_id AND status <> 'cancelled';
  END IF;

  IF v_doc.patient_id IS NOT NULL THEN
    UPDATE public.patients
       SET admission_status = 'admitido', updated_at = now()
     WHERE id = v_doc.patient_id;

    -- Reabre APENAS o atendimento desta sinalizacao (ver cabecalho da migration).
    PERFORM public._reopen_signaled_encounter(
      v_doc.encounter_id, v_doc.patient_registry_id, v_doc.patient_id);
  END IF;

  INSERT INTO public.audit_logs (user_id, user_email, user_role, action, table_name, record_id, new_data)
  VALUES (
    v_uid, v_actor_email, v_actor_role, 'UPDATE', 'discharge_documents', p_doc_id,
    jsonb_build_object(
      'op', CASE WHEN v_doc.document_type = 'obito' THEN 'SUSPEND_OBITO' ELSE 'SUSPEND_DISCHARGE' END,
      'reason', btrim(p_reason), 'patient_id', v_doc.patient_id,
      'patient_name', v_doc.patient_name, 'document_type', v_doc.document_type,
      'movement_id', v_movement_id, 'actor_name', COALESCE(v_actor_name, 'Sistema')
    )
  );

  RETURN jsonb_build_object('ok', true, 'doc_id', p_doc_id, 'movement_id', v_movement_id,
    'patient_id', v_doc.patient_id, 'document_type', v_doc.document_type);
END;
$fn$;
-- ── 2) Cancelamento de sinalizacao de TRANSFERENCIA ──────────────────────
CREATE OR REPLACE FUNCTION public.cancel_transfer_signal(
  p_patient_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_patient record;
  v_actor_name text;
  v_request_id uuid;
  v_cancelled_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'reason_too_short';
  END IF;

  SELECT * INTO v_patient FROM public.patients WHERE id = p_patient_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'patient_not_found';
  END IF;

  IF v_patient.admission_status NOT IN ('transferencia_interna_pendente', 'transferencia_externa_pendente') THEN
    RAISE EXCEPTION 'no_pending_signal';
  END IF;

  SELECT COALESCE(full_name, email) INTO v_actor_name
  FROM public.profiles WHERE id = v_uid;

  -- Interna: cancela TODOS os registros pendentes do paciente (nunca deixa
  -- nenhuma pendência órfã na fila, mesmo se houver mais de uma).
  IF v_patient.admission_status = 'transferencia_interna_pendente' THEN
    UPDATE public.internal_transfer_requests
       SET status = 'cancelled', cancelled_by = v_uid, cancelled_at = now(),
           cancellation_reason = btrim(p_reason), updated_at = now()
     WHERE source_patient_id = p_patient_id AND status = 'pending';
    GET DIAGNOSTICS v_cancelled_count = ROW_COUNT;

    -- Para o log de auditoria, pega uma referência (a mais recente) — sem
    -- risco de "more than one row" pois usa LIMIT 1 explícito.
    SELECT id INTO v_request_id
      FROM public.internal_transfer_requests
     WHERE source_patient_id = p_patient_id AND status = 'cancelled'
     ORDER BY cancelled_at DESC LIMIT 1;
  END IF;

  -- Externa: o encounter foi encerrado no momento da sinalização — reabre.
  IF v_patient.admission_status = 'transferencia_externa_pendente' THEN
    PERFORM public._reopen_signaled_encounter(
      NULL, v_patient.patient_registry_id, p_patient_id);
  END IF;

  UPDATE public.patients
     SET admission_status = 'admitido', updated_at = now()
   WHERE id = p_patient_id;

  INSERT INTO public.audit_logs (actor_id, actor_name, op, entity, entity_id, details)
  VALUES (
    v_uid, COALESCE(v_actor_name, 'Sistema'), 'CANCEL_TRANSFER_SIGNAL',
    'patients', p_patient_id,
    jsonb_build_object(
      'reason', btrim(p_reason), 'patient_name', v_patient.name,
      'previous_status', v_patient.admission_status, 'request_id', v_request_id,
      'requests_cancelled', COALESCE(v_cancelled_count, 0)
    )
  );

  RETURN jsonb_build_object('ok', true, 'patient_id', p_patient_id, 'request_id', v_request_id);
END;
$fn$;

-- CREATE OR REPLACE preserva as permissoes existentes, mas explicitar e barato
-- e deixa a migration auto-suficiente se for reaplicada num banco novo.
GRANT EXECUTE ON FUNCTION public.cancel_transfer_signal(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.suspend_discharge_document(uuid, text) TO authenticated;
-- A interna NAO e exposta: so o wrapper chama, e e ele que decide o minimo do motivo.
REVOKE ALL ON FUNCTION public._suspend_discharge_document_internal(uuid, text, integer) FROM PUBLIC, anon, authenticated;

-- ── Auditoria (rodar DEPOIS de aplicar) ───────────────────────────────────
-- Atendimentos possivelmente reabertos por engano pelo filtro antigo: estao
-- 'active' mas o leito ja pertence a outro prontuario.
--
--   SELECT pe.id, pe.patient_name, pe.encounter_code, pe.registry_id,
--          pe.updated_at, p.bed_number, p.patient_registry_id AS ocupante_atual
--   FROM public.patient_encounters pe
--   JOIN public.patients p ON p.id = pe.patient_id
--   WHERE pe.status = 'active'
--     AND p.patient_registry_id IS NOT NULL
--     AND pe.registry_id IS DISTINCT FROM p.patient_registry_id
--   ORDER BY pe.updated_at DESC;
--
-- Cada linha e um atendimento de ocupante ANTERIOR do leito que voltou a
-- ficar aberto. Revisar caso a caso antes de encerrar.
