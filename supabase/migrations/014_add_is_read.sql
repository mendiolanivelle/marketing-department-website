-- Add is_read column for unread badge tracking
ALTER TABLE marketing_requests ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;