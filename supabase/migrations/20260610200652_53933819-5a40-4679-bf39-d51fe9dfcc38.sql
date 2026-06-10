
-- =====================================================================
-- FASE 1 — MULTI-TENANT RLS HARDENING
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_gestor(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id
      AND (p.access_profile = 'gestor' OR 'gestor' = ANY(COALESCE(p.access_profiles, ARRAY[]::text[])))
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_hospital(_unit uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'coordenador')
    OR public.has_role(auth.uid(), 'dev')
    OR public.is_gestor(auth.uid())
    OR (_unit IS NOT NULL AND public.user_in_hospital(auth.uid(), _unit))
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_hospital_strict_null(_unit uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    (_unit IS NULL AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dev')))
    OR (_unit IS NOT NULL AND (
      public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'coordenador')
      OR public.has_role(auth.uid(),'dev')
      OR public.is_gestor(auth.uid())
      OR public.user_in_hospital(auth.uid(), _unit)
    ))
  );
$$;

-- ============ patient_registry ============
DROP POLICY IF EXISTS "Admins can delete patient registry" ON public.patient_registry;
DROP POLICY IF EXISTS "Authenticated users can create patient registry" ON public.patient_registry;
DROP POLICY IF EXISTS "Authenticated users can view patient registry" ON public.patient_registry;
DROP POLICY IF EXISTS "Authenticated users can update patient registry" ON public.patient_registry;
CREATE POLICY "tenant_select_patient_registry" ON public.patient_registry FOR SELECT USING (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_insert_patient_registry" ON public.patient_registry FOR INSERT WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_update_patient_registry" ON public.patient_registry FOR UPDATE USING (public.can_access_hospital(hospital_unit_id)) WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_delete_patient_registry" ON public.patient_registry FOR DELETE USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dev'));

-- ============ patients ============
DROP POLICY IF EXISTS "Usuários autenticados podem deletar pacientes" ON public.patients;
DROP POLICY IF EXISTS "Médicos podem criar pacientes" ON public.patients;
DROP POLICY IF EXISTS "Médicos podem visualizar todos os pacientes" ON public.patients;
DROP POLICY IF EXISTS "Médicos podem atualizar pacientes" ON public.patients;
CREATE POLICY "tenant_select_patients" ON public.patients FOR SELECT USING (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_insert_patients" ON public.patients FOR INSERT WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_update_patients" ON public.patients FOR UPDATE USING (public.can_access_hospital(hospital_unit_id)) WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_delete_patients" ON public.patients FOR DELETE USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dev'));

-- ============ medical_records (strict NULL) ============
DROP POLICY IF EXISTS "Admins can delete medical records" ON public.medical_records;
DROP POLICY IF EXISTS "Authenticated can insert medical records" ON public.medical_records;
DROP POLICY IF EXISTS "Authenticated can view medical records" ON public.medical_records;
DROP POLICY IF EXISTS "Admins can update medical records" ON public.medical_records;
CREATE POLICY "tenant_select_medical_records" ON public.medical_records FOR SELECT USING (public.can_access_hospital_strict_null(hospital_unit_id));
CREATE POLICY "tenant_insert_medical_records" ON public.medical_records FOR INSERT WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_update_medical_records" ON public.medical_records FOR UPDATE USING (public.can_access_hospital_strict_null(hospital_unit_id)) WITH CHECK (public.can_access_hospital_strict_null(hospital_unit_id));
CREATE POLICY "tenant_delete_medical_records" ON public.medical_records FOR DELETE USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dev'));

-- ============ medical_record_edit_history ============
DROP POLICY IF EXISTS "No delete mreh" ON public.medical_record_edit_history;
DROP POLICY IF EXISTS "Authenticated can insert mreh" ON public.medical_record_edit_history;
DROP POLICY IF EXISTS "Authenticated can read mreh" ON public.medical_record_edit_history;
DROP POLICY IF EXISTS "No update mreh" ON public.medical_record_edit_history;
CREATE POLICY "tenant_select_mreh" ON public.medical_record_edit_history FOR SELECT USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador') OR public.has_role(auth.uid(),'dev') OR public.is_gestor(auth.uid())
  OR EXISTS (SELECT 1 FROM public.medical_records mr WHERE mr.id = medical_record_edit_history.medical_record_id AND public.can_access_hospital(mr.hospital_unit_id))
);
CREATE POLICY "tenant_insert_mreh" ON public.medical_record_edit_history FOR INSERT WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador') OR public.has_role(auth.uid(),'dev') OR public.is_gestor(auth.uid())
  OR EXISTS (SELECT 1 FROM public.medical_records mr WHERE mr.id = medical_record_edit_history.medical_record_id AND public.can_access_hospital(mr.hospital_unit_id))
);
CREATE POLICY "no_update_mreh" ON public.medical_record_edit_history FOR UPDATE USING (false);
CREATE POLICY "no_delete_mreh" ON public.medical_record_edit_history FOR DELETE USING (false);

-- ============ patient_admission_date_history ============
DROP POLICY IF EXISTS "Authenticated can insert admission date history" ON public.patient_admission_date_history;
DROP POLICY IF EXISTS "Authenticated can view admission date history" ON public.patient_admission_date_history;
CREATE POLICY "tenant_select_padh" ON public.patient_admission_date_history FOR SELECT USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador') OR public.has_role(auth.uid(),'dev') OR public.is_gestor(auth.uid())
  OR EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_admission_date_history.patient_id AND public.can_access_hospital(p.hospital_unit_id))
);
CREATE POLICY "tenant_insert_padh" ON public.patient_admission_date_history FOR INSERT WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador') OR public.has_role(auth.uid(),'dev') OR public.is_gestor(auth.uid())
  OR EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_admission_date_history.patient_id AND public.can_access_hospital(p.hospital_unit_id))
);

