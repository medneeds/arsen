-- Add new columns to profiles table for individual user registration
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS crm TEXT,
ADD COLUMN IF NOT EXISTS specialty TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approved_by UUID;

-- Create index for faster status lookups
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.status IS 'User status: pending, approved, rejected, suspended';
COMMENT ON COLUMN public.profiles.crm IS 'Medical registration number (Conselho Regional de Medicina)';

-- Update RLS policies for profiles to allow insert on signup
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Allow admins to update any profile (for approval)
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete profiles
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles" 
ON public.profiles 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));