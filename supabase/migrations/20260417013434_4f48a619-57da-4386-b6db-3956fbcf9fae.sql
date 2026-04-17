-- =====================================================
-- 1) VÍNCULO PERMANENTE AO PRONTUÁRIO
-- =====================================================
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS patient_registry_id UUID REFERENCES public.patient_registry(id) ON DELETE SET NULL;

ALTER TABLE public.clinical_evolutions
  ADD COLUMN IF NOT EXISTS patient_registry_id UUID REFERENCES public.patient_registry(id) ON DELETE SET NULL;

ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS patient_registry_id UUID REFERENCES public.patient_registry(id) ON DELETE SET NULL;

ALTER TABLE public.exam_requests
  ADD COLUMN IF NOT EXISTS patient_registry_id UUID REFERENCES public.patient_registry(id) ON DELETE SET NULL;

ALTER TABLE public.culture_results
  ADD COLUMN IF NOT EXISTS patient_registry_id UUID REFERENCES public.patient_registry(id) ON DELETE SET NULL;

ALTER TABLE public.patient_movements
  ADD COLUMN IF NOT EXISTS patient_registry_id UUID REFERENCES public.patient_registry(id) ON DELETE SET NULL;

ALTER TABLE public.admission_histories
  ADD COLUMN IF NOT EXISTS patient_registry_id UUID REFERENCES public.patient_registry(id) ON DELETE SET NULL;

ALTER TABLE public.dhd_patients
  ADD COLUMN IF NOT EXISTS patient_registry_id UUID REFERENCES public.patient_registry(id) ON DELETE SET NULL;

ALTER TABLE public.pre_admissions
  ADD COLUMN IF NOT EXISTS patient_registry_id UUID REFERENCES public.patient_registry(id) ON DELETE SET NULL;

ALTER TABLE public.conduct_history
  ADD COLUMN IF NOT EXISTS patient_registry_id UUID REFERENCES public.patient_registry(id) ON DELETE SET NULL;

