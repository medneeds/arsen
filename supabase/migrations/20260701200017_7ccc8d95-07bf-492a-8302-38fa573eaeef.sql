DROP FUNCTION IF EXISTS public.mirror_truncate_tables(text[]);
DROP FUNCTION IF EXISTS public.mirror_truncate_tables(text[], uuid);

CREATE FUNCTION public.mirror_truncate_tables(table_names text[], caller_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t text;
  qualified text[] := ARRAY[]::text[];
  truncated text[] := ARRAY[]::text[];
BEGIN
  IF caller_user_id IS NULL OR NOT public.has_role(caller_user_id, 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden: super_admin required';
  END IF;

  IF table_names IS NULL OR array_length(table_names, 1) IS NULL THEN
    RETURN jsonb_build_object('truncated', truncated);
  END IF;

  FOREACH t IN ARRAY table_names LOOP
    IF t IS NULL OR t = '' OR t !~ '^[a-zA-Z_][a-zA-Z0-9_]*$' THEN
      RAISE EXCEPTION 'nome de tabela inválido: %', t;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = t
        AND c.relkind IN ('r', 'p')
    ) THEN
      qualified := qualified || format('public.%I', t);
      truncated := truncated || t;
    END IF;
  END LOOP;

  IF array_length(qualified, 1) IS NULL THEN
    RETURN jsonb_build_object('truncated', truncated);
  END IF;

  BEGIN
    PERFORM set_config('session_replication_role', 'replica', true);
    EXECUTE 'TRUNCATE TABLE ' || array_to_string(qualified, ', ') || ' RESTART IDENTITY CASCADE';
    PERFORM set_config('session_replication_role', 'origin', true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('session_replication_role', 'origin', true);
    RAISE;
  END;

  RETURN jsonb_build_object('truncated', truncated);
END;
$$;

REVOKE ALL ON FUNCTION public.mirror_truncate_tables(text[], uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mirror_truncate_tables(text[], uuid) TO service_role;