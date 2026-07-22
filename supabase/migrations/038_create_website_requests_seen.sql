-- Website requests seen-at tracking for cross-device notification badge
CREATE TABLE IF NOT EXISTS website_requests_seen (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  seen_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE website_requests_seen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view seen_at"
  ON website_requests_seen FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert seen_at"
  ON website_requests_seen FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update seen_at"
  ON website_requests_seen FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');