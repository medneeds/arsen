-- 1) Coluna lista de perfis
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS access_profiles text[] NOT NULL DEFAULT ARRAY[]::text[];

-- 2) Backfill a partir do access_profile singular existente
UPDATE public.profiles
SET access_profiles = ARRAY[access_profile]
WHERE access_profile IS NOT NULL
  AND (access_profiles IS NULL OR array_length(access_profiles, 1) IS NULL);

-- 3) Trigger: garante que access_profile = access_profiles[1] quando houver lista
CREATE OR REPLACE FUNCTION public.sync_primary_access_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.access_profiles IS NOT NULL AND array_length(NEW.access_profiles, 1) > 0 THEN
    NEW.access_profile := NEW.access_profiles[1];
  ELSIF NEW.access_profile IS NOT NULL THEN
    -- Se vier só o singular preenchido, espelha para a lista
    NEW.access_profiles := ARRAY[NEW.access_profile];
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_primary_access_profile ON public.profiles;
CREATE TRIGGER trg_sync_primary_access_profile
BEFORE INSERT OR UPDATE OF access_profile, access_profiles ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_primary_access_profile();

-- 4) Índice GIN para consultas futuras por perfil
CREATE INDEX IF NOT EXISTS idx_profiles_access_profiles ON public.profiles USING GIN (access_profiles);