-- Create campaigns table for Supabase persistence
CREATE TABLE IF NOT EXISTS campaigns (
  id bigint PRIMARY KEY,
  name text NOT NULL,
  dept text DEFAULT '',
  status text DEFAULT 'Pending',
  due text DEFAULT '',
  requester_name text DEFAULT '',
  requester_email text DEFAULT '',
  priority text DEFAULT '',
  request_type text[] DEFAULT '{}',
  description text DEFAULT '',
  tracking_id text DEFAULT null,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert campaigns"
  ON campaigns FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can select campaigns"
  ON campaigns FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update campaigns"
  ON campaigns FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete campaigns"
  ON campaigns FOR DELETE
  USING (true);