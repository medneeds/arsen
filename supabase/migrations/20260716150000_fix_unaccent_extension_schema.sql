-- Fix: "text search dictionary extensions.unaccent does not exist"
--
-- A função public.unaccent_immutable (criada em
-- 20260417040950_7c510673-607a-42c0-89a8-584e436a4e87.sql) assume que a
-- extensão unaccent está instalada no schema "extensions":
--   SELECT extensions.unaccent('extensions.unaccent'::regdictionary, input);
--
-- Porém a extensão foi criada sem "WITH SCHEMA extensions" (CREATE EXTENSION
-- IF NOT EXISTS unaccent;), então em muitos projetos Supabase ela acaba
-- instalada no schema "public" por padrão. Isso quebra a coluna gerada
-- full_name_normalized em patient_registry, e portanto TODO insert de
-- paciente (NI ou não) passa a falhar com esse erro.
--
-- Corrige movendo a extensão para o schema "extensions" quando necessário,
-- sem alterar o código da função (idempotente / seguro rodar mais de uma vez).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions')
     AND EXISTS (
       SELECT 1
       FROM pg_extension e
       JOIN pg_namespace n ON n.oid = e.extnamespace
       WHERE e.extname = 'unaccent' AND n.nspname <> 'extensions'
     )
  THEN
    ALTER EXTENSION unaccent SET SCHEMA extensions;
  END IF;
END $$;
