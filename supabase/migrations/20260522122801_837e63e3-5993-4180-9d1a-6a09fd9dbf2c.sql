
CREATE OR REPLACE FUNCTION public.archive_bed_history(p_patient_id uuid, p_reason text DEFAULT 'bed_deallocation'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_registry uuid;
  v_current_name text;
  v_ev int := 0;
  v_rx int := 0;
  v_ex int := 0;
  v_cu int := 0;
BEGIN
  IF p_patient_id IS NULL THEN
    RAISE EXCEPTION 'patient_id é obrigatório';
  END IF;

  SELECT patient_registry_id, NULLIF(trim(name),'')
    INTO v_current_registry, v_current_name
  FROM public.patients
  WHERE id = p_patient_id;

  -- 🔒 REGRA NOVA (anti-cascata):
  -- Só arquivamos registros que carregam PROVA EXPLÍCITA de pertencer a outro paciente.
  --   • registry IS NOT NULL e diferente do atual  → arquivar
  --   • OU linha do leito está VAGA (registry NULL e name vazio) E o registro tem
  --     registry/name diferente → arquivar (fim de internação real)
  -- Linhas legadas com registry NULL e leito ocupado por novo paciente NÃO são
  -- mais arquivadas automaticamente — o filtro registry-first das telas já
  -- isola corretamente sem destruir histórico.

  WITH upd AS (
    UPDATE public.clinical_evolutions ce
       SET archived_at = now(),
           archived_from_patient_id = COALESCE(ce.archived_from_patient_id, ce.patient_id),
           archive_reason = COALESCE(ce.archive_reason, p_reason)
     WHERE ce.patient_id = p_patient_id
       AND ce.archived_at IS NULL
       AND (
         (v_current_registry IS NULL AND v_current_name IS NULL
            AND (ce.patient_registry_id IS NOT NULL OR ce.patient_name IS DISTINCT FROM v_current_name))
         OR (v_current_registry IS NOT NULL
            AND ce.patient_registry_id IS NOT NULL
            AND ce.patient_registry_id <> v_current_registry)
       )
     RETURNING 1
  ) SELECT count(*) INTO v_ev FROM upd;

  WITH upd AS (
    UPDATE public.prescriptions p
       SET archived_at = now(),
           archived_from_patient_id = COALESCE(p.archived_from_patient_id, NULLIF(p.patient_data->>'id','')::uuid),
           archive_reason = COALESCE(p.archive_reason, p_reason)
     WHERE NULLIF(p.patient_data->>'id','')::uuid = p_patient_id
       AND p.archived_at IS NULL
       AND (
         (v_current_registry IS NULL AND v_current_name IS NULL
            AND (p.patient_registry_id IS NOT NULL OR p.patient_name IS DISTINCT FROM v_current_name))
         OR (v_current_registry IS NOT NULL
            AND p.patient_registry_id IS NOT NULL
            AND p.patient_registry_id <> v_current_registry)
       )
     RETURNING 1
  ) SELECT count(*) INTO v_rx FROM upd;

  WITH upd AS (
    UPDATE public.exam_requests er
       SET archived_at = now(),
           archived_from_patient_id = COALESCE(er.archived_from_patient_id, er.patient_id),
           archive_reason = COALESCE(er.archive_reason, p_reason)
     WHERE er.patient_id = p_patient_id
       AND er.archived_at IS NULL
       AND (
         (v_current_registry IS NULL AND v_current_name IS NULL
            AND (er.patient_registry_id IS NOT NULL OR er.patient_name IS DISTINCT FROM v_current_name))
         OR (v_current_registry IS NOT NULL
            AND er.patient_registry_id IS NOT NULL
            AND er.patient_registry_id <> v_current_registry)
       )
     RETURNING 1
  ) SELECT count(*) INTO v_ex FROM upd;

  WITH upd AS (
    UPDATE public.culture_results cr
       SET archived_at = now(),
           archived_from_patient_id = COALESCE(cr.archived_from_patient_id, cr.patient_id),
           archive_reason = COALESCE(cr.archive_reason, p_reason)
     WHERE cr.patient_id = p_patient_id
       AND cr.archived_at IS NULL
       AND (
         (v_current_registry IS NULL AND v_current_name IS NULL
            AND (cr.patient_registry_id IS NOT NULL OR cr.patient_name IS DISTINCT FROM v_current_name))
         OR (v_current_registry IS NOT NULL
            AND cr.patient_registry_id IS NOT NULL
            AND cr.patient_registry_id <> v_current_registry)
       )
     RETURNING 1
  ) SELECT count(*) INTO v_cu FROM upd;

  BEGIN
    INSERT INTO public.audit_logs (
      user_id, action, table_name, record_id, new_data
    ) VALUES (
      auth.uid(), 'INSERT'::audit_action, 'archive_bed_history', p_patient_id,
      jsonb_build_object(
        'reason', p_reason,
        'current_registry', v_current_registry,
        'current_name', v_current_name,
        'evolutions', v_ev,
        'prescriptions', v_rx,
        'exam_requests', v_ex,
        'culture_results', v_cu,
        'at', now(),
        'fn_version', 'v2_no_null_cascade'
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'patient_id', p_patient_id,
    'reason', p_reason,
    'current_registry', v_current_registry,
    'archived', jsonb_build_object(
      'clinical_evolutions', v_ev,
      'prescriptions', v_rx,
      'exam_requests', v_ex,
      'culture_results', v_cu
    )
  );
END;
$function$;
