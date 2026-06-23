CREATE TABLE IF NOT EXISTS calendar_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('event', 'task', 'meeting')),
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  description TEXT,
  location TEXT,
  color TEXT NOT NULL DEFAULT '#ff5900',
  assignees TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE calendar_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view calendar items"
  ON calendar_items
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create calendar items"
  ON calendar_items
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update calendar items"
  ON calendar_items
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete calendar items"
  ON calendar_items
  FOR DELETE
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_calendar_items_updated_at
  BEFORE UPDATE ON calendar_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
