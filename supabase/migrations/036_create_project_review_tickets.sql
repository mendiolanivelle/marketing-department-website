-- Project review tickets table (missing CREATE TABLE migration)
CREATE TABLE IF NOT EXISTS project_review_tickets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tracking_id text,
  project_name text DEFAULT '',
  client_name text DEFAULT '',
  email_to text DEFAULT '',
  email_subject text DEFAULT '',
  email_body text DEFAULT '',
  additional_attachments jsonb DEFAULT '[]'::jsonb,
  ticket_link text,
  status text DEFAULT 'Sent',
  phase text DEFAULT 'Initiation',
  pillar text,
  decision text,
  meet_link text,
  event_id text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  discovery_scheduled_at timestamptz,
  feasibility_decision_at timestamptz
);

ALTER TABLE project_review_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view project review tickets"
  ON project_review_tickets FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert project review tickets"
  ON project_review_tickets FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update project review tickets"
  ON project_review_tickets FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete project review tickets"
  ON project_review_tickets FOR DELETE
  USING (auth.role() = 'authenticated');