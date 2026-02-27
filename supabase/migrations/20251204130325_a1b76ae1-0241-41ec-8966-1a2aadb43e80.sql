-- Update setup_medicoporta_user to also assign hospital unit
CREATE OR REPLACE FUNCTION public.setup_medicoporta_user()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_hospital_id uuid;
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
  
  -- Get the first hospital unit (Hospital Guarás) for Maranhão
  SELECT hu.id INTO v_hospital_id
  FROM public.hospital_units hu
  JOIN public.states s ON hu.state_id = s.id
  WHERE s.name = 'Maranhão'
  LIMIT 1;
  
  -- Add hospital assignment
  IF v_hospital_id IS NOT NULL THEN
    INSERT INTO public.user_hospital_assignments (user_id, hospital_unit_id)
    VALUES (v_user_id, v_hospital_id)
    ON CONFLICT DO NOTHING;
  END IF;
  
  RAISE NOTICE 'MEDICOPORTA user configured successfully with porta role, department, and hospital assignment';
END;
$function$;