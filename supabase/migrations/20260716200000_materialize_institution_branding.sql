-- ════════════════════════════════════════════════════════════════════════
-- CONVERGÊNCIA DE SCHEMA: institution_branding
-- ════════════════════════════════════════════════════════════════════════
-- Auditoria de organização (16/07/2026): a tabela institution_branding
-- existia nos types gerados (src/integrations/supabase/types.ts) e nas
-- listas do sistema de backup (backupTableCategories.ts), mas NÃO existia
-- no banco de staging e NUNCA existiu em nenhuma migration — foi criada
-- por fora (painel) em outro ambiente. Três artefatos, três estados.
--
-- Esta migration materializa a tabela conforme o schema esperado pelos
-- types, com RLS no padrão do projeto (leitura autenticada, escrita admin),
-- convergindo migrations = banco = types em todos os ambientes.
-- Idempotente: IF NOT EXISTS em tudo.

CREATE TABLE IF NOT EXISTS public.institution_branding (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_unit_id uuid NOT NULL REFERENCES public.hospital_units(id) ON DELETE CASCADE,
  abbreviation     text NOT NULL,
  tagline          text,
  logo_url         text,
  primary_color    text,
  secondary_color  text,
  accent_color     text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hospital_unit_id)
);

ALTER TABLE public.institution_branding ENABLE ROW LEVEL SECURITY;

DO $pol$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'institution_branding'
      AND policyname = 'Authenticated users can view institution branding'
  ) THEN
    CREATE POLICY "Authenticated users can view institution branding"
      ON public.institution_branding FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'institution_branding'
      AND policyname = 'Admins can manage institution branding'
  ) THEN
    CREATE POLICY "Admins can manage institution branding"
      ON public.institution_branding FOR ALL
      USING (has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END
$pol$;

-- updated_at automático, no padrão do projeto
DROP TRIGGER IF EXISTS update_institution_branding_updated_at ON public.institution_branding;
CREATE TRIGGER update_institution_branding_updated_at
  BEFORE UPDATE ON public.institution_branding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
