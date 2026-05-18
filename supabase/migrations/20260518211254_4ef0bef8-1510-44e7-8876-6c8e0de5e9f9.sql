DO $$
DECLARE
  v_count int := 0;
  r record;
BEGIN
  FOR r IN
    SELECT p.id AS patient_id, p.medical_record AS old_mr, pr.medical_record AS new_mr,
           p.department, p.bed_number
    FROM public.patients p
    JOIN public.patient_registry pr ON pr.id = p.patient_registry_id
    WHERE (p.medical_record IS NULL OR p.medical_record = '')
      AND pr.medical_record IS NOT NULL
      AND pr.medical_record <> ''
      AND p.department IN ('UTI 1','UTI 2','UCI 1','UCI 2','UCC','ENFERMARIA DE TRANSIÇÃO')
      AND p.bed_number IS NOT NULL
      AND p.bed_number <> ''
      AND COALESCE(p.is_vacant, false) = false
  LOOP
    UPDATE public.patients
       SET medical_record = r.new_mr
     WHERE id = r.patient_id;

    INSERT INTO public.audit_logs (action, table_name, record_id, old_data, new_data, changed_fields, department)
    VALUES (
      'UPDATE',
      'patients',
      r.patient_id,
      jsonb_build_object('medical_record', r.old_mr),
      jsonb_build_object(
        'op', 'SYNC_MR_FROM_REGISTRY',
        'medical_record', r.new_mr,
        'bed_number', r.bed_number,
        'source', 'patient_registry',
        'scope', '6_critical_sectors'
      ),
      ARRAY['medical_record']::text[],
      r.department
    );

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Backfill MR concluído: % pacientes atualizados', v_count;
END $$;