-- Portaria 344/98 fields on medication_catalog
ALTER TABLE public.medication_catalog
  ADD COLUMN IF NOT EXISTS nome_comercial text,
  ADD COLUMN IF NOT EXISTS lista text,
  ADD COLUMN IF NOT EXISTS notification_type text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'medication_catalog_lista_check') THEN
    ALTER TABLE public.medication_catalog
      ADD CONSTRAINT medication_catalog_lista_check
      CHECK (lista IS NULL OR lista IN ('A1','A2','A3','B1','B2','C1','C2','C3','C4','C5'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'medication_catalog_notif_check') THEN
    ALTER TABLE public.medication_catalog
      ADD CONSTRAINT medication_catalog_notif_check
      CHECK (notification_type IS NULL OR notification_type IN ('Receita Amarela','Receita Azul','Controle Especial 2 vias'));
  END IF;
END $$;

-- Presentation enrichment
ALTER TABLE public.medication_presentations
  ADD COLUMN IF NOT EXISTS pharmaceutical_form text,
  ADD COLUMN IF NOT EXISTS default_route text,
  ADD COLUMN IF NOT EXISTS default_dose text;

-- Backfill catalog
UPDATE public.medication_catalog
SET nome_comercial = COALESCE(nome_comercial, generic_name);

UPDATE public.medication_catalog
SET notification_type = CASE
  WHEN lista IN ('A1','A2','A3') THEN 'Receita Amarela'
  WHEN pharmacological_group ~* 'entorpecente|opi[óo]ide' THEN 'Receita Amarela'
  WHEN lista IN ('B1','B2') THEN 'Receita Azul'
  WHEN pharmacological_group ~* 'psicotr[oó]pic|benzodiaze' THEN 'Receita Azul'
  WHEN lista = 'C1' THEN 'Controle Especial 2 vias'
  WHEN controlled = true THEN 'Controle Especial 2 vias'
  ELSE NULL
END
WHERE notification_type IS NULL;

-- Backfill presentations
UPDATE public.medication_presentations
SET pharmaceutical_form = COALESCE(pharmaceutical_form, form),
    default_route = COALESCE(default_route, route);

CREATE INDEX IF NOT EXISTS medication_catalog_controlled_idx
  ON public.medication_catalog (controlled, high_alert);
CREATE INDEX IF NOT EXISTS medication_catalog_generic_lower_idx
  ON public.medication_catalog (lower(generic_name));
CREATE INDEX IF NOT EXISTS medication_catalog_comercial_lower_idx
  ON public.medication_catalog (lower(nome_comercial));