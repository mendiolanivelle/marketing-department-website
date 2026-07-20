-- Activity log table for Home page activity tracking
CREATE TABLE IF NOT EXISTS activity_log (
  id bigint PRIMARY KEY,
  action text NOT NULL,
  detail text NOT NULL,
  timestamp text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view activity log"
  ON activity_log FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert activity log"
  ON activity_log FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete activity log"
  ON activity_log FOR DELETE
  USING (auth.role() = 'authenticated');