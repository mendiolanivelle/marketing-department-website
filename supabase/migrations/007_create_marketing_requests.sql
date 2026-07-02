-- Marketing Requests table for submitted form data
CREATE TABLE IF NOT EXISTS marketing_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tracking_id text UNIQUE,
  name text NOT NULL,
  department text NOT NULL,
  email text NOT NULL,
  title text NOT NULL,
  campaign text,
  description text,
  request_type jsonb DEFAULT '[]'::jsonb,
  platforms text,
  audience text,
  resource_links text,
  date_needed date NOT NULL,
  priority text NOT NULL,
  management_approval text NOT NULL DEFAULT 'Pending',
  edit_token text UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_requests_edit_token ON marketing_requests(edit_token);
CREATE INDEX IF NOT EXISTS idx_marketing_requests_tracking_id ON marketing_requests(tracking_id);

ALTER TABLE marketing_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert marketing requests"
  ON marketing_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view marketing requests"
  ON marketing_requests FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update marketing requests"
  ON marketing_requests FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete marketing requests"
  ON marketing_requests FOR DELETE
  USING (true);