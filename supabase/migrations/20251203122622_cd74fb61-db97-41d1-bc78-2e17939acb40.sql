-- Update role for BIGDOOR user to 'porta'
-- This should be run after the user is created through signup

-- Create a function to set up BIGDOOR user (run after signup)
CREATE OR REPLACE FUNCTION public.setup_bigdoor_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Find user by email (internal email format)
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'bigdoor@sistema.local';
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'BIGDOOR user not found. Please create the user first through signup.';
    RETURN;
  END IF;
  
  -- Update or insert role to 'porta'
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'porta')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Remove any other roles if exists
  DELETE FROM public.user_roles 
  WHERE user_id = v_user_id AND role != 'porta';
  
  -- Add department access for URGÊNCIA E EMERGÊNCIA ADULTO
  INSERT INTO public.user_departments (user_id, department)
  VALUES (v_user_id, 'URGÊNCIA E EMERGÊNCIA ADULTO')
  ON CONFLICT DO NOTHING;
  
  RAISE NOTICE 'BIGDOOR user configured successfully with porta role';
END;
$$;

-- Run the setup function
SELECT public.setup_bigdoor_user();