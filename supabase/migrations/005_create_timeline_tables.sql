CREATE TABLE IF NOT EXISTS timeline_tables (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  columns JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS timeline_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_id UUID REFERENCES timeline_tables(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  contact TEXT NOT NULL,
  email TEXT NOT NULL,
  value TEXT NOT NULL,
  date TEXT NOT NULL,
  column_key TEXT NOT NULL,
  notes TEXT DEFAULT '',
  attachments JSONB DEFAULT '[]',
  email_history JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE timeline_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view timeline tables" ON timeline_tables FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create timeline tables" ON timeline_tables FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update timeline tables" ON timeline_tables FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete timeline tables" ON timeline_tables FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view timeline leads" ON timeline_leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create timeline leads" ON timeline_leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update timeline leads" ON timeline_leads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete timeline leads" ON timeline_leads FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_timeline_tables_updated_at BEFORE UPDATE ON timeline_tables FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_timeline_leads_updated_at BEFORE UPDATE ON timeline_leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
