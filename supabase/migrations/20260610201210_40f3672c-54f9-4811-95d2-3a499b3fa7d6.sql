CREATE INDEX IF NOT EXISTS idx_prescriptions_unit_created_at
  ON public.prescriptions (hospital_unit_id, created_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_exam_requests_unit_patient_created
  ON public.exam_requests (hospital_unit_id, patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_exam_requests_unit_state_category_created
  ON public.exam_requests (hospital_unit_id, state_id, category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_patient_movements_patient_created
  ON public.patient_movements (patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_patients_unit_state_sector_order
  ON public.patients (hospital_unit_id, state_id, sector, display_order, bed_number);