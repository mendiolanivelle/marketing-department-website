-- Add is_read column for unread badge tracking on acceptance_forms
ALTER TABLE acceptance_forms ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;