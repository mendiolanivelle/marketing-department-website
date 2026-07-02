ALTER TABLE marketing_requests ADD COLUMN IF NOT EXISTS edit_token text UNIQUE;
CREATE INDEX IF NOT EXISTS idx_marketing_requests_edit_token ON marketing_requests(edit_token);

ALTER POLICY "Anyone can view marketing requests" ON marketing_requests USING (true);
ALTER POLICY "Anyone can insert marketing requests" ON marketing_requests FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update marketing requests by edit token"
  ON marketing_requests FOR UPDATE
  USING (true)
  WITH CHECK (true);