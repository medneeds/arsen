
-- Add 'farmacia' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'farmacia';

-- Create setup function for farmacia generic user
CREATE OR REPLACE FUNCTION public.setup_farmacia_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'farmacia@sistema.local';
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'farmacia')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END;
$$;
