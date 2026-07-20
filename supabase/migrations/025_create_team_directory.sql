-- Team directory table for About page
CREATE TABLE IF NOT EXISTS team_directory (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  role text NOT NULL,
  email text NOT NULL,
  photo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE team_directory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view team directory"
  ON team_directory FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert team members"
  ON team_directory FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update team members"
  ON team_directory FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete team members"
  ON team_directory FOR DELETE
  USING (auth.role() = 'authenticated');