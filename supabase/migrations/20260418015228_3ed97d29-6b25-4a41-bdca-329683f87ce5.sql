-- Tabela de favoritos/uso frequente do médico
CREATE TABLE IF NOT EXISTS public.medication_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  medication_id TEXT NOT NULL,
  medication_name TEXT NOT NULL,
  category TEXT NOT NULL,
  use_count INTEGER NOT NULL DEFAULT 1,
  last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, medication_id)
);

CREATE INDEX IF NOT EXISTS idx_medication_favorites_user_count
  ON public.medication_favorites (user_id, use_count DESC, last_used_at DESC);

ALTER TABLE public.medication_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own favorites"
  ON public.medication_favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own favorites"
  ON public.medication_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own favorites"
  ON public.medication_favorites FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own favorites"
  ON public.medication_favorites FOR DELETE
  USING (auth.uid() = user_id);

-- RPC para registrar uso (upsert + increment atômico)
CREATE OR REPLACE FUNCTION public.track_medication_use(
  p_medication_id TEXT,
  p_medication_name TEXT,
  p_category TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  INSERT INTO public.medication_favorites (user_id, medication_id, medication_name, category, use_count, last_used_at)
  VALUES (auth.uid(), p_medication_id, p_medication_name, p_category, 1, now())
  ON CONFLICT (user_id, medication_id)
  DO UPDATE SET
    use_count = public.medication_favorites.use_count + 1,
    last_used_at = now(),
    medication_name = EXCLUDED.medication_name,
    category = EXCLUDED.category;
END;
$$;