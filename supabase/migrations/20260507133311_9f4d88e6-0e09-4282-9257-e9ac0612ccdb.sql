DROP POLICY IF EXISTS "Authenticated users can read realtime messages" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can send realtime messages" ON realtime.messages;

-- Read: only on known app topics or on the user's own private topic
CREATE POLICY "Restricted realtime topic read"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.topic() IN (
      'online-users',
      'online-users-monitor',
      'ue-horizontal-rt',
      'ue-vertical-rt'
    )
    OR realtime.topic() = ('user:' || auth.uid()::text)
  );

-- Write (broadcast/presence) under same scope
CREATE POLICY "Restricted realtime topic write"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    realtime.topic() IN (
      'online-users',
      'online-users-monitor',
      'ue-horizontal-rt',
      'ue-vertical-rt'
    )
    OR realtime.topic() = ('user:' || auth.uid()::text)
  );