-- Update handle_new_user function to recognize MEDICOPORTA instead of BIGDOOR
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_role text;
  username text;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    CASE 
      WHEN NEW.email LIKE '%@sistema.local' THEN NULL
      ELSE NEW.email
    END
  );
  
  -- Get username from metadata or extract from email
  username := COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1));
  
  -- Check if role is specified in metadata
  user_role := NEW.raw_user_meta_data->>'role';
  
  -- Auto-assign roles based on username patterns
  IF UPPER(username) = 'VISITANTE' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'visitante');
  ELSIF UPPER(username) = 'MEDICOPORTA' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'porta');
  ELSIF UPPER(username) = 'COORDENADOR' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSIF user_role = 'porta' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'porta');
  ELSIF user_role = 'visitante' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'visitante');
  ELSIF user_role = 'admin' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSE
    -- Default to medico role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'medico');
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update setup function to use new username
CREATE OR REPLACE FUNCTION public.setup_medicoporta_user()
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
  WHERE email = 'medicoporta@sistema.local';
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'MEDICOPORTA user not found. Please create the user first through signup.';
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
  
  RAISE NOTICE 'MEDICOPORTA user configured successfully with porta role';
END;
$function$;

-- Drop old function
DROP FUNCTION IF EXISTS public.setup_bigdoor_user();