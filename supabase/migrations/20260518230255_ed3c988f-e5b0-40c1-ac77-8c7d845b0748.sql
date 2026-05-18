-- Suspensão de alta hospitalar (cockpit)
ALTER TABLE public.discharge_documents
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_by uuid,
  ADD COLUMN IF NOT EXISTS suspended_by_name text,
  ADD COLUMN IF NOT EXISTS suspension_reason text;

CREATE INDEX IF NOT EXISTS idx_discharge_documents_active
  ON public.discharge_documents (patient_id)
  WHERE suspended_at IS NULL;

-- RPC: suspende a alta + cancela movimentação ligada + grava auditoria
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
  v_uid uuid := auth.uid();
  v_doc record;
  v_actor_name text;
  v_movement_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'reason_too_short';
  END IF;

  SELECT * INTO v_doc FROM public.discharge_documents WHERE id = p_doc_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'doc_not_found';
  END IF;

  IF v_doc.document_type = 'obito' THEN
    RAISE EXCEPTION 'cannot_suspend_obito';
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
       SET status = 'cancelled',
           updated_at = now()
     WHERE id = v_movement_id
       AND status <> 'cancelled';
  END IF;

  INSERT INTO public.audit_logs (actor_id, actor_name, op, entity, entity_id, details)
  VALUES (
    v_uid,
    COALESCE(v_actor_name, 'Sistema'),
    'SUSPEND_DISCHARGE',
    'discharge_documents',
    p_doc_id,
    jsonb_build_object(
      'reason', btrim(p_reason),
      'patient_id', v_doc.patient_id,
      'patient_name', v_doc.patient_name,
      'document_type', v_doc.document_type,
      'movement_id', v_movement_id
    )
  );

  RETURN jsonb_build_object('ok', true, 'doc_id', p_doc_id, 'movement_id', v_movement_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.suspend_discharge_document(uuid, text) TO authenticated;