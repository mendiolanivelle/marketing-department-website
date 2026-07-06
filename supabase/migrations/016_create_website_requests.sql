CREATE TABLE IF NOT EXISTS website_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  request_type TEXT NOT NULL DEFAULT 'Feedback' CHECK (request_type IN ('Feedback', 'Bug', 'Improvement', 'New Feature', 'Question')),
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Reviewing', 'Planned', 'Done', 'Closed')),
  page_area TEXT,
  description TEXT NOT NULL,
  requester_name TEXT,
  requester_email TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE website_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view website requests"
  ON website_requests
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create website requests"
  ON website_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by OR created_by IS NULL);

CREATE POLICY "Authenticated users can update website requests"
  ON website_requests
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete website requests"
  ON website_requests
  FOR DELETE
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_website_requests_updated_at ON website_requests;
CREATE TRIGGER update_website_requests_updated_at
  BEFORE UPDATE ON website_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'website_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE website_requests;
  END IF;
END $$;
