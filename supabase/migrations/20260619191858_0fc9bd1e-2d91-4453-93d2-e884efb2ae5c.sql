
CREATE OR REPLACE FUNCTION public.get_public_tables_with_pk_and_size()
RETURNS TABLE(name text, pk text[], size_bytes bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.relname::text AS name,
    COALESCE(
      (SELECT array_agg(a.attname::text ORDER BY array_position(i.indkey, a.attnum))
       FROM pg_index i
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
       WHERE i.indrelid = c.oid AND i.indisprimary),
      ARRAY[]::text[]
    ) AS pk,
    pg_total_relation_size(c.oid) AS size_bytes
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
  ORDER BY c.relname;
$$;

REVOKE ALL ON FUNCTION public.get_public_tables_with_pk_and_size() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_tables_with_pk_and_size() TO authenticated, service_role;

UPDATE public.db_backups
SET status = 'failed',
    error = 'abandoned: chunk pipeline died (HTML from gateway, no finalize)',
    finished_at = now()
WHERE status = 'running'
  AND created_at < now() - interval '5 minutes';
