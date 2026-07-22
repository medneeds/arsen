-- ════════════════════════════════════════════════════════════════════════
-- FIX: column "actor_id" of relation "audit_logs" does not exist
-- ════════════════════════════════════════════════════════════════════════
-- Reportado com print ao suspender sinalização de transferência.
--
-- Causa raiz: as 3 RPCs de suspensão/cancelamento (_suspend_discharge_
-- document_internal, cancel_transfer_signal) inseriam em audit_logs usando
-- colunas que NÃO EXISTEM nessa tabela: actor_id, actor_name, op, entity,
-- entity_id, details. O schema real de audit_logs (migration de 29/01/2026) é:
--   user_id, user_email, user_role, action (enum audit_action),
--   table_name, record_id, old_data, new_data, changed_fields, department...
--
-- Esse mesmo erro já existia na RPC ORIGINAL de suspender alta
-- (20260518230255) — herdado quando copiei o padrão dela. A suspensão de
-- alta provavelmente nunca chegou a registrar auditoria de fato; o INSERT
-- falhava e (dependendo do caminho) abortava a transação.
--
-- action é um enum restrito (INSERT/UPDATE/DELETE/SELECT/LOGIN/LOGOUT) — não
-- aceita rótulos livres como 'SUSPEND_DISCHARGE'. A ação real é uma
-- atualização de status, então usamos 'UPDATE' e guardamos o rótulo
-- semântico (op) dentro de new_data, exatamente como as RPCs corretas do
-- projeto já fazem (ex. 20260518211254).

-- ────────────────────────────────────────────────────────────────────────
-- 1) _suspend_discharge_document_internal — corrige o INSERT de auditoria
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

    UPDATE public.patient_encounters
       SET status = 'active', discharge_date = NULL, updated_at = now()
     WHERE patient_id = v_doc.patient_id AND status = 'closed';
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

-- ────────────────────────────────────────────────────────────────────────
-- 2) cancel_transfer_signal — corrige o INSERT de auditoria
-- ────────────────────────────────────────────────────────────────────────
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
  v_actor_email text;
  v_actor_role text;
  v_request_id uuid;
  v_cancelled_count integer;
  v_prev_status text;
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

  v_prev_status := v_patient.admission_status;

  IF v_prev_status NOT IN ('transferencia_interna_pendente', 'transferencia_externa_pendente') THEN
    RAISE EXCEPTION 'no_pending_signal';
  END IF;

  SELECT COALESCE(full_name, email), email INTO v_actor_name, v_actor_email
  FROM public.profiles WHERE id = v_uid;
  SELECT role::text INTO v_actor_role FROM public.user_roles WHERE user_id = v_uid LIMIT 1;

  IF v_prev_status = 'transferencia_interna_pendente' THEN
    UPDATE public.internal_transfer_requests
       SET status = 'cancelled', cancelled_by = v_uid, cancelled_at = now(),
           cancellation_reason = btrim(p_reason), updated_at = now()
     WHERE source_patient_id = p_patient_id AND status = 'pending';
    GET DIAGNOSTICS v_cancelled_count = ROW_COUNT;

    SELECT id INTO v_request_id
      FROM public.internal_transfer_requests
     WHERE source_patient_id = p_patient_id AND status = 'cancelled'
     ORDER BY cancelled_at DESC LIMIT 1;
  END IF;

  IF v_prev_status = 'transferencia_externa_pendente' THEN
    UPDATE public.patient_encounters
       SET status = 'active', discharge_date = NULL, updated_at = now()
     WHERE patient_id = p_patient_id AND status = 'closed';
  END IF;

  UPDATE public.patients
     SET admission_status = 'admitido', updated_at = now()
   WHERE id = p_patient_id;

  INSERT INTO public.audit_logs (user_id, user_email, user_role, action, table_name, record_id, new_data)
  VALUES (
    v_uid, v_actor_email, v_actor_role, 'UPDATE', 'patients', p_patient_id,
    jsonb_build_object(
      'op', 'CANCEL_TRANSFER_SIGNAL', 'reason', btrim(p_reason),
      'patient_name', v_patient.name, 'previous_status', v_prev_status,
      'request_id', v_request_id, 'requests_cancelled', COALESCE(v_cancelled_count, 0),
      'actor_name', COALESCE(v_actor_name, 'Sistema')
    )
  );

  RETURN jsonb_build_object('ok', true, 'patient_id', p_patient_id, 'request_id', v_request_id);
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.cancel_transfer_signal(uuid, text) TO authenticated;
