-- Synced lead files table for Messaging page
CREATE TABLE IF NOT EXISTS synced_lead_files (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  file_id text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE synced_lead_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view synced lead files"
  ON synced_lead_files FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert synced lead files"
  ON synced_lead_files FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete synced lead files"
  ON synced_lead_files FOR DELETE
  USING (auth.role() = 'authenticated');