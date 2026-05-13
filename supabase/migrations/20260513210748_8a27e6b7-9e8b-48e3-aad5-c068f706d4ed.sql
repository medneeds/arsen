
CREATE TABLE IF NOT EXISTS public.medical_record_edit_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medical_record_id uuid REFERENCES public.medical_records(id) ON DELETE SET NULL,
  patient_id uuid,
  patient_registry_id uuid,
  field_changed text NOT NULL,
  old_value text,
  new_value text,
  reason text NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  changed_by_email text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mreh_medical_record ON public.medical_record_edit_history(medical_record_id);
CREATE INDEX IF NOT EXISTS idx_mreh_patient ON public.medical_record_edit_history(patient_id);
CREATE INDEX IF NOT EXISTS idx_mreh_changed_at ON public.medical_record_edit_history(changed_at DESC);

ALTER TABLE public.medical_record_edit_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read mreh"
  ON public.medical_record_edit_history FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert mreh"
  ON public.medical_record_edit_history FOR INSERT
  TO authenticated WITH CHECK (changed_by = auth.uid());

-- Bloqueia update/delete (auditoria imutável)
CREATE POLICY "No update mreh" ON public.medical_record_edit_history FOR UPDATE TO authenticated USING (false);
CREATE POLICY "No delete mreh" ON public.medical_record_edit_history FOR DELETE TO authenticated USING (false);
