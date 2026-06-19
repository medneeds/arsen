
CREATE OR REPLACE FUNCTION public.get_public_tables_with_pk()
RETURNS TABLE(name text, pk text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.relname::text AS name,
    COALESCE(
      ARRAY(
        SELECT a.attname::text
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = c.oid AND i.indisprimary
        ORDER BY array_position(i.indkey, a.attnum)
      ),
      ARRAY['id']::text[]
    ) AS pk
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
  ORDER BY c.relname;
$$;
REVOKE ALL ON FUNCTION public.get_public_tables_with_pk() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_tables_with_pk() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_public_tables_with_pk() TO authenticated;
-- Note: authenticated grant is fine; SECURITY DEFINER reveals only table names/PKs (no row data).

CREATE OR REPLACE FUNCTION public.get_public_fk_pairs()
RETURNS TABLE(child text, parent text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT
    cl_child.relname::text AS child,
    cl_parent.relname::text AS parent
  FROM pg_constraint con
  JOIN pg_class cl_child  ON cl_child.oid  = con.conrelid
  JOIN pg_namespace nc    ON nc.oid = cl_child.relnamespace
  JOIN pg_class cl_parent ON cl_parent.oid = con.confrelid
  JOIN pg_namespace np    ON np.oid = cl_parent.relnamespace
  WHERE con.contype = 'f'
    AND nc.nspname = 'public'
    AND np.nspname = 'public';
$$;
REVOKE ALL ON FUNCTION public.get_public_fk_pairs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_fk_pairs() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_public_fk_pairs() TO authenticated;
