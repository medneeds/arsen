
CREATE OR REPLACE FUNCTION public.get_public_table_columns(tables text[])
RETURNS TABLE(table_name text, column_name text, is_generated boolean, is_identity boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    c.table_name::text,
    c.column_name::text,
    (c.is_generated = 'ALWAYS')::boolean AS is_generated,
    (c.identity_generation = 'ALWAYS')::boolean AS is_identity
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND (tables IS NULL OR c.table_name = ANY(tables))
$$;

REVOKE ALL ON FUNCTION public.get_public_table_columns(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_table_columns(text[]) TO service_role;

CREATE OR REPLACE FUNCTION public.get_public_unique_constraints(tables text[])
RETURNS TABLE(table_name text, constraint_name text, columns text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    tc.table_name::text,
    tc.constraint_name::text,
    array_agg(kcu.column_name::text ORDER BY kcu.ordinal_position) AS columns
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_schema = tc.constraint_schema
   AND kcu.constraint_name   = tc.constraint_name
   AND kcu.table_schema      = tc.table_schema
   AND kcu.table_name        = tc.table_name
  WHERE tc.table_schema = 'public'
    AND tc.constraint_type = 'UNIQUE'
    AND (tables IS NULL OR tc.table_name = ANY(tables))
  GROUP BY tc.table_name, tc.constraint_name
$$;

REVOKE ALL ON FUNCTION public.get_public_unique_constraints(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_unique_constraints(text[]) TO service_role;
