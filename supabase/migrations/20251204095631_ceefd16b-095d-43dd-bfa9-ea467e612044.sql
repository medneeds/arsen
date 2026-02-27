-- Update handle_new_user to automatically assign visitante role based on username
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
  ELSIF UPPER(username) = 'BIGDOOR' THEN
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