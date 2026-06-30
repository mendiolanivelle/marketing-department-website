ALTER TABLE acceptance_forms ADD COLUMN IF NOT EXISTS tracking_id TEXT;
ALTER TABLE project_review_tickets ADD COLUMN IF NOT EXISTS ticket_link TEXT;