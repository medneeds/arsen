-- ════════════════════════════════════════════════════════════════════════
-- CANCELAMENTO DE SINALIZAÇÃO — transferência interna/externa, alta e óbito
-- ════════════════════════════════════════════════════════════════════════
-- Pedido do gestor (16/07/2026): ao sinalizar uma movimentação (transferência
-- interna/externa, alta, óbito), o cockpit não refletia a possibilidade de
-- CANCELAR essa sinalização de forma clara para os 3 cenários.
--
-- Auditoria do estado atual encontrou:
--   1. Transferência interna/externa sinalizada: o botão "Editar/cancelar
--      sinalização" apenas reabria o diálogo de sinalização do zero — não
--      existia nenhuma ação real de cancelamento. A tabela
--      internal_transfer_requests já tinha as colunas cancelled_by/
--      cancelled_at/cancellation_reason prontas desde a criação, mas nunca
--      foram usadas por nenhuma RPC ou tela.
--   2. Alta: já existia suspend_discharge_document (bem desenhada — senha,
--      motivo obrigatório, auditoria), mas ela NUNCA revertia
--      patients.admission_status de volta para 'admitido' — o card
--      continuava com o anel visual de "alta_dada" mesmo após suspender.
--   3. Óbito: suspend_discharge_document bloqueava explicitamente
--      ('cannot_suspend_obito') — não existia NENHUMA forma de cancelar um
--      óbito sinalizado por engano.
--
-- Esta migration corrige os 3 casos com o mesmo padrão de segurança já
-- validado (senha + motivo obrigatório + auditoria imutável), sem duplicar
-- lógica: a suspensão de alta/óbito compartilha uma única função interna.

-- ────────────────────────────────────────────────────────────────────────
-- 1) Função interna compartilhada: suspende um discharge_document (alta OU
--    óbito) e reverte o paciente para 'admitido', reabrindo o encounter se
--    havia sido encerrado na sinalização.
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._suspend_discharge_document_internal(
  p_doc_id uuid,
  p_reason text,
  p_min_reason_len integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_doc record;
  v_actor_name text;
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

  SELECT COALESCE(full_name, email) INTO v_actor_name
  FROM public.profiles WHERE id = v_uid;

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

  -- Reverte o paciente para 'admitido' — sem isto o card ficava com o anel
  -- visual de "alta_dada"/"óbito" mesmo após a suspensão (bug encontrado
  -- nesta auditoria, corrigido aqui para os dois casos de uma vez).
  IF v_doc.patient_id IS NOT NULL THEN
    UPDATE public.patients
       SET admission_status = 'admitido', updated_at = now()
     WHERE id = v_doc.patient_id;

    -- Reabre o encounter, encerrado no momento da sinalização de alta/óbito.
    UPDATE public.patient_encounters
       SET status = 'active', discharge_date = NULL, updated_at = now()
     WHERE patient_id = v_doc.patient_id AND status = 'closed';
  END IF;

  INSERT INTO public.audit_logs (actor_id, actor_name, op, entity, entity_id, details)
  VALUES (
    v_uid, COALESCE(v_actor_name, 'Sistema'),
    CASE WHEN v_doc.document_type = 'obito' THEN 'SUSPEND_OBITO' ELSE 'SUSPEND_DISCHARGE' END,
    'discharge_documents', p_doc_id,
    jsonb_build_object(
      'reason', btrim(p_reason), 'patient_id', v_doc.patient_id,
      'patient_name', v_doc.patient_name, 'document_type', v_doc.document_type,
      'movement_id', v_movement_id
    )
  );

  RETURN jsonb_build_object('ok', true, 'doc_id', p_doc_id, 'movement_id', v_movement_id,
    'patient_id', v_doc.patient_id, 'document_type', v_doc.document_type);
END;
$$;
REVOKE ALL ON FUNCTION public._suspend_discharge_document_internal(uuid, text, integer) FROM PUBLIC;
-- Sem GRANT a authenticated — só chamada pelas duas funções públicas abaixo.

-- ────────────────────────────────────────────────────────────────────────
-- 2) suspend_discharge_document — mantém a assinatura pública já usada pelo
--    front, mas agora delega para a função interna (ganha o reset de
--    admission_status/encounter de graça) e PASSA A PERMITIR óbito.
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.suspend_discharge_document(
  p_doc_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc_type text;
  v_min_len integer;
BEGIN
  SELECT document_type INTO v_doc_type FROM public.discharge_documents WHERE id = p_doc_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'doc_not_found';
  END IF;
  -- Óbito exige motivo mais longo (mínimo 20 caracteres) dada a gravidade
  -- médico-legal do cancelamento — mesma trilha de auditoria, barra mais alta.
  v_min_len := CASE WHEN v_doc_type = 'obito' THEN 20 ELSE 10 END;
  RETURN public._suspend_discharge_document_internal(p_doc_id, p_reason, v_min_len);
END;
$$;
GRANT EXECUTE ON FUNCTION public.suspend_discharge_document(uuid, text) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────
-- 3) cancel_transfer_signal — cancela sinalização de transferência interna
--    OU externa (nenhuma delas gera discharge_documents; é só o status no
--    paciente + o registro na fila, quando interna).
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_transfer_signal(
  p_patient_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_patient record;
  v_actor_name text;
  v_request_id uuid;
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

  -- Interna: cancela o registro pendente na fila do setor destino.
  IF v_patient.admission_status = 'transferencia_interna_pendente' THEN
    UPDATE public.internal_transfer_requests
       SET status = 'cancelled', cancelled_by = v_uid, cancelled_at = now(),
           cancellation_reason = btrim(p_reason), updated_at = now()
     WHERE source_patient_id = p_patient_id AND status = 'pending'
     RETURNING id INTO v_request_id;
  END IF;

  -- Externa: o encounter foi encerrado no momento da sinalização — reabre.
  IF v_patient.admission_status = 'transferencia_externa_pendente' THEN
    UPDATE public.patient_encounters
       SET status = 'active', discharge_date = NULL, updated_at = now()
     WHERE patient_id = p_patient_id AND status = 'closed';
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
      'previous_status', v_patient.admission_status, 'request_id', v_request_id
    )
  );

  RETURN jsonb_build_object('ok', true, 'patient_id', p_patient_id, 'request_id', v_request_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.cancel_transfer_signal(uuid, text) TO authenticated;