-- ============ clinical_evolutions (created_by) ============
DROP POLICY IF EXISTS "Only drafts can be deleted by author or admin" ON public.clinical_evolutions;
DROP POLICY IF EXISTS "Authors can create evolutions" ON public.clinical_evolutions;
DROP POLICY IF EXISTS "Authenticated users can view evolutions" ON public.clinical_evolutions;
DROP POLICY IF EXISTS "Authors can update own draft evolutions" ON public.clinical_evolutions;
CREATE POLICY "tenant_select_clinical_evolutions" ON public.clinical_evolutions FOR SELECT USING (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_insert_clinical_evolutions" ON public.clinical_evolutions FOR INSERT WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_update_clinical_evolutions" ON public.clinical_evolutions FOR UPDATE USING (public.can_access_hospital(hospital_unit_id)) WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_delete_clinical_evolutions" ON public.clinical_evolutions FOR DELETE USING (
  public.can_access_hospital(hospital_unit_id) AND (
    (created_by = auth.uid() AND status = 'draft') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dev')
  )
);

-- ============ prescriptions ============
DROP POLICY IF EXISTS "Admins can delete prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Author or privileged roles can delete draft prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Authenticated users can create prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Authenticated users can view prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "prescriptions_update_authenticated" ON public.prescriptions;
CREATE POLICY "tenant_select_prescriptions" ON public.prescriptions FOR SELECT USING (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_insert_prescriptions" ON public.prescriptions FOR INSERT WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_update_prescriptions" ON public.prescriptions FOR UPDATE USING (public.can_access_hospital(hospital_unit_id)) WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_delete_prescriptions" ON public.prescriptions FOR DELETE USING (
  public.can_access_hospital(hospital_unit_id) AND (
    (created_by = auth.uid() AND status = 'draft') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dev')
  )
);

