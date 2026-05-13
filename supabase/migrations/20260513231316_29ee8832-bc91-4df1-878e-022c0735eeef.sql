CREATE TABLE IF NOT EXISTS public.patient_registry_edit_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_registry_id uuid NOT NULL,
  patient_id uuid,
  field_changed text NOT NULL,
  old_value text,
  new_value text,
  reason text NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  changed_by uuid,
  changed_by_email text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_preh_registry ON public.patient_registry_edit_history(patient_registry_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_preh_patient ON public.patient_registry_edit_history(patient_id, changed_at DESC);

ALTER TABLE public.patient_registry_edit_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read preh"
  ON public.patient_registry_edit_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert preh"
  ON public.patient_registry_edit_history FOR INSERT TO authenticated
  WITH CHECK (changed_by = auth.uid());

CREATE POLICY "No update preh"
  ON public.patient_registry_edit_history FOR UPDATE TO authenticated USING (false);

CREATE POLICY "No delete preh"
  ON public.patient_registry_edit_history FOR DELETE TO authenticated USING (false);