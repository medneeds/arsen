
-- Round sessions (one per patient per day)
CREATE TABLE public.round_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  patient_social_name TEXT,
  patient_birth_date DATE,
  patient_age TEXT,
  patient_sector TEXT,
  patient_bed TEXT,
  admission_reason TEXT,
  round_date DATE NOT NULL DEFAULT CURRENT_DATE,
  hospital_unit_id UUID NOT NULL REFERENCES public.hospital_units(id),
  state_id UUID NOT NULL REFERENCES public.states(id),
  department TEXT NOT NULL DEFAULT 'UTI',
  observations TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(patient_id, round_date, hospital_unit_id)
);

-- Round responses (one per checklist item per session)
CREATE TABLE public.round_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.round_sessions(id) ON DELETE CASCADE,
  section_code TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  status TEXT, -- S, N, CI, NA, O, D
  observation TEXT,
  professional_id UUID,
  professional_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Section goals per session
CREATE TABLE public.round_section_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.round_sessions(id) ON DELETE CASCADE,
  section_code TEXT NOT NULL,
  goal TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, section_code)
);

-- RLS
ALTER TABLE public.round_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_section_goals ENABLE ROW LEVEL SECURITY;

-- round_sessions policies
CREATE POLICY "Authenticated users can view round sessions" ON public.round_sessions FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create round sessions" ON public.round_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update round sessions" ON public.round_sessions FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can delete round sessions" ON public.round_sessions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- round_responses policies
CREATE POLICY "Authenticated users can view round responses" ON public.round_responses FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create round responses" ON public.round_responses FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update round responses" ON public.round_responses FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can delete round responses" ON public.round_responses FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- round_section_goals policies
CREATE POLICY "Authenticated users can view round goals" ON public.round_section_goals FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create round goals" ON public.round_section_goals FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update round goals" ON public.round_section_goals FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can delete round goals" ON public.round_section_goals FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Updated_at triggers
CREATE TRIGGER update_round_sessions_updated_at BEFORE UPDATE ON public.round_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_round_responses_updated_at BEFORE UPDATE ON public.round_responses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_round_section_goals_updated_at BEFORE UPDATE ON public.round_section_goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
