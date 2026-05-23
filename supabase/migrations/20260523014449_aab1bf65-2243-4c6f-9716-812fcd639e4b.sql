CREATE OR REPLACE FUNCTION public.verify_user_password_by_id(p_user_id uuid, p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash text;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF p_password IS NULL OR length(p_password) = 0 OR length(p_password) > 256 THEN
    RETURN false;
  END IF;

  SELECT encrypted_password
    INTO v_hash
  FROM auth.users
  WHERE id = p_user_id;

  IF v_hash IS NULL OR v_hash = '' THEN
    RETURN false;
  END IF;

  RETURN v_hash = extensions.crypt(p_password, v_hash);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_user_password_by_id(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verify_user_password_by_id(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.verify_user_password_by_id(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.verify_user_password_by_id(uuid, text) TO service_role;