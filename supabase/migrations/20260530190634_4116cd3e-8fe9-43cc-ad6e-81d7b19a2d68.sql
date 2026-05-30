-- Extend patient_timeline view to include prescriptions, vital_signs, and round_sessions
CREATE OR REPLACE VIEW public.patient_timeline AS
SELECT pa.id::text AS event_id,
    'pre_admission'::text AS event_type,
    'Pré-admissão / Triagem'::text AS event_label,
    pa.created_at AS event_at,
    pa.patient_registry_id,
    NULL::uuid AS patient_id,
    pa.patient_name,
    pa.created_by AS author_id,
    pa.hospital_unit_id,
    pa.state_id,
    pa.department,
    COALESCE(pa.chief_complaint, pa.risk_classification, 'Pré-admissão registrada'::text) AS summary,
    to_jsonb(pa.*) AS payload
   FROM pre_admissions pa
UNION ALL
 SELECT pe.id::text AS event_id,
    'encounter'::text AS event_type,
    'Atendimento iniciado'::text AS event_label,
    pe.created_at AS event_at,
    pe.registry_id AS patient_registry_id,
    pe.patient_id,
    pe.patient_name,
    pe.created_by AS author_id,
    pe.hospital_unit_id,
    pe.state_id,
    pe.department,
    concat('Código ', pe.encounter_code, COALESCE(' • '::text || pe.destination_sector, ''::text)) AS summary,
    to_jsonb(pe.*) AS payload
   FROM patient_encounters pe
UNION ALL
 SELECT ah.id::text AS event_id,
    'admission_history'::text AS event_type,
    'História de admissão'::text AS event_label,
    ah.created_at AS event_at,
    ah.patient_registry_id,
    ah.patient_id,
    NULL::text AS patient_name,
    ah.created_by AS author_id,
    ah.hospital_unit_id,
    ah.state_id,
    ah.department,
    COALESCE(ah.diagnostic_hypothesis, ah.chief_complaint, 'Registrada'::text) AS summary,
    to_jsonb(ah.*) AS payload
   FROM admission_histories ah
UNION ALL
 SELECT ce.id::text AS event_id,
    'evolution'::text AS event_type,
    'Evolução clínica'::text AS event_label,
    ce.created_at AS event_at,
    ce.patient_registry_id,
    ce.patient_id,
    ce.patient_name,
    ce.created_by AS author_id,
    ce.hospital_unit_id,
    ce.state_id,
    ce.department,
    concat(ce.status, COALESCE(' • '::text || ce.created_by_name, ''::text)) AS summary,
    to_jsonb(ce.*) AS payload
   FROM clinical_evolutions ce
UNION ALL
 SELECT er.id::text AS event_id,
    'exam_request'::text AS event_type,
    concat('Exame: ', er.category) AS event_label,
    er.created_at AS event_at,
    er.patient_registry_id,
    er.patient_id,
    er.patient_name,
    er.requested_by AS author_id,
    er.hospital_unit_id,
    er.state_id,
    er.department,
    concat(er.status, COALESCE(' • '::text || er.priority, ''::text)) AS summary,
    to_jsonb(er.*) AS payload
   FROM exam_requests er
UNION ALL
 SELECT cr.id::text AS event_id,
    'culture_result'::text AS event_type,
    concat('Cultura: ', cr.culture_type) AS event_label,
    cr.created_at AS event_at,
    cr.patient_registry_id,
    cr.patient_id,
    cr.patient_name,
    cr.uploaded_by AS author_id,
    cr.hospital_unit_id,
    cr.state_id,
    cr.department,
    concat(cr.culture_type, COALESCE(' • '::text || cr.microorganism, ''::text), ' • ', cr.status) AS summary,
    to_jsonb(cr.*) AS payload
   FROM culture_results cr
UNION ALL
 SELECT pm.id::text AS event_id,
    'movement'::text AS event_type,
    concat('Movimentação: ', pm.movement_type) AS event_label,
    pm.created_at AS event_at,
    pm.patient_registry_id,
    pm.patient_id,
    pm.patient_name,
    pm.created_by AS author_id,
    pm.hospital_unit_id,
    pm.state_id,
    pm.department,
    concat(COALESCE(pm.patient_sector || ' → '::text, ''::text), COALESCE(pm.destination, '—'::text)) AS summary,
    to_jsonb(pm.*) AS payload
   FROM patient_movements pm
UNION ALL
 SELECT ch.id::text AS event_id,
    'conduct_change'::text AS event_type,
    concat('Conduta: ', ch.field_name) AS event_label,
    ch.created_at AS event_at,
    ch.patient_registry_id,
    ch.patient_id,
    NULL::text AS patient_name,
    ch.changed_by AS author_id,
    ch.hospital_unit_id,
    ch.state_id,
    ch.department,
    concat('Alterado por ', COALESCE(ch.changed_by_email, '—'::text)) AS summary,
    to_jsonb(ch.*) AS payload
   FROM conduct_history ch
UNION ALL
 SELECT bsh.id::text AS event_id,
    'bed_status'::text AS event_type,
    concat('Leito ', bsh.bed_number, ': ', bsh.new_status) AS event_label,
    bsh.created_at AS event_at,
    NULL::uuid AS patient_registry_id,
    NULL::uuid AS patient_id,
    NULL::text AS patient_name,
    bsh.changed_by AS author_id,
    bsh.hospital_unit_id,
    bsh.state_id,
    NULL::text AS department,
    concat(COALESCE(bsh.old_status || ' → '::text, ''::text), bsh.new_status, COALESCE(' • '::text || bsh.reason, ''::text)) AS summary,
    to_jsonb(bsh.*) AS payload
   FROM bed_status_history bsh
