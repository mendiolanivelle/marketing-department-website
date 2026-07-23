-- Add is_read column for unread badge tracking on acceptance_forms
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'acceptance_forms') THEN
    ALTER TABLE acceptance_forms ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;
  END IF;
END $$;