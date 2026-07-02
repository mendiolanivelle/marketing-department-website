-- Allow anyone to insert into calendar_items (for marketing request auto-creation)
CREATE POLICY "Anyone can insert calendar items"
  ON calendar_items FOR INSERT
  WITH CHECK (true);