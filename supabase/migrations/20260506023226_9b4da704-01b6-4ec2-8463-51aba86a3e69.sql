ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- Username sempre minúsculo, slug-friendly. Único quando definido.
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_unique
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL AND length(trim(username)) > 0;

CREATE OR REPLACE FUNCTION public.is_username_available(p_username text, p_exclude_user uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(username) = lower(trim(p_username))
      AND (p_exclude_user IS NULL OR id <> p_exclude_user)
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_username_available(text, uuid) TO authenticated, anon;