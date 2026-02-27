-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Recreate the function using the extensions schema
CREATE OR REPLACE FUNCTION public.admin_update_user_password(
  p_email TEXT,
  p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Find user by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found', 'email', p_email);
  END IF;
  
  -- Update password using encrypted_password with pgcrypto
  UPDATE auth.users
  SET 
    encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
    updated_at = now()
  WHERE id = v_user_id;
  
  RETURN jsonb_build_object('success', true, 'user_id', v_user_id, 'email', p_email);
END;
$$;