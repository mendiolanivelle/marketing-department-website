-- Allow anyone to update is_read on acceptance_forms
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'acceptance_forms') THEN
    CREATE POLICY "Anyone can update acceptance forms"
      ON acceptance_forms FOR UPDATE
      USING (true);
  END IF;
END $$;