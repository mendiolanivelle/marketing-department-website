-- Add status column to marketing_requests for campaign tracking
ALTER TABLE marketing_requests ADD COLUMN IF NOT EXISTS status text DEFAULT 'Pending';