CREATE OR REPLACE FUNCTION public.verify_own_password(p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF p_password IS NULL OR length(p_password) = 0 OR length(p_password) > 256 THEN
    RETURN false;
  END IF;

  SELECT encrypted_password
    INTO v_hash
  FROM auth.users
  WHERE id = auth.uid();

  IF v_hash IS NULL OR v_hash = '' THEN
    RETURN false;
  END IF;

  RETURN v_hash = extensions.crypt(p_password, v_hash);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_own_password(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_own_password(text) TO authenticated;