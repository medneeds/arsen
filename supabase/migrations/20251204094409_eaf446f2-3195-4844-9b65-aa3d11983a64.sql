-- Add 'visitante' role to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'visitante';

-- Create function to setup visitante user (will be called after signup)
CREATE OR REPLACE FUNCTION public.setup_visitante_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  -- Find user by email (internal email format)
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'visitante@sistema.local';
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'VISITANTE user not found. Please create the user first through signup.';
    RETURN;
  END IF;
  
  -- Update or insert role to 'visitante'
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'visitante')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Remove any other roles if exists
  DELETE FROM public.user_roles 
  WHERE user_id = v_user_id AND role != 'visitante';
  
  RAISE NOTICE 'VISITANTE user configured successfully with visitante role';
END;
$function$;