-- Create a helper function to update user password
CREATE OR REPLACE FUNCTION public.admin_update_user_password(
  p_email TEXT,
  p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_result JSONB;
BEGIN
  -- Find user by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found', 'email', p_email);
  END IF;
  
  -- Update password using encrypted_password
  UPDATE auth.users
  SET 
    encrypted_password = crypt(p_new_password, gen_salt('bf')),
    updated_at = now()
  WHERE id = v_user_id;
  
  RETURN jsonb_build_object('success', true, 'user_id', v_user_id, 'email', p_email);
END;
$$;

-- Create function to get auth user by email
CREATE OR REPLACE FUNCTION public.get_auth_user_id_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email;
  
  RETURN v_user_id;
END;
$$;