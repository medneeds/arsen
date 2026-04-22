-- Habilita realtime para evoluções clínicas (Cockpit em tempo real)
ALTER TABLE public.clinical_evolutions REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'clinical_evolutions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clinical_evolutions;
  END IF;
END $$;