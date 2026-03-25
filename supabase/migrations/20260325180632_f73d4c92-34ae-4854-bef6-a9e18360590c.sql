
-- CID-10 codes table
CREATE TABLE public.cid10_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text NOT NULL,
  category text NOT NULL,
  chapter text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cid10_codes ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read
CREATE POLICY "Authenticated users can view CID codes"
  ON public.cid10_codes FOR SELECT TO authenticated
  USING (true);

-- Admins can manage
CREATE POLICY "Admins can manage CID codes"
  ON public.cid10_codes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create index for text search
CREATE INDEX idx_cid10_code ON public.cid10_codes (code);
CREATE INDEX idx_cid10_description ON public.cid10_codes USING gin (to_tsvector('portuguese', description));

-- Add CID fields to admission_histories
ALTER TABLE public.admission_histories
  ADD COLUMN cid_primary text,
  ADD COLUMN cid_secondary text,
  ADD COLUMN macro_diagnosis text;
