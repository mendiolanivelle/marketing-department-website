ALTER TABLE project_review_tickets ADD COLUMN IF NOT EXISTS phase TEXT DEFAULT 'Initiation';
ALTER TABLE project_review_tickets ADD COLUMN IF NOT EXISTS pillar TEXT;
ALTER TABLE project_review_tickets ADD COLUMN IF NOT EXISTS decision TEXT;
ALTER TABLE project_review_tickets ADD COLUMN IF NOT EXISTS meet_link TEXT;
ALTER TABLE project_review_tickets ADD COLUMN IF NOT EXISTS event_id TEXT;
ALTER TABLE project_review_tickets ADD COLUMN IF NOT EXISTS discovery_scheduled_at TIMESTAMPTZ;
ALTER TABLE project_review_tickets ADD COLUMN IF NOT EXISTS feasibility_decision_at TIMESTAMPTZ;
ALTER TABLE project_review_tickets ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;