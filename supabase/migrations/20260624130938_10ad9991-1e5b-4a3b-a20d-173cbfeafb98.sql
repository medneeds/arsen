DROP FUNCTION IF EXISTS public.get_public_table_columns(text[]);

CREATE FUNCTION public.get_public_table_columns(tables text[])
RETURNS TABLE(table_name text, column_name text, is_generated boolean, is_identity boolean, is_nullable boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
  SELECT
    c.table_name::text,
    c.column_name::text,
    (c.is_generated = 'ALWAYS')::boolean AS is_generated,
    (c.identity_generation = 'ALWAYS')::boolean AS is_identity,
    (c.is_nullable = 'YES')::boolean AS is_nullable
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND (tables IS NULL OR c.table_name = ANY(tables))
$function$;

NOTIFY pgrst, 'reload schema';