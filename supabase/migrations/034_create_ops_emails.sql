-- Ops emails table for AcceptanceCriteria page
CREATE TABLE IF NOT EXISTS ops_emails (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ops_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view ops emails"
  ON ops_emails FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert ops emails"
  ON ops_emails FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update ops emails"
  ON ops_emails FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete ops emails"
  ON ops_emails FOR DELETE
  USING (auth.role() = 'authenticated');