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
-- Diagnóstico em produção mostrou que a extensão unaccent nunca foi
-- efetivamente criada (pg_extension sem nenhuma linha para 'unaccent'),
-- apesar do CREATE EXTENSION IF NOT EXISTS na migration original — logo não
-- há o que mover de schema, é preciso criá-la de fato.
--
-- Idempotente: se já existir em qualquer schema, o IF NOT EXISTS não faz nada;
-- se existir fora de 'extensions', move para lá.

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

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
