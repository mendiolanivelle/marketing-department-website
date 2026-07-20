-- File tracker assets table for FileTracker page
CREATE TABLE IF NOT EXISTS file_tracker_assets (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  type text NOT NULL,
  data_url text,
  url text,
  added_at timestamptz NOT NULL,
  size bigint DEFAULT 0,
  is_mock boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE file_tracker_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view file tracker assets"
  ON file_tracker_assets FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert file tracker assets"
  ON file_tracker_assets FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update file tracker assets"
  ON file_tracker_assets FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete file tracker assets"
  ON file_tracker_assets FOR DELETE
  USING (auth.role() = 'authenticated');