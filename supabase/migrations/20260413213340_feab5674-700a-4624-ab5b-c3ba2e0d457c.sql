-- Add professional fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS professional_type text DEFAULT 'medico',
ADD COLUMN IF NOT EXISTS matricula text,
ADD COLUMN IF NOT EXISTS cargo text,
ADD COLUMN IF NOT EXISTS access_profile text DEFAULT 'medico';