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

INSERT INTO calendar_items (title, type, date, start_time, end_time, color, location, assignees) VALUES
('Q3 Campaign Planning', 'meeting', '2026-06-25', '10:00', '11:30', '#ff5900', 'Conference Room A', ARRAY['john@company.com', 'sarah@company.com']),
('Brand Review Meeting', 'meeting', '2026-06-25', '14:00', '15:00', '#1a73e8', 'Zoom', ARRAY['emma@company.com', 'mike@company.com']),
('Content Deadline', 'task', '2026-06-22', '17:00', '17:00', '#e8710a', NULL, ARRAY['alex@company.com']),
('Team Standup', 'meeting', '2026-06-23', '09:00', '09:30', '#0b8043', 'Huddle Room', ARRAY['john@company.com', 'sarah@company.com', 'emma@company.com']),
('Social Media Launch', 'event', '2026-06-23', '12:00', '13:00', '#8e24aa', NULL, ARRAY['rachel@company.com', 'david@company.com']),
('Design Sprint', 'event', '2026-06-18', '09:00', '17:00', '#1a73e8', 'Design Lab', ARRAY['alex@company.com', 'kate@company.com']),
('Client Presentation', 'meeting', '2026-06-18', '15:00', '16:30', '#ff5900', 'Board Room', ARRAY['john@company.com', 'mike@company.com']),
('Marketing Offsite', 'event', '2026-07-10', '09:00', '17:00', '#e8710a', 'Resort Conference Center', ARRAY['john@company.com', 'sarah@company.com', 'emma@company.com', 'mike@company.com']),
('Marketing Offsite', 'event', '2026-07-11', '09:00', '17:00', '#e8710a', 'Resort Conference Center', ARRAY['john@company.com', 'sarah@company.com', 'emma@company.com', 'mike@company.com']),
('Marketing Offsite', 'event', '2026-07-12', '09:00', '12:00', '#e8710a', 'Resort Conference Center', ARRAY['john@company.com', 'sarah@company.com', 'emma@company.com', 'mike@company.com']),
('Review Submissions Due', 'task', '2026-07-01', '23:59', '23:59', '#d93025', NULL, ARRAY['sarah@company.com']),
('Weekly Sync', 'meeting', '2026-06-29', '10:00', '11:00', '#0b8043', 'Zoom', ARRAY['john@company.com', 'sarah@company.com']),
('Photo Shoot', 'event', '2026-06-15', '09:00', '12:00', '#8e24aa', 'Studio B', ARRAY['rachel@company.com', 'kate@company.com']),
('Email Campaign Send', 'task', '2026-06-12', '08:00', '08:30', '#1a73e8', NULL, ARRAY['david@company.com']),
('Budget Review', 'meeting', '2026-06-08', '14:00', '15:30', '#d93025', 'Finance Room', ARRAY['john@company.com', 'mike@company.com']);
