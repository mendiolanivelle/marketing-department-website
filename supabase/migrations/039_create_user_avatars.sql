-- User avatars for cross-device profile picture sync
CREATE TABLE IF NOT EXISTS user_avatars (
  user_id text PRIMARY KEY,
  avatar_url text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_avatars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view avatars"
  ON user_avatars FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert avatars"
  ON user_avatars FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update avatars"
  ON user_avatars FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete avatars"
  ON user_avatars FOR DELETE
  USING (auth.role() = 'authenticated');