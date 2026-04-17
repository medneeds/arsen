-- Recepção: posto (vertical/horizontal) por atendimento e sessão de trabalho do recepcionista

-- 1) Coluna reception_point no encounter
ALTER TABLE public.patient_encounters
  ADD COLUMN IF NOT EXISTS reception_point text
  CHECK (reception_point IN ('vertical', 'horizontal'));

CREATE INDEX IF NOT EXISTS idx_patient_encounters_reception_point
  ON public.patient_encounters (reception_point, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_patient_encounters_created_by_created_at
  ON public.patient_encounters (created_by, created_at DESC);

-- 2) Tabela de sessões do posto de recepção (turno ativo do recepcionista)
CREATE TABLE IF NOT EXISTS public.reception_desk_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_name text,
  reception_point text NOT NULL CHECK (reception_point IN ('vertical', 'horizontal')),
  hospital_unit_id uuid NOT NULL,
  state_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reception_desk_sessions_user_active
  ON public.reception_desk_sessions (user_id, ended_at);

CREATE INDEX IF NOT EXISTS idx_reception_desk_sessions_unit_active
  ON public.reception_desk_sessions (hospital_unit_id, ended_at, reception_point);

ALTER TABLE public.reception_desk_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view reception sessions"
  ON public.reception_desk_sessions
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create their own reception session"
  ON public.reception_desk_sessions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reception session"
  ON public.reception_desk_sessions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete reception sessions"
  ON public.reception_desk_sessions
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));