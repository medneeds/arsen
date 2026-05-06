
CREATE OR REPLACE VIEW public.patient_timeline AS
SELECT pa.id::text AS event_id,'pre_admission'::text AS event_type,'Pré-admissão / Triagem'::text AS event_label,pa.created_at AS event_at,pa.patient_registry_id,NULL::uuid AS patient_id,pa.patient_name,pa.created_by AS author_id,pa.hospital_unit_id,pa.state_id,pa.department,COALESCE(pa.chief_complaint, pa.risk_classification, 'Pré-admissão registrada'::text) AS summary,to_jsonb(pa.*) AS payload FROM pre_admissions pa
UNION ALL
SELECT pe.id::text,'encounter','Atendimento iniciado',pe.created_at,pe.registry_id,pe.patient_id,pe.patient_name,pe.created_by,pe.hospital_unit_id,pe.state_id,pe.department,concat('Código ', pe.encounter_code, COALESCE(' • '::text || pe.destination_sector, ''::text)),to_jsonb(pe.*) FROM patient_encounters pe
UNION ALL
SELECT ah.id::text,'admission_history','História de admissão',ah.created_at,ah.patient_registry_id,ah.patient_id,NULL::text,ah.created_by,ah.hospital_unit_id,ah.state_id,ah.department,COALESCE(ah.diagnostic_hypothesis, ah.chief_complaint, 'Registrada'::text),to_jsonb(ah.*) FROM admission_histories ah
UNION ALL
SELECT ce.id::text,'evolution','Evolução clínica',ce.created_at,ce.patient_registry_id,ce.patient_id,ce.patient_name,ce.created_by,ce.hospital_unit_id,ce.state_id,ce.department,concat(ce.status, COALESCE(' • '::text || ce.created_by_name, ''::text)),to_jsonb(ce.*) FROM clinical_evolutions ce
UNION ALL
SELECT er.id::text,'exam_request',concat('Exame: ', er.category),er.created_at,er.patient_registry_id,er.patient_id,er.patient_name,er.requested_by,er.hospital_unit_id,er.state_id,er.department,concat(er.status, COALESCE(' • '::text || er.priority, ''::text)),to_jsonb(er.*) FROM exam_requests er
UNION ALL
SELECT cr.id::text,'culture_result',concat('Cultura: ', cr.culture_type),cr.created_at,cr.patient_registry_id,cr.patient_id,cr.patient_name,cr.uploaded_by,cr.hospital_unit_id,cr.state_id,cr.department,concat(cr.culture_type, COALESCE(' • '::text || cr.microorganism, ''::text), ' • ', cr.status),to_jsonb(cr.*) FROM culture_results cr
UNION ALL
SELECT pm.id::text,'movement',concat('Movimentação: ', pm.movement_type),pm.created_at,pm.patient_registry_id,pm.patient_id,pm.patient_name,pm.created_by,pm.hospital_unit_id,pm.state_id,pm.department,concat(COALESCE(pm.patient_sector || ' → '::text, ''::text), COALESCE(pm.destination, '—'::text)),to_jsonb(pm.*) FROM patient_movements pm
UNION ALL
SELECT ch.id::text,'conduct_change',concat('Conduta: ', ch.field_name),ch.created_at,ch.patient_registry_id,ch.patient_id,NULL::text,ch.changed_by,ch.hospital_unit_id,ch.state_id,ch.department,concat('Alterado por ', COALESCE(ch.changed_by_email, '—'::text)),to_jsonb(ch.*) FROM conduct_history ch
UNION ALL
SELECT bsh.id::text,'bed_status',concat('Leito ', bsh.bed_number, ': ', bsh.new_status),bsh.created_at,NULL::uuid,NULL::uuid,NULL::text,bsh.changed_by,bsh.hospital_unit_id,bsh.state_id,NULL::text,concat(COALESCE(bsh.old_status || ' → '::text, ''::text), bsh.new_status, COALESCE(' • '::text || bsh.reason, ''::text)),to_jsonb(bsh.*) FROM bed_status_history bsh
UNION ALL
SELECT d.id::text,'dispensation','Dispensação farmacêutica',d.dispensed_at,NULL::uuid,NULL::uuid,d.patient_name,d.dispensed_by,d.hospital_unit_id,d.state_id,d.department,concat('Código ', d.dispensation_code, COALESCE(' • por '::text || d.dispensed_by_name, ''::text)),to_jsonb(d.*) FROM dispensations d
UNION ALL
SELECT dp.id::text,'dhd','Dose Hospitalar Domiciliar',dp.created_at,dp.patient_registry_id,NULL::uuid,dp.patient_name,dp.created_by,dp.hospital_unit_id,dp.state_id,dp.department,concat(dp.status, COALESCE(' • '::text || dp.diagnosis, ''::text)),to_jsonb(dp.*) FROM dhd_patients dp
UNION ALL
SELECT dd.id::text,
       'discharge_document'::text,
       CASE dd.document_type
         WHEN 'obito' THEN 'Relatório de óbito'
         WHEN 'alta_pedido' THEN 'Termo de alta a pedido'
         ELSE 'Sumário de alta'
       END,
       dd.signed_at,
       dd.patient_registry_id,
       dd.patient_id,
       dd.patient_name,
       dd.signed_by,
       dd.hospital_unit_id,
       dd.state_id,
       dd.department,
       concat(
         COALESCE('Assinado por ' || dd.signed_by_name, 'Documento gerado'),
         COALESCE(' • CRM ' || dd.signed_by_crm, ''),
         COALESCE(' • atend. ' || dd.encounter_code, '')
       ),
       to_jsonb(dd.*)
FROM discharge_documents dd;