-- ============ vital_signs ============
DROP POLICY IF EXISTS "Admins can delete vital signs" ON public.vital_signs;
DROP POLICY IF EXISTS "Authenticated users can create vital signs" ON public.vital_signs;
DROP POLICY IF EXISTS "Authenticated users can view vital signs" ON public.vital_signs;
DROP POLICY IF EXISTS "Authenticated users can update vital signs" ON public.vital_signs;
CREATE POLICY "tenant_select_vital_signs" ON public.vital_signs FOR SELECT USING (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_insert_vital_signs" ON public.vital_signs FOR INSERT WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_update_vital_signs" ON public.vital_signs FOR UPDATE USING (public.can_access_hospital(hospital_unit_id)) WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_delete_vital_signs" ON public.vital_signs FOR DELETE USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dev'));

-- ============ culture_results ============
DROP POLICY IF EXISTS "Admins can delete culture results" ON public.culture_results;
DROP POLICY IF EXISTS "Authenticated users can create culture results" ON public.culture_results;
DROP POLICY IF EXISTS "Authenticated users can view culture results" ON public.culture_results;
DROP POLICY IF EXISTS "Authenticated users can update culture results" ON public.culture_results;
CREATE POLICY "tenant_select_culture_results" ON public.culture_results FOR SELECT USING (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_insert_culture_results" ON public.culture_results FOR INSERT WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_update_culture_results" ON public.culture_results FOR UPDATE USING (public.can_access_hospital(hospital_unit_id)) WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_delete_culture_results" ON public.culture_results FOR DELETE USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dev'));

-- ============ exam_requests ============
DROP POLICY IF EXISTS "Admins can delete exam requests" ON public.exam_requests;
DROP POLICY IF EXISTS "Authenticated users can create exam requests" ON public.exam_requests;
DROP POLICY IF EXISTS "Authenticated users can view exam requests" ON public.exam_requests;
DROP POLICY IF EXISTS "Authenticated users can update exam requests" ON public.exam_requests;
CREATE POLICY "tenant_select_exam_requests" ON public.exam_requests FOR SELECT USING (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_insert_exam_requests" ON public.exam_requests FOR INSERT WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_update_exam_requests" ON public.exam_requests FOR UPDATE USING (public.can_access_hospital(hospital_unit_id)) WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_delete_exam_requests" ON public.exam_requests FOR DELETE USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dev'));

-- ============ discharge_documents ============
DROP POLICY IF EXISTS "Admins can delete discharge documents" ON public.discharge_documents;
DROP POLICY IF EXISTS "Authenticated can insert discharge documents" ON public.discharge_documents;
DROP POLICY IF EXISTS "Authenticated can view discharge documents" ON public.discharge_documents;
DROP POLICY IF EXISTS "Authors can update discharge documents" ON public.discharge_documents;
CREATE POLICY "tenant_select_discharge_documents" ON public.discharge_documents FOR SELECT USING (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_insert_discharge_documents" ON public.discharge_documents FOR INSERT WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_update_discharge_documents" ON public.discharge_documents FOR UPDATE USING (public.can_access_hospital(hospital_unit_id)) WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_delete_discharge_documents" ON public.discharge_documents FOR DELETE USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dev'));

-- ============ sepsis_protocols ============
DROP POLICY IF EXISTS "Admins podem deletar protocolos" ON public.sepsis_protocols;
DROP POLICY IF EXISTS "Usuários autenticados podem criar protocolos" ON public.sepsis_protocols;
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar protocolos" ON public.sepsis_protocols;
DROP POLICY IF EXISTS "Admins podem atualizar todos protocolos" ON public.sepsis_protocols;
DROP POLICY IF EXISTS "Usuários podem atualizar próprios protocolos" ON public.sepsis_protocols;
CREATE POLICY "tenant_select_sepsis_protocols" ON public.sepsis_protocols FOR SELECT USING (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_insert_sepsis_protocols" ON public.sepsis_protocols FOR INSERT WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_update_sepsis_protocols" ON public.sepsis_protocols FOR UPDATE USING (public.can_access_hospital(hospital_unit_id)) WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_delete_sepsis_protocols" ON public.sepsis_protocols FOR DELETE USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dev'));

-- ============ saps3_assessments ============
DROP POLICY IF EXISTS "Admins can delete SAPS3" ON public.saps3_assessments;
DROP POLICY IF EXISTS "Authenticated users can create SAPS3" ON public.saps3_assessments;
DROP POLICY IF EXISTS "Authenticated users can view SAPS3" ON public.saps3_assessments;
DROP POLICY IF EXISTS "Authenticated users can update SAPS3" ON public.saps3_assessments;
CREATE POLICY "tenant_select_saps3" ON public.saps3_assessments FOR SELECT USING (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_insert_saps3" ON public.saps3_assessments FOR INSERT WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_update_saps3" ON public.saps3_assessments FOR UPDATE USING (public.can_access_hospital(hospital_unit_id)) WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_delete_saps3" ON public.saps3_assessments FOR DELETE USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dev'));

-- ============ regulatory_guides ============
DROP POLICY IF EXISTS "Admins can delete guides" ON public.regulatory_guides;
DROP POLICY IF EXISTS "Authenticated users can create guides" ON public.regulatory_guides;
DROP POLICY IF EXISTS "Authenticated users can view guides in their hospital" ON public.regulatory_guides;
DROP POLICY IF EXISTS "Authenticated users can update guides they created or CCIH" ON public.regulatory_guides;
CREATE POLICY "tenant_select_regulatory_guides" ON public.regulatory_guides FOR SELECT USING (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_insert_regulatory_guides" ON public.regulatory_guides FOR INSERT WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_update_regulatory_guides" ON public.regulatory_guides FOR UPDATE USING (public.can_access_hospital(hospital_unit_id)) WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_delete_regulatory_guides" ON public.regulatory_guides FOR DELETE USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dev'));

-- ============ round_sessions ============
DROP POLICY IF EXISTS "Admins can delete round sessions" ON public.round_sessions;
DROP POLICY IF EXISTS "Authenticated users can create round sessions" ON public.round_sessions;
DROP POLICY IF EXISTS "Authenticated users can view round sessions" ON public.round_sessions;
DROP POLICY IF EXISTS "Authenticated users can update round sessions" ON public.round_sessions;
CREATE POLICY "tenant_select_round_sessions" ON public.round_sessions FOR SELECT USING (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_insert_round_sessions" ON public.round_sessions FOR INSERT WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_update_round_sessions" ON public.round_sessions FOR UPDATE USING (public.can_access_hospital(hospital_unit_id)) WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_delete_round_sessions" ON public.round_sessions FOR DELETE USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dev'));

-- ============ round_responses ============
DROP POLICY IF EXISTS "Admins can delete round responses" ON public.round_responses;
DROP POLICY IF EXISTS "Authenticated users can create round responses" ON public.round_responses;
DROP POLICY IF EXISTS "Authenticated users can view round responses" ON public.round_responses;
DROP POLICY IF EXISTS "Authenticated users can update round responses" ON public.round_responses;
CREATE POLICY "tenant_select_round_responses" ON public.round_responses FOR SELECT USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador') OR public.has_role(auth.uid(),'dev') OR public.is_gestor(auth.uid())
  OR EXISTS (SELECT 1 FROM public.round_sessions s WHERE s.id = round_responses.session_id AND public.can_access_hospital(s.hospital_unit_id))
);
CREATE POLICY "tenant_insert_round_responses" ON public.round_responses FOR INSERT WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador') OR public.has_role(auth.uid(),'dev') OR public.is_gestor(auth.uid())
  OR EXISTS (SELECT 1 FROM public.round_sessions s WHERE s.id = round_responses.session_id AND public.can_access_hospital(s.hospital_unit_id))
);
CREATE POLICY "tenant_update_round_responses" ON public.round_responses FOR UPDATE USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador') OR public.has_role(auth.uid(),'dev') OR public.is_gestor(auth.uid())
  OR EXISTS (SELECT 1 FROM public.round_sessions s WHERE s.id = round_responses.session_id AND public.can_access_hospital(s.hospital_unit_id))
);
CREATE POLICY "tenant_delete_round_responses" ON public.round_responses FOR DELETE USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dev'));

-- ============ round_section_goals ============
DROP POLICY IF EXISTS "Admins can delete round goals" ON public.round_section_goals;
DROP POLICY IF EXISTS "Authenticated users can create round goals" ON public.round_section_goals;
DROP POLICY IF EXISTS "Authenticated users can view round goals" ON public.round_section_goals;
DROP POLICY IF EXISTS "Authenticated users can update round goals" ON public.round_section_goals;
CREATE POLICY "tenant_select_round_section_goals" ON public.round_section_goals FOR SELECT USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador') OR public.has_role(auth.uid(),'dev') OR public.is_gestor(auth.uid())
  OR EXISTS (SELECT 1 FROM public.round_sessions s WHERE s.id = round_section_goals.session_id AND public.can_access_hospital(s.hospital_unit_id))
);
CREATE POLICY "tenant_insert_round_section_goals" ON public.round_section_goals FOR INSERT WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador') OR public.has_role(auth.uid(),'dev') OR public.is_gestor(auth.uid())
  OR EXISTS (SELECT 1 FROM public.round_sessions s WHERE s.id = round_section_goals.session_id AND public.can_access_hospital(s.hospital_unit_id))
);
CREATE POLICY "tenant_update_round_section_goals" ON public.round_section_goals FOR UPDATE USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador') OR public.has_role(auth.uid(),'dev') OR public.is_gestor(auth.uid())
  OR EXISTS (SELECT 1 FROM public.round_sessions s WHERE s.id = round_section_goals.session_id AND public.can_access_hospital(s.hospital_unit_id))
);
CREATE POLICY "tenant_delete_round_section_goals" ON public.round_section_goals FOR DELETE USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dev'));

-- ============ shift_handovers ============
DROP POLICY IF EXISTS "Admins podem deletar passagens" ON public.shift_handovers;
DROP POLICY IF EXISTS "Usuários autenticados podem criar passagens" ON public.shift_handovers;
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar passagens" ON public.shift_handovers;
DROP POLICY IF EXISTS "Criador ou admin podem atualizar passagens" ON public.shift_handovers;
CREATE POLICY "tenant_select_shift_handovers" ON public.shift_handovers FOR SELECT USING (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_insert_shift_handovers" ON public.shift_handovers FOR INSERT WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_update_shift_handovers" ON public.shift_handovers FOR UPDATE USING (public.can_access_hospital(hospital_unit_id)) WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_delete_shift_handovers" ON public.shift_handovers FOR DELETE USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dev'));

-- ============ pre_admissions ============
DROP POLICY IF EXISTS "Admins can delete pre-admissions" ON public.pre_admissions;
DROP POLICY IF EXISTS "Authenticated users can create pre-admissions" ON public.pre_admissions;
DROP POLICY IF EXISTS "Authenticated users can view pre-admissions" ON public.pre_admissions;
DROP POLICY IF EXISTS "Authenticated users can update pre-admissions" ON public.pre_admissions;
CREATE POLICY "tenant_select_pre_admissions" ON public.pre_admissions FOR SELECT USING (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_insert_pre_admissions" ON public.pre_admissions FOR INSERT WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_update_pre_admissions" ON public.pre_admissions FOR UPDATE USING (public.can_access_hospital(hospital_unit_id)) WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_delete_pre_admissions" ON public.pre_admissions FOR DELETE USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dev'));

-- ============ admission_histories ============
DROP POLICY IF EXISTS "Admins can delete admission histories" ON public.admission_histories;
DROP POLICY IF EXISTS "Authenticated users can create admission histories" ON public.admission_histories;
DROP POLICY IF EXISTS "Authenticated users can view admission histories" ON public.admission_histories;
DROP POLICY IF EXISTS "Authenticated users can update admission histories" ON public.admission_histories;
CREATE POLICY "tenant_select_admission_histories" ON public.admission_histories FOR SELECT USING (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_insert_admission_histories" ON public.admission_histories FOR INSERT WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_update_admission_histories" ON public.admission_histories FOR UPDATE USING (public.can_access_hospital(hospital_unit_id)) WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_delete_admission_histories" ON public.admission_histories FOR DELETE USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dev'));

-- ============ conduct_history ============
DROP POLICY IF EXISTS "Admins can delete conduct history" ON public.conduct_history;
DROP POLICY IF EXISTS "Authenticated users can insert conduct history" ON public.conduct_history;
DROP POLICY IF EXISTS "Authenticated users can view conduct history" ON public.conduct_history;
CREATE POLICY "tenant_select_conduct_history" ON public.conduct_history FOR SELECT USING (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_insert_conduct_history" ON public.conduct_history FOR INSERT WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_delete_conduct_history" ON public.conduct_history FOR DELETE USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dev'));

-- ============ patient_movements ============
DROP POLICY IF EXISTS "Admins podem deletar movimentações" ON public.patient_movements;
DROP POLICY IF EXISTS "Usuários autenticados podem criar movimentações" ON public.patient_movements;
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar movimentações" ON public.patient_movements;
DROP POLICY IF EXISTS "Setor administrativo pode liberar leitos" ON public.patient_movements;
CREATE POLICY "tenant_select_patient_movements" ON public.patient_movements FOR SELECT USING (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_insert_patient_movements" ON public.patient_movements FOR INSERT WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_update_patient_movements" ON public.patient_movements FOR UPDATE USING (public.can_access_hospital(hospital_unit_id)) WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_delete_patient_movements" ON public.patient_movements FOR DELETE USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dev'));

-- ============ patient_encounters ============
DROP POLICY IF EXISTS "Admins can delete encounters" ON public.patient_encounters;
DROP POLICY IF EXISTS "Authenticated users can create encounters" ON public.patient_encounters;
DROP POLICY IF EXISTS "Authenticated users can view encounters" ON public.patient_encounters;
DROP POLICY IF EXISTS "Authenticated users can update encounters" ON public.patient_encounters;
CREATE POLICY "tenant_select_patient_encounters" ON public.patient_encounters FOR SELECT USING (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_insert_patient_encounters" ON public.patient_encounters FOR INSERT WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_update_patient_encounters" ON public.patient_encounters FOR UPDATE USING (public.can_access_hospital(hospital_unit_id)) WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_delete_patient_encounters" ON public.patient_encounters FOR DELETE USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dev'));

-- ============ bed_census ============
DROP POLICY IF EXISTS "Only admins can delete bed census" ON public.bed_census;
DROP POLICY IF EXISTS "NIR and admins can insert bed census" ON public.bed_census;
DROP POLICY IF EXISTS "Authenticated users can view bed census" ON public.bed_census;
DROP POLICY IF EXISTS "NIR and admins can update bed census" ON public.bed_census;
CREATE POLICY "tenant_select_bed_census" ON public.bed_census FOR SELECT USING (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_insert_bed_census" ON public.bed_census FOR INSERT WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_update_bed_census" ON public.bed_census FOR UPDATE USING (public.can_access_hospital(hospital_unit_id)) WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_delete_bed_census" ON public.bed_census FOR DELETE USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dev'));

-- ============ bed_status_history ============
DROP POLICY IF EXISTS "System can insert bed status history" ON public.bed_status_history;
DROP POLICY IF EXISTS "Authenticated users can view bed status history" ON public.bed_status_history;
CREATE POLICY "tenant_select_bed_status_history" ON public.bed_status_history FOR SELECT USING (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_insert_bed_status_history" ON public.bed_status_history FOR INSERT WITH CHECK (public.can_access_hospital(hospital_unit_id));

-- ============ bed_allocation_requests ============
DROP POLICY IF EXISTS "Admins podem deletar solicitações" ON public.bed_allocation_requests;
DROP POLICY IF EXISTS "Usuários autenticados podem criar solicitações" ON public.bed_allocation_requests;
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar solicitações do mesmo" ON public.bed_allocation_requests;
DROP POLICY IF EXISTS "Admins e médicos podem atualizar solicitações" ON public.bed_allocation_requests;
CREATE POLICY "tenant_select_bar" ON public.bed_allocation_requests FOR SELECT USING (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_insert_bar" ON public.bed_allocation_requests FOR INSERT WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_update_bar" ON public.bed_allocation_requests FOR UPDATE USING (public.can_access_hospital(hospital_unit_id)) WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_delete_bar" ON public.bed_allocation_requests FOR DELETE USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dev'));

-- ============ regulation_requests ============
DROP POLICY IF EXISTS "Only admins can delete regulation requests" ON public.regulation_requests;
DROP POLICY IF EXISTS "Authenticated users can create regulation requests" ON public.regulation_requests;
DROP POLICY IF EXISTS "Authenticated users can view regulation requests" ON public.regulation_requests;
DROP POLICY IF EXISTS "NIR and admins can update regulation requests" ON public.regulation_requests;
CREATE POLICY "tenant_select_regulation_requests" ON public.regulation_requests FOR SELECT USING (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_insert_regulation_requests" ON public.regulation_requests FOR INSERT WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_update_regulation_requests" ON public.regulation_requests FOR UPDATE USING (public.can_access_hospital(hospital_unit_id)) WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_delete_regulation_requests" ON public.regulation_requests FOR DELETE USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dev'));

-- ============ internal_transfer_requests ============
DROP POLICY IF EXISTS "auth insert internal_transfer_requests" ON public.internal_transfer_requests;
DROP POLICY IF EXISTS "auth read internal_transfer_requests" ON public.internal_transfer_requests;
DROP POLICY IF EXISTS "auth update internal_transfer_requests" ON public.internal_transfer_requests;
CREATE POLICY "tenant_select_itr" ON public.internal_transfer_requests FOR SELECT USING (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_insert_itr" ON public.internal_transfer_requests FOR INSERT WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_update_itr" ON public.internal_transfer_requests FOR UPDATE USING (public.can_access_hospital(hospital_unit_id)) WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_delete_itr" ON public.internal_transfer_requests FOR DELETE USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dev'));

-- ============ patient_versions ============
DROP POLICY IF EXISTS "Admins podem deletar versões" ON public.patient_versions;
DROP POLICY IF EXISTS "Usuários autenticados podem criar versões" ON public.patient_versions;
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar versões" ON public.patient_versions;
CREATE POLICY "tenant_select_patient_versions" ON public.patient_versions FOR SELECT USING (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_insert_patient_versions" ON public.patient_versions FOR INSERT WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_delete_patient_versions" ON public.patient_versions FOR DELETE USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dev'));

-- ============ dhd_patients ============
DROP POLICY IF EXISTS "Authenticated users can delete DHD patients" ON public.dhd_patients;
DROP POLICY IF EXISTS "Authenticated users can create DHD patients" ON public.dhd_patients;
DROP POLICY IF EXISTS "Authenticated users can view DHD patients" ON public.dhd_patients;
DROP POLICY IF EXISTS "Authenticated users can update DHD patients" ON public.dhd_patients;
CREATE POLICY "tenant_select_dhd" ON public.dhd_patients FOR SELECT USING (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_insert_dhd" ON public.dhd_patients FOR INSERT WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_update_dhd" ON public.dhd_patients FOR UPDATE USING (public.can_access_hospital(hospital_unit_id)) WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_delete_dhd" ON public.dhd_patients FOR DELETE USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dev'));

-- ============ prescription_validations ============
DROP POLICY IF EXISTS "Admins can delete validations" ON public.prescription_validations;
DROP POLICY IF EXISTS "Authenticated users can create validations" ON public.prescription_validations;
DROP POLICY IF EXISTS "Authenticated users can view validations" ON public.prescription_validations;
DROP POLICY IF EXISTS "Validators and admins can update validations" ON public.prescription_validations;
CREATE POLICY "tenant_select_prescription_validations" ON public.prescription_validations FOR SELECT USING (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_insert_prescription_validations" ON public.prescription_validations FOR INSERT WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_update_prescription_validations" ON public.prescription_validations FOR UPDATE USING (public.can_access_hospital(hospital_unit_id)) WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_delete_prescription_validations" ON public.prescription_validations FOR DELETE USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dev'));

-- ============ reception_desk_sessions ============
DROP POLICY IF EXISTS "Admins can delete reception sessions" ON public.reception_desk_sessions;
DROP POLICY IF EXISTS "Users can create their own reception session" ON public.reception_desk_sessions;
DROP POLICY IF EXISTS "Authenticated users can view reception sessions" ON public.reception_desk_sessions;
DROP POLICY IF EXISTS "Users can update their own reception session" ON public.reception_desk_sessions;
CREATE POLICY "tenant_select_reception_desk" ON public.reception_desk_sessions FOR SELECT USING (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_insert_reception_desk" ON public.reception_desk_sessions FOR INSERT WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_update_reception_desk" ON public.reception_desk_sessions FOR UPDATE USING (public.can_access_hospital(hospital_unit_id)) WITH CHECK (public.can_access_hospital(hospital_unit_id));
CREATE POLICY "tenant_delete_reception_desk" ON public.reception_desk_sessions FOR DELETE USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dev'));

-- ============ ip_access_log: INSERT do próprio usuário ============
DROP POLICY IF EXISTS "Authenticated can insert own ip log" ON public.ip_access_log;
CREATE POLICY "Authenticated can insert own ip log" ON public.ip_access_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND (user_id = auth.uid() OR user_id IS NULL));
