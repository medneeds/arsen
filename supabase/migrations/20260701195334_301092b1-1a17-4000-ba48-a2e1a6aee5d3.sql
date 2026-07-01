
DROP FUNCTION IF EXISTS public.mirror_truncate_tables(text[]);

CREATE FUNCTION public.mirror_truncate_tables(table_names text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t text;
  truncated text[] := ARRAY[]::text[];
  skipped jsonb := '[]'::jsonb;
  exists_ok boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Forbidden: super_admin required';
  END IF;

  IF table_names IS NULL OR array_length(table_names, 1) IS NULL THEN
    RETURN jsonb_build_object('truncated', truncated, 'skipped', skipped);
  END IF;

  PERFORM set_config('session_replication_role', 'replica', true);

  FOREACH t IN ARRAY table_names LOOP
    IF t !~ '^[a-zA-Z_][a-zA-Z0-9_]*$' THEN
      skipped := skipped || jsonb_build_object('table', t, 'reason', 'invalid_identifier');
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) INTO exists_ok;

    IF NOT exists_ok THEN
      skipped := skipped || jsonb_build_object('table', t, 'reason', 'not_found');
      CONTINUE;
    END IF;

    BEGIN
      EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', t);
      truncated := truncated || t;
    EXCEPTION WHEN OTHERS THEN
      skipped := skipped || jsonb_build_object('table', t, 'reason', SQLERRM);
    END;
  END LOOP;

  PERFORM set_config('session_replication_role', 'origin', true);

  RETURN jsonb_build_object('truncated', truncated, 'skipped', skipped);
END;
$$;

REVOKE ALL ON FUNCTION public.mirror_truncate_tables(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mirror_truncate_tables(text[]) TO service_role;
