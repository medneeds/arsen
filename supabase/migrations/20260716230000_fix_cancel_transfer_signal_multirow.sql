-- ════════════════════════════════════════════════════════════════════════
-- FIX: "query returned more than one row" ao cancelar sinalização de
-- transferência interna
-- ════════════════════════════════════════════════════════════════════════
-- Causa raiz: a checagem de idempotência em PatientMovementDialog só evita
-- duplicata quando o NOVO destino é IGUAL ao já pendente
-- (.eq("target_sector_code", sectorCode)). Se o médico sinaliza para o
-- Setor A e depois sinaliza de novo para o Setor B sem cancelar o
-- primeiro, cria-se uma SEGUNDA linha 'pending' para o mesmo paciente — a
-- fila do setor destino já ficava incoerente, e cancel_transfer_signal
-- quebrava de vez, porque fazia
-- "UPDATE ... RETURNING id INTO v_request_id" (variável escalar) contra
-- uma query que podia retornar 2+ linhas.
--
-- Correção em 2 partes:
--   1) cancel_transfer_signal passa a cancelar TODAS as linhas pendentes
--      do paciente (o correto clinicamente — não deixar nenhuma pendência
--      órfã), sem tentar capturar um ID único via RETURNING INTO.
--   2) Índice único parcial garante, a partir de agora, que nunca mais
--      existam 2 linhas 'pending' para o mesmo paciente — rede de
--      segurança no banco, independente do código do front.

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
      'previous_status', v_patient.admission_status, 'request_id', v_request_id,
      'requests_cancelled', COALESCE(v_cancelled_count, 0)
    )
  );

  RETURN jsonb_build_object('ok', true, 'patient_id', p_patient_id, 'request_id', v_request_id);
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.cancel_transfer_signal(uuid, text) TO authenticated;

-- Rede de segurança: nunca mais permite 2 linhas 'pending' para o mesmo
-- paciente em internal_transfer_requests, seja qual for a origem do bug.
-- Idempotente/seguro mesmo se já existir alguma duplicata órfã: o CREATE
-- INDEX falharia nesse caso, então primeiro resolvemos as duplicatas
-- existentes (mantém a mais recente como pending, cancela as demais).
DO $cleanup$
DECLARE
  v_pat uuid;
BEGIN
  FOR v_pat IN
    SELECT source_patient_id FROM public.internal_transfer_requests
    WHERE status = 'pending'
    GROUP BY source_patient_id HAVING count(*) > 1
  LOOP
    UPDATE public.internal_transfer_requests
       SET status = 'cancelled', cancelled_at = now(),
           cancellation_reason = 'Cancelado automaticamente — duplicata detectada na migration 20260716230000 (mesmo paciente com múltiplas sinalizações pendentes).'
     WHERE source_patient_id = v_pat AND status = 'pending'
       AND id <> (
         SELECT id FROM public.internal_transfer_requests
         WHERE source_patient_id = v_pat AND status = 'pending'
         ORDER BY created_at DESC LIMIT 1
       );
  END LOOP;
END;
$cleanup$;

CREATE UNIQUE INDEX IF NOT EXISTS internal_transfer_requests_one_pending_per_patient
  ON public.internal_transfer_requests (source_patient_id)
  WHERE status = 'pending';
