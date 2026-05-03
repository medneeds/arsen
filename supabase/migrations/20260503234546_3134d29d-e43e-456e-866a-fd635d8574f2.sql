-- Restrict realtime.messages to authenticated users only.
-- This prevents anonymous clients from subscribing to any Realtime topic.
-- Postgres_changes payloads continue to be filtered by the source tables' own RLS.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'realtime' AND tablename = 'messages'
      AND policyname = 'Authenticated users can read realtime messages'
  ) THEN
    CREATE POLICY "Authenticated users can read realtime messages"
      ON realtime.messages
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'realtime' AND tablename = 'messages'
      AND policyname = 'Authenticated users can send realtime messages'
  ) THEN
    CREATE POLICY "Authenticated users can send realtime messages"
      ON realtime.messages
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;