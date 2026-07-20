-- Read announcements table for Home page
CREATE TABLE IF NOT EXISTS read_announcements (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  announcement_id text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE read_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view read announcements"
  ON read_announcements FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert read announcements"
  ON read_announcements FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete read announcements"
  ON read_announcements FOR DELETE
  USING (auth.role() = 'authenticated');