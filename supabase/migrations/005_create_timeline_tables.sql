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

INSERT INTO timeline_tables (title, columns) VALUES ('Q3 Leads Pipeline', '[{"key":"col-1","label":"Initial Contact"},{"key":"col-2","label":"Discovery Call"},{"key":"col-3","label":"Proposal Sent"},{"key":"col-4","label":"Negotiation"},{"key":"col-5","label":"Closed Won"}]');

INSERT INTO timeline_leads (table_id, company, contact, email, value, date, column_key, notes, attachments, email_history)
SELECT id, 'Acme Corp', 'John Smith', 'john@acme.com', '$25,000', 'Jun 18', 'col-1', 'Interested in our premium package', '[]', '[{"date":"Jun 15","subject":"Intro Email","preview":"Hi John, wanted to reach out..."}]'
FROM timeline_tables WHERE title = 'Q3 Leads Pipeline';

INSERT INTO timeline_leads (table_id, company, contact, email, value, date, column_key, notes, attachments, email_history)
SELECT id, 'TechStart Inc', 'Sarah Lee', 'sarah@techstart.io', '$12,500', 'Jun 17', 'col-2', 'Needs demo scheduled', '["https://techstart.io/deck.pdf"]', '[{"date":"Jun 14","subject":"Intro Email","preview":"Hi Sarah..."},{"date":"Jun 16","subject":"Re: Demo Request","preview":"Thanks for your interest..."}]'
FROM timeline_tables WHERE title = 'Q3 Leads Pipeline';

INSERT INTO timeline_leads (table_id, company, contact, email, value, date, column_key, notes, attachments, email_history)
SELECT id, 'Global Media', 'Mike Chen', 'mike@globalmedia.com', '$45,000', 'Jun 15', 'col-3', 'Proposal sent, awaiting feedback', '[]', '[{"date":"Jun 10","subject":"Proposal","preview":"Please find attached..."}]'
FROM timeline_tables WHERE title = 'Q3 Leads Pipeline';

INSERT INTO timeline_leads (table_id, company, contact, email, value, date, column_key, notes, attachments, email_history)
SELECT id, 'Brandify', 'Emma Davis', 'emma@brandify.co', '$18,000', 'Jun 14', 'col-4', 'Negotiating terms', '[]', '[]'
FROM timeline_tables WHERE title = 'Q3 Leads Pipeline';

INSERT INTO timeline_leads (table_id, company, contact, email, value, date, column_key, notes, attachments, email_history)
SELECT id, 'NovaTech', 'Alex Wong', 'alex@novatech.com', '$32,000', 'Jun 12', 'col-5', 'Deal closed!', '[]', '[{"date":"Jun 1","subject":"Contract Signed","preview":"Welcome aboard..."}]'
FROM timeline_tables WHERE title = 'Q3 Leads Pipeline';
