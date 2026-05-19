
CREATE TABLE public.internal_transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  source_bed text,
  source_sector text,
  patient_name text NOT NULL,
  patient_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  encounter_code text,
  target_sector_code text NOT NULL,
  target_sector_label text,
  classification text NOT NULL,
  requires_saps boolean NOT NULL DEFAULT false,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','cancelled')),
  signaled_by uuid,
  signaled_at timestamptz NOT NULL DEFAULT now(),
  completed_by uuid,
  completed_at timestamptz,
  completed_target_patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  cancelled_by uuid,
  cancelled_at timestamptz,
  cancellation_reason text,
  hospital_unit_id uuid NOT NULL,
  state_id uuid NOT NULL,
  department text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_itr_status_unit_sector ON public.internal_transfer_requests (hospital_unit_id, status, target_sector_code);
CREATE INDEX idx_itr_source_patient ON public.internal_transfer_requests (source_patient_id);

ALTER TABLE public.internal_transfer_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read internal_transfer_requests"
  ON public.internal_transfer_requests FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "auth insert internal_transfer_requests"
  ON public.internal_transfer_requests FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "auth update internal_transfer_requests"
  ON public.internal_transfer_requests FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_itr_updated_at
  BEFORE UPDATE ON public.internal_transfer_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_transfer_requests;
