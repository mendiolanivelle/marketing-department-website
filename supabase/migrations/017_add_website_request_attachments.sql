ALTER TABLE website_requests
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
