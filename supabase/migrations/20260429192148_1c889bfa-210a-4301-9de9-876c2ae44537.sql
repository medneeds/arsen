-- Add CPF to profiles for user registration
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cpf text;
CREATE INDEX IF NOT EXISTS idx_profiles_cpf ON public.profiles(cpf) WHERE cpf IS NOT NULL;