UNION ALL
 SELECT d.id::text AS event_id,
    'dispensation'::text AS event_type,
    'Dispensação farmacêutica'::text AS event_label,
    d.dispensed_at AS event_at,
    NULL::uuid AS patient_registry_id,
    NULL::uuid AS patient_id,
    d.patient_name,
    d.dispensed_by AS author_id,
    d.hospital_unit_id,
    d.state_id,
    d.department,
    concat('Código ', d.dispensation_code, COALESCE(' • por '::text || d.dispensed_by_name, ''::text)) AS summary,
    to_jsonb(d.*) AS payload
   FROM dispensations d
UNION ALL
 SELECT dp.id::text AS event_id,
    'dhd'::text AS event_type,
    'Dose Hospitalar Domiciliar'::text AS event_label,
    dp.created_at AS event_at,
    dp.patient_registry_id,
    NULL::uuid AS patient_id,
    dp.patient_name,
    dp.created_by AS author_id,
    dp.hospital_unit_id,
    dp.state_id,
    dp.department,
    concat(dp.status, COALESCE(' • '::text || dp.diagnosis, ''::text)) AS summary,
    to_jsonb(dp.*) AS payload
   FROM dhd_patients dp
UNION ALL
 SELECT dd.id::text AS event_id,
    'discharge_document'::text AS event_type,
        CASE dd.document_type
            WHEN 'obito'::text THEN 'Relatório de óbito'::text
            WHEN 'alta_pedido'::text THEN 'Termo de alta a pedido'::text
            ELSE 'Sumário de alta'::text
        END AS event_label,
    dd.signed_at AS event_at,
    dd.patient_registry_id,
    dd.patient_id,
    dd.patient_name,
    dd.signed_by AS author_id,
    dd.hospital_unit_id,
    dd.state_id,
    dd.department,
    concat(COALESCE('Assinado por '::text || dd.signed_by_name, 'Documento gerado'::text), COALESCE(' • CRM '::text || dd.signed_by_crm, ''::text), COALESCE(' • atend. '::text || dd.encounter_code, ''::text)) AS summary,
    to_jsonb(dd.*) AS payload
   FROM discharge_documents dd
   WHERE dd.suspended_at IS NULL
UNION ALL
 SELECT pr.id::text AS event_id,
    'prescription'::text AS event_type,
    'Prescrição'::text AS event_label,
    COALESCE(pr.updated_at, pr.created_at) AS event_at,
    pr.patient_registry_id,
    NULL::uuid AS patient_id,
    pr.patient_name,
    pr.created_by AS author_id,
    pr.hospital_unit_id,
    pr.state_id,
    pr.department,
    concat(COALESCE(pr.status, 'rascunho'),
           ' • v', COALESCE(pr.version::text, '1'),
           COALESCE(' • ' || (jsonb_array_length(COALESCE(pr.items, '[]'::jsonb))::text) || ' itens', '')) AS summary,
    to_jsonb(pr.*) AS payload
   FROM prescriptions pr
   WHERE pr.archived_at IS NULL
UNION ALL
 SELECT vs.id::text AS event_id,
    'vital_signs'::text AS event_type,
    'Sinais vitais'::text AS event_label,
    vs.recorded_at AS event_at,
    NULL::uuid AS patient_registry_id,
    vs.patient_id,
    NULL::text AS patient_name,
    vs.recorded_by AS author_id,
    vs.hospital_unit_id,
    vs.state_id,
    vs.department,
    concat(
      COALESCE('PA ' || vs.systolic_bp::text || '/' || vs.diastolic_bp::text, ''),
      COALESCE(' • FC ' || vs.heart_rate::text, ''),
      COALESCE(' • SpO2 ' || vs.spo2::text || '%', ''),
      COALESCE(' • T ' || vs.temperature::text || '°C', ''),
      COALESCE(' • NEWS2 ' || vs.news2_score::text || ' (' || vs.news2_risk || ')', '')
    ) AS summary,
    to_jsonb(vs.*) AS payload
   FROM vital_signs vs
UNION ALL
 SELECT rs.id::text AS event_id,
    'round'::text AS event_type,
    'Round multiprofissional'::text AS event_label,
    rs.created_at AS event_at,
    NULL::uuid AS patient_registry_id,
    rs.patient_id,
    rs.patient_name,
    rs.created_by AS author_id,
    rs.hospital_unit_id,
    rs.state_id,
    rs.department,
    concat(
      COALESCE('Setor ' || rs.patient_sector, ''),
      COALESCE(' • leito ' || rs.patient_bed, ''),
      COALESCE(' • ' || to_char(rs.round_date, 'DD/MM/YYYY'), '')
    ) AS summary,
    to_jsonb(rs.*) AS payload
   FROM round_sessions rs;

-- Recreate RPC pointing to the same view (signature unchanged)
-- The function reads from patient_timeline directly, so no further change needed.

COMMENT ON VIEW public.patient_timeline IS 'Linha do tempo longitudinal do prontuário do paciente. Inclui pré-admissão, atendimento, história de admissão, evoluções, prescrições, exames, culturas, movimentações, condutas, leitos, dispensações, DHD, sinais vitais, rounds e documentos de alta/óbito.';