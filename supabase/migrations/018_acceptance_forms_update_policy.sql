-- Allow anyone to update is_read on acceptance_forms
CREATE POLICY "Anyone can update acceptance forms"
  ON acceptance_forms FOR UPDATE
  USING (true);