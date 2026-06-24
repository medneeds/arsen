CREATE OR REPLACE FUNCTION public.get_public_columns_nullability(p_columns text[])
RETURNS TABLE (table_name text, column_name text, is_nullable boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT c.table_name::text,
         c.column_name::text,
         (c.is_nullable = 'YES')::boolean
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.column_name = ANY(p_columns);
$$;

REVOKE ALL ON FUNCTION public.get_public_columns_nullability(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_columns_nullability(text[]) TO service_role;