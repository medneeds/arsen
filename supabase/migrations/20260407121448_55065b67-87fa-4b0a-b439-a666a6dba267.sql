
-- Bed census: real-time status of every bed
CREATE TABLE public.bed_census (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hospital_unit_id uuid NOT NULL REFERENCES public.hospital_units(id),
  state_id uuid NOT NULL REFERENCES public.states(id),
  sector text NOT NULL,
  bed_number text NOT NULL,
  status text NOT NULL DEFAULT 'vago',
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  patient_name text,
  block_reason text,
  block_started_at timestamptz,
  reserved_for text,
  reserved_until timestamptz,
  updated_by uuid,
  updated_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(hospital_unit_id, sector, bed_number)
);

ALTER TABLE public.bed_census ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view bed census"
  ON public.bed_census FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "NIR and admins can insert bed census"
  ON public.bed_census FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'nir'::app_role));

CREATE POLICY "NIR and admins can update bed census"
  ON public.bed_census FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'nir'::app_role));

CREATE POLICY "Only admins can delete bed census"
  ON public.bed_census FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Regulation requests
CREATE TABLE public.regulation_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hospital_unit_id uuid NOT NULL REFERENCES public.hospital_units(id),
  state_id uuid NOT NULL REFERENCES public.states(id),
  department text NOT NULL DEFAULT 'URGÊNCIA E EMERGÊNCIA ADULTO',
  request_type text NOT NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  patient_name text NOT NULL,
  patient_age text,
  patient_sex text,
  patient_record text,
  origin_sector text,
  origin_bed text,
  destination_sector text,
  destination_bed text,
  destination_unit text,
  priority text NOT NULL DEFAULT 'rotina',
  status text NOT NULL DEFAULT 'pendente',
  reason text,
  clinical_summary text,
  cid_primary text,
  cid_secondary text,
  sisreg_code text,
  sisreg_status text,
  requested_by uuid,
  requested_by_name text,
  regulator_id uuid,
  regulator_name text,
  approved_at timestamptz,
  completed_at timestamptz,
  canceled_at timestamptz,
  cancellation_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.regulation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view regulation requests"
  ON public.regulation_requests FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create regulation requests"
  ON public.regulation_requests FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "NIR and admins can update regulation requests"
  ON public.regulation_requests FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'nir'::app_role));

CREATE POLICY "Only admins can delete regulation requests"
  ON public.regulation_requests FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Bed status history
CREATE TABLE public.bed_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hospital_unit_id uuid NOT NULL REFERENCES public.hospital_units(id),
  state_id uuid NOT NULL REFERENCES public.states(id),
  bed_census_id uuid REFERENCES public.bed_census(id) ON DELETE CASCADE,
  sector text NOT NULL,
  bed_number text NOT NULL,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid,
  changed_by_name text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bed_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view bed status history"
  ON public.bed_status_history FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert bed status history"
  ON public.bed_status_history FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Indexes
CREATE INDEX idx_bed_census_hospital_sector ON public.bed_census(hospital_unit_id, sector);
CREATE INDEX idx_bed_census_status ON public.bed_census(status);
CREATE INDEX idx_regulation_requests_hospital ON public.regulation_requests(hospital_unit_id, state_id);
CREATE INDEX idx_regulation_requests_status ON public.regulation_requests(status);
CREATE INDEX idx_regulation_requests_type ON public.regulation_requests(request_type);
CREATE INDEX idx_bed_status_history_census ON public.bed_status_history(bed_census_id);

-- Triggers
CREATE TRIGGER update_bed_census_updated_at
  BEFORE UPDATE ON public.bed_census
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_regulation_requests_updated_at
  BEFORE UPDATE ON public.regulation_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.bed_census;
ALTER PUBLICATION supabase_realtime ADD TABLE public.regulation_requests;
