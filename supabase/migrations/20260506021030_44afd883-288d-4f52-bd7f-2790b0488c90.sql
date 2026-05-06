
CREATE TABLE IF NOT EXISTS public.pre_registration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  cpf text NOT NULL,
  phone text NOT NULL,
  crm text,
  access_profile text NOT NULL DEFAULT 'medico',
  hospital_unit_id uuid REFERENCES public.hospital_units(id) ON DELETE SET NULL,
  justification text,
  status text NOT NULL DEFAULT 'pending',
  reviewer_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_user_id uuid,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prereq_status ON public.pre_registration_requests(status);
CREATE INDEX IF NOT EXISTS idx_prereq_created_at ON public.pre_registration_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prereq_cpf ON public.pre_registration_requests(cpf);

ALTER TABLE public.pre_registration_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (anon or auth) can submit a pre-registration
CREATE POLICY "Anyone can submit pre-registration"
ON public.pre_registration_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (status = 'pending');

-- Admins and gestores can read all pre-registrations
CREATE POLICY "Admins/gestores can view pre-registrations"
ON public.pre_registration_requests
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.access_profile = 'gestor'
  )
);

-- Admins and gestores can update (review) pre-registrations
CREATE POLICY "Admins/gestores can update pre-registrations"
ON public.pre_registration_requests
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.access_profile = 'gestor'
  )
);

-- Admins can delete
CREATE POLICY "Admins can delete pre-registrations"
ON public.pre_registration_requests
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
CREATE TRIGGER update_pre_registration_requests_updated_at
BEFORE UPDATE ON public.pre_registration_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
