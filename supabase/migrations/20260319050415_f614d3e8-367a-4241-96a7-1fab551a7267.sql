
CREATE TABLE public.culture_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  patient_name text NOT NULL,
  patient_sector text NOT NULL,
  patient_bed text,
  culture_type text NOT NULL DEFAULT 'hemocultura',
  collection_date date,
  result_text text,
  result_files jsonb DEFAULT '[]'::jsonb,
  microorganism text,
  antibiogram text,
  sensitivity_profile text,
  status text NOT NULL DEFAULT 'pending',
  uploaded_by uuid,
  uploaded_by_name text,
  notified_at timestamp with time zone,
  read_by_doctor boolean DEFAULT false,
  read_at timestamp with time zone,
  hospital_unit_id uuid NOT NULL REFERENCES public.hospital_units(id),
  state_id uuid NOT NULL REFERENCES public.states(id),
  department text NOT NULL DEFAULT 'URGÊNCIA E EMERGÊNCIA ADULTO',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.culture_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view culture results"
  ON public.culture_results FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create culture results"
  ON public.culture_results FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update culture results"
  ON public.culture_results FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete culture results"
  ON public.culture_results FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.culture_results;
