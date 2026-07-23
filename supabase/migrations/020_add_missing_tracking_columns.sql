DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'acceptance_forms') THEN
    ALTER TABLE acceptance_forms ADD COLUMN IF NOT EXISTS tracking_id TEXT;
  END IF;
END $$;
ALTER TABLE project_review_tickets ADD COLUMN IF NOT EXISTS ticket_link TEXT;
