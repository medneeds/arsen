-- Create function to setup MEDICOUTI user (similar to MEDICOPORTA but for UTI)
CREATE OR REPLACE FUNCTION public.setup_medicouti_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get user ID from metadata where username is MEDICOUTI
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE raw_user_meta_data->>'username' = 'MEDICOUTI'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    -- Delete existing role if any
    DELETE FROM public.user_roles WHERE user_id = v_user_id;
    
    -- Insert medico role (UTI access)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'medico')
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Delete existing department assignments
    DELETE FROM public.user_departments WHERE user_id = v_user_id;

    -- Insert UTI department access only
    INSERT INTO public.user_departments (user_id, department)
    VALUES (v_user_id, 'UTI');
  END IF;
END;
$$;