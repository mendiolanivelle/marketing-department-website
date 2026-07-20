-- Outreach leads table for Messaging page
CREATE TABLE IF NOT EXISTS outreach_leads (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  company text DEFAULT '',
  role text DEFAULT '',
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'replied', 'follow-up', 'no-reply', 'meeting-booked')),
  last_contacted text DEFAULT '',
  notes text DEFAULT '',
  photo_url text,
  raw_data jsonb,
  source_file_id text,
  email_history jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE outreach_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view outreach leads"
  ON outreach_leads FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert outreach leads"
  ON outreach_leads FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update outreach leads"
  ON outreach_leads FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete outreach leads"
  ON outreach_leads FOR DELETE
  USING (auth.role() = 'authenticated');