-- Índices para consultas temporais por prontuário
CREATE INDEX IF NOT EXISTS idx_patients_registry ON public.patients(patient_registry_id);
CREATE INDEX IF NOT EXISTS idx_evolutions_registry_created ON public.clinical_evolutions(patient_registry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prescriptions_registry_created ON public.prescriptions(patient_registry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exams_registry_created ON public.exam_requests(patient_registry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cultures_registry_created ON public.culture_results(patient_registry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_registry_created ON public.patient_movements(patient_registry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admissions_registry_created ON public.admission_histories(patient_registry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conduct_registry_created ON public.conduct_history(patient_registry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_encounters_registry_created ON public.patient_encounters(registry_id, created_at DESC);

-- =====================================================
-- 2) AUDITORIA TEMPORAL — triggers em todas as tabelas clínicas
-- =====================================================
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'patients', 'clinical_evolutions', 'prescriptions', 'exam_requests',
    'culture_results', 'patient_movements', 'admission_histories',
    'dhd_patients', 'pre_admissions', 'conduct_history',
    'patient_encounters', 'bed_census', 'prescription_validations',
    'dispensations', 'patient_registry'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%I ON public.%I', tbl, tbl);
    EXECUTE format('CREATE TRIGGER audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function()', tbl, tbl);
  END LOOP;
END$$;

-- =====================================================
-- 3) VIEW UNIFICADA: patient_timeline
-- =====================================================
CREATE OR REPLACE VIEW public.patient_timeline AS
-- Admissão / Pré-admissão
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
-- Atendimento
SELECT
  pe.id::TEXT, 'encounter', 'Atendimento iniciado',
  pe.created_at, pe.registry_id, pe.patient_id, pe.patient_name,
  pe.created_by, pe.hospital_unit_id, pe.state_id, pe.department,
  CONCAT('Código ', pe.encounter_code, COALESCE(' • ' || pe.destination_sector, '')),
  to_jsonb(pe)
FROM public.patient_encounters pe
UNION ALL
-- História de admissão
SELECT
  ah.id::TEXT, 'admission_history', 'História de admissão',
  ah.created_at, ah.patient_registry_id, ah.patient_id, NULL,
  ah.created_by, ah.hospital_unit_id, ah.state_id, ah.department,
  COALESCE(ah.diagnostic_hypothesis, ah.chief_complaint, 'Admissão registrada'),
  to_jsonb(ah)
FROM public.admission_histories ah
UNION ALL
-- Evolução clínica
SELECT
  ce.id::TEXT, 'evolution', 'Evolução clínica',
  ce.created_at, ce.patient_registry_id, ce.patient_id, ce.patient_name,
  ce.created_by, ce.hospital_unit_id, ce.state_id, ce.department,
  CONCAT('Status: ', ce.status, COALESCE(' • por ' || ce.created_by_name, '')),
  to_jsonb(ce)
FROM public.clinical_evolutions ce
UNION ALL
-- Prescrição
SELECT
  pr.id::TEXT, 'prescription', 'Prescrição',
  pr.created_at, pr.patient_registry_id, NULL, pr.patient_name,
  pr.created_by, pr.hospital_unit_id, pr.state_id, pr.department,
  CONCAT('Versão ', pr.version, ' • ', pr.status),
  to_jsonb(pr)
FROM public.prescriptions pr
UNION ALL
-- Exames
SELECT
  er.id::TEXT, 'exam_request', CONCAT('Exame: ', er.category),
  er.created_at, er.patient_registry_id, er.patient_id, er.patient_name,
  er.requested_by, er.hospital_unit_id, er.state_id, er.department,
  CONCAT(er.priority, ' • ', er.status, COALESCE(' • ' || er.clinical_indication, '')),
  to_jsonb(er)
FROM public.exam_requests er
UNION ALL
-- Culturas
SELECT
  cr.id::TEXT, 'culture_result', 'Cultura microbiológica',
  cr.created_at, cr.patient_registry_id, cr.patient_id, cr.patient_name,
  cr.uploaded_by, cr.hospital_unit_id, cr.state_id, cr.department,
  CONCAT(cr.culture_type, COALESCE(' • ' || cr.microorganism, ''), ' • ', cr.status),
  to_jsonb(cr)
FROM public.culture_results cr
UNION ALL
-- Movimentações
SELECT
  pm.id::TEXT, 'movement', CONCAT('Movimentação: ', pm.movement_type),
  pm.created_at, pm.patient_registry_id, pm.patient_id, pm.patient_name,
  pm.created_by, pm.hospital_unit_id, pm.state_id, pm.department,
  CONCAT(COALESCE(pm.patient_sector || ' → ', ''), COALESCE(pm.destination, '—')),
  to_jsonb(pm)
FROM public.patient_movements pm
UNION ALL
-- Alterações de conduta
SELECT
  ch.id::TEXT, 'conduct_change', CONCAT('Conduta: ', ch.field_name),
  ch.created_at, ch.patient_registry_id, ch.patient_id, NULL,
  ch.changed_by, ch.hospital_unit_id, ch.state_id, ch.department,
  CONCAT('Alterado por ', COALESCE(ch.changed_by_email, '—')),
  to_jsonb(ch)
FROM public.conduct_history ch
UNION ALL
-- Mudança de status de leito
SELECT
  bsh.id::TEXT, 'bed_status', CONCAT('Leito ', bsh.bed_number, ': ', bsh.new_status),
  bsh.created_at, NULL, NULL, NULL,
  bsh.changed_by, bsh.hospital_unit_id, bsh.state_id, NULL,
  CONCAT(COALESCE(bsh.old_status || ' → ', ''), bsh.new_status, COALESCE(' • ' || bsh.reason, '')),
  to_jsonb(bsh)
FROM public.bed_status_history bsh
UNION ALL
-- Dispensações
SELECT
  d.id::TEXT, 'dispensation', 'Dispensação farmacêutica',
  d.dispensed_at, NULL, NULL, d.patient_name,
  d.dispensed_by, d.hospital_unit_id, d.state_id, d.department,
  CONCAT('Código ', d.dispensation_code, COALESCE(' • por ' || d.dispensed_by_name, '')),
  to_jsonb(d)
FROM public.dispensations d
UNION ALL
-- DHD
SELECT
  dp.id::TEXT, 'dhd', 'Dose Hospitalar Domiciliar',
  dp.created_at, dp.patient_registry_id, NULL, dp.patient_name,
  dp.created_by, dp.hospital_unit_id, dp.state_id, dp.department,
  CONCAT(dp.status, COALESCE(' • ' || dp.diagnosis, '')),
  to_jsonb(dp)
FROM public.dhd_patients dp;

-- =====================================================
-- 4) RPC para consulta filtrada da timeline
-- =====================================================
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
  event_id TEXT,
  event_type TEXT,
  event_label TEXT,
  event_at TIMESTAMPTZ,
  patient_registry_id UUID,
  patient_id UUID,
  patient_name TEXT,
  author_id UUID,
  author_email TEXT,
  hospital_unit_id UUID,
  state_id UUID,
  department TEXT,
  summary TEXT,
  payload JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
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

-- =====================================================
-- 5) Função: criar snapshot completo do prontuário
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_patient_snapshot(
  p_patient_id UUID,
  p_description TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot JSONB;
  v_patient public.patients%ROWTYPE;
  v_id UUID;
BEGIN
  SELECT * INTO v_patient FROM public.patients WHERE id = p_patient_id;
  IF v_patient.id IS NULL THEN
    RAISE EXCEPTION 'Paciente não encontrado: %', p_patient_id;
  END IF;

  v_snapshot := jsonb_build_object(
    'patient', to_jsonb(v_patient),
    'evolutions', (SELECT jsonb_agg(to_jsonb(e)) FROM public.clinical_evolutions e WHERE e.patient_id = p_patient_id),
    'prescriptions', (SELECT jsonb_agg(to_jsonb(p)) FROM public.prescriptions p WHERE (p.patient_data->>'id')::UUID = p_patient_id),
    'exams', (SELECT jsonb_agg(to_jsonb(x)) FROM public.exam_requests x WHERE x.patient_id = p_patient_id),
    'cultures', (SELECT jsonb_agg(to_jsonb(c)) FROM public.culture_results c WHERE c.patient_id = p_patient_id),
    'movements', (SELECT jsonb_agg(to_jsonb(m)) FROM public.patient_movements m WHERE m.patient_id = p_patient_id),
    'snapshot_at', now()
  );

  INSERT INTO public.patient_versions (
    snapshot_data, description, hospital_unit_id, state_id, department, created_by
  ) VALUES (
    v_snapshot, p_description, v_patient.hospital_unit_id, v_patient.state_id,
    v_patient.department, auth.uid()
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;