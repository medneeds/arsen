-- RPC para modo espelho do restore: apaga TODAS as linhas das tabelas listadas
-- antes do upsert, preservando os IDs originais do backup. Rodada apenas pela
-- edge function backup-restore com service_role.
CREATE OR REPLACE FUNCTION public.mirror_truncate_tables(table_names text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t text;
  qualified text[] := ARRAY[]::text[];
BEGIN
  IF table_names IS NULL OR array_length(table_names, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Só aceita tabelas do schema public e que realmente existem
  FOREACH t IN ARRAY table_names LOOP
    IF t IS NULL OR t = '' OR t ~ '[^a-zA-Z0-9_]' THEN
      RAISE EXCEPTION 'nome de tabela inválido: %', t;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      qualified := qualified || format('public.%I', t);
    END IF;
  END LOOP;

  IF array_length(qualified, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Adia checagem de FK e desabilita triggers (inclui triggers de FK internos).
  -- Necessário porque TRUNCATE respeita FKs mesmo com constraints DEFERRABLE.
  PERFORM set_config('session_replication_role', 'replica', true);

  EXECUTE 'TRUNCATE TABLE ' || array_to_string(qualified, ', ') || ' RESTART IDENTITY';

  PERFORM set_config('session_replication_role', 'origin', true);
END;
$$;

REVOKE ALL ON FUNCTION public.mirror_truncate_tables(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mirror_truncate_tables(text[]) TO service_role;