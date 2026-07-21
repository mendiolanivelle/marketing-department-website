-- Potential projects table for Marketing Project List
CREATE TABLE IF NOT EXISTS potential_projects (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_name text NOT NULL,
  client_name text,
  status text DEFAULT 'Potential',
  notes text,
  source text,
  contact_email text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE potential_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view potential projects"
  ON potential_projects FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert potential projects"
  ON potential_projects FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update potential projects"
  ON potential_projects FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete potential projects"
  ON potential_projects FOR DELETE
  USING (auth.role() = 'authenticated');