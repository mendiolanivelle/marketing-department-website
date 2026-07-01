-- Marketing Requests table
CREATE TABLE IF NOT EXISTS marketing_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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
  management_approval text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE marketing_requests ENABLE ROW LEVEL LOOKUP;

CREATE POLICY "Anyone can insert marketing requests"
  ON marketing_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view marketing requests"
  ON marketing_requests FOR SELECT
  USING (true);