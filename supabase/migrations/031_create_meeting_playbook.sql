-- Meeting playbook tables for MeetingPlaybook page

-- Meeting templates
CREATE TABLE IF NOT EXISTS meeting_templates (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  goal text NOT NULL,
  kpis jsonb DEFAULT '[]'::jsonb,
  pro_tips jsonb DEFAULT '[]'::jsonb,
  flow_steps jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Active meetings
CREATE TABLE IF NOT EXISTS active_meetings (
  id text PRIMARY KEY,
  name text NOT NULL,
  links jsonb DEFAULT '[]'::jsonb,
  checklist jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Meeting scripts
CREATE TABLE IF NOT EXISTS meeting_scripts (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  text text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE meeting_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view meeting templates"
  ON meeting_templates FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert meeting templates"
  ON meeting_templates FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update meeting templates"
  ON meeting_templates FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete meeting templates"
  ON meeting_templates FOR DELETE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view active meetings"
  ON active_meetings FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert active meetings"
  ON active_meetings FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update active meetings"
  ON active_meetings FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete active meetings"
  ON active_meetings FOR DELETE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view meeting scripts"
  ON meeting_scripts FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert meeting scripts"
  ON meeting_scripts FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update meeting scripts"
  ON meeting_scripts FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete meeting scripts"
  ON meeting_scripts FOR DELETE
  USING (auth.role() = 'authenticated');