-- Acceptance forms table (missing CREATE TABLE migration)
CREATE TABLE IF NOT EXISTS acceptance_forms (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tracking_id text UNIQUE,
  client_name text NOT NULL,
  project_name text NOT NULL,
  contact text DEFAULT '',
  email text DEFAULT '',
  project_type text DEFAULT '',
  target_platform jsonb DEFAULT '[]'::jsonb,
  timezone text DEFAULT '',
  start_date text DEFAULT '',
  deadline text DEFAULT '',
  budget text DEFAULT '',
  doc_link text DEFAULT '',
  deliverables jsonb DEFAULT '[]'::jsonb,
  reviewer jsonb DEFAULT '[]'::jsonb,
  review_rounds text DEFAULT '',
  review_time text DEFAULT '',
  approval_basis jsonb DEFAULT '[]'::jsonb,
  comms_tool jsonb DEFAULT '[]'::jsonb,
  weekly_meeting jsonb DEFAULT '[]'::jsonb,
  meeting_time text DEFAULT '',
  daily_sync jsonb DEFAULT '[]'::jsonb,
  sync_time text DEFAULT '',
  training jsonb DEFAULT '[]'::jsonb,
  game_engine jsonb DEFAULT '[]'::jsonb,
  tech_requirements text DEFAULT '',
  tools_software text DEFAULT '',
  performance_constraints text DEFAULT '',
  signature text DEFAULT '',
  signature_date text DEFAULT '',
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_acceptance_forms_tracking_id ON acceptance_forms(tracking_id);

ALTER TABLE acceptance_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert acceptance forms"
  ON acceptance_forms FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view acceptance forms"
  ON acceptance_forms FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update acceptance forms"
  ON acceptance_forms FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete acceptance forms"
  ON acceptance_forms FOR DELETE
  USING (true);