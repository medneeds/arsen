DROP VIEW IF EXISTS public.patient_timeline CASCADE;

CREATE VIEW public.patient_timeline
WITH (security_invoker = true)
AS
SELECT
  pa.id::TEXT AS event_id,
  'pre_admission' AS event_type,
  'Pré-admissão / Triagem' AS event_label,
  pa.created_at AS event_at,
  pa.patient_registry_id,
  NULL::UUID AS patient_id,
  pa.patient_name,
  pa.created_by AS author_id,
  pa.hospital_unit_id,
  pa.state_id,
  pa.department,
  COALESCE(pa.chief_complaint, pa.risk_classification, 'Pré-admissão registrada') AS summary,
  to_jsonb(pa) AS payload
FROM public.pre_admissions pa
UNION ALL
SELECT pe.id::TEXT, 'encounter', 'Atendimento iniciado',
  pe.created_at, pe.registry_id, pe.patient_id, pe.patient_name,
  pe.created_by, pe.hospital_unit_id, pe.state_id, pe.department,
  CONCAT('Código ', pe.encounter_code, COALESCE(' • ' || pe.destination_sector, '')),
  to_jsonb(pe)
FROM public.patient_encounters pe
UNION ALL
SELECT ah.id::TEXT, 'admission_history', 'História de admissão',
  ah.created_at, ah.patient_registry_id, ah.patient_id, NULL,
  ah.created_by, ah.hospital_unit_id, ah.state_id, ah.department,
  COALESCE(ah.diagnostic_hypothesis, ah.chief_complaint, 'Admissão registrada'),
  to_jsonb(ah)
FROM public.admission_histories ah
UNION ALL
SELECT ce.id::TEXT, 'evolution', 'Evolução clínica',
  ce.created_at, ce.patient_registry_id, ce.patient_id, ce.patient_name,
  ce.created_by, ce.hospital_unit_id, ce.state_id, ce.department,
  CONCAT('Status: ', ce.status, COALESCE(' • por ' || ce.created_by_name, '')),
  to_jsonb(ce)
FROM public.clinical_evolutions ce
UNION ALL
SELECT pr.id::TEXT, 'prescription', 'Prescrição',
  pr.created_at, pr.patient_registry_id, NULL, pr.patient_name,
  pr.created_by, pr.hospital_unit_id, pr.state_id, pr.department,
  CONCAT('Versão ', pr.version, ' • ', pr.status),
  to_jsonb(pr)
FROM public.prescriptions pr
UNION ALL
SELECT er.id::TEXT, 'exam_request', CONCAT('Exame: ', er.category),
  er.created_at, er.patient_registry_id, er.patient_id, er.patient_name,
  er.requested_by, er.hospital_unit_id, er.state_id, er.department,
  CONCAT(er.priority, ' • ', er.status, COALESCE(' • ' || er.clinical_indication, '')),
  to_jsonb(er)
FROM public.exam_requests er
UNION ALL
SELECT cr.id::TEXT, 'culture_result', 'Cultura microbiológica',
  cr.created_at, cr.patient_registry_id, cr.patient_id, cr.patient_name,
  cr.uploaded_by, cr.hospital_unit_id, cr.state_id, cr.department,
  CONCAT(cr.culture_type, COALESCE(' • ' || cr.microorganism, ''), ' • ', cr.status),
  to_jsonb(cr)
FROM public.culture_results cr
UNION ALL
SELECT pm.id::TEXT, 'movement', CONCAT('Movimentação: ', pm.movement_type),
  pm.created_at, pm.patient_registry_id, pm.patient_id, pm.patient_name,
  pm.created_by, pm.hospital_unit_id, pm.state_id, pm.department,
  CONCAT(COALESCE(pm.patient_sector || ' → ', ''), COALESCE(pm.destination, '—')),
  to_jsonb(pm)
FROM public.patient_movements pm
UNION ALL
SELECT ch.id::TEXT, 'conduct_change', CONCAT('Conduta: ', ch.field_name),
  ch.created_at, ch.patient_registry_id, ch.patient_id, NULL,
  ch.changed_by, ch.hospital_unit_id, ch.state_id, ch.department,
  CONCAT('Alterado por ', COALESCE(ch.changed_by_email, '—')),
  to_jsonb(ch)
FROM public.conduct_history ch
UNION ALL
SELECT bsh.id::TEXT, 'bed_status', CONCAT('Leito ', bsh.bed_number, ': ', bsh.new_status),
  bsh.created_at, NULL, NULL, NULL,
  bsh.changed_by, bsh.hospital_unit_id, bsh.state_id, NULL,
  CONCAT(COALESCE(bsh.old_status || ' → ', ''), bsh.new_status, COALESCE(' • ' || bsh.reason, '')),
  to_jsonb(bsh)
FROM public.bed_status_history bsh
UNION ALL
SELECT d.id::TEXT, 'dispensation', 'Dispensação farmacêutica',
  d.dispensed_at, NULL, NULL, d.patient_name,
  d.dispensed_by, d.hospital_unit_id, d.state_id, d.department,
  CONCAT('Código ', d.dispensation_code, COALESCE(' • por ' || d.dispensed_by_name, '')),
  to_jsonb(d)
FROM public.dispensations d
UNION ALL
SELECT dp.id::TEXT, 'dhd', 'Dose Hospitalar Domiciliar',
  dp.created_at, dp.patient_registry_id, NULL, dp.patient_name,
  dp.created_by, dp.hospital_unit_id, dp.state_id, dp.department,
  CONCAT(dp.status, COALESCE(' • ' || dp.diagnosis, '')),
  to_jsonb(dp)
FROM public.dhd_patients dp;

-- Recria RPC pois CASCADE removeu
CREATE OR REPLACE FUNCTION public.get_patient_timeline(
  p_patient_registry_id UUID DEFAULT NULL,
  p_patient_id UUID DEFAULT NULL,
  p_event_types TEXT[] DEFAULT NULL,
  p_from_date TIMESTAMPTZ DEFAULT NULL,
  p_to_date TIMESTAMPTZ DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 500
)
RETURNS TABLE (
  event_id TEXT, event_type TEXT, event_label TEXT, event_at TIMESTAMPTZ,
  patient_registry_id UUID, patient_id UUID, patient_name TEXT,
  author_id UUID, author_email TEXT,
  hospital_unit_id UUID, state_id UUID, department TEXT,
  summary TEXT, payload JSONB
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT
    pt.event_id, pt.event_type, pt.event_label, pt.event_at,
    pt.patient_registry_id, pt.patient_id, pt.patient_name,
    pt.author_id,
    (SELECT email FROM public.profiles WHERE id = pt.author_id) AS author_email,
    pt.hospital_unit_id, pt.state_id, pt.department,
    pt.summary, pt.payload
  FROM public.patient_timeline pt
  WHERE
    (p_patient_registry_id IS NULL OR pt.patient_registry_id = p_patient_registry_id)
    AND (p_patient_id IS NULL OR pt.patient_id = p_patient_id)
    AND (p_event_types IS NULL OR pt.event_type = ANY(p_event_types))
    AND (p_from_date IS NULL OR pt.event_at >= p_from_date)
    AND (p_to_date IS NULL OR pt.event_at <= p_to_date)
    AND (
      p_search IS NULL
      OR unaccent(lower(COALESCE(pt.summary, ''))) LIKE '%' || unaccent(lower(p_search)) || '%'
      OR unaccent(lower(COALESCE(pt.event_label, ''))) LIKE '%' || unaccent(lower(p_search)) || '%'
    )
  ORDER BY pt.event_at DESC
  LIMIT p_limit;
$$;