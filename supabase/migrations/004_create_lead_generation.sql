CREATE TABLE IF NOT EXISTS lead_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  columns TEXT[] DEFAULT '{}',
  source TEXT DEFAULT 'csv' CHECK (source IN ('csv', 'spreadsheet')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lead_rows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id UUID REFERENCES lead_files(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE lead_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view lead files"
  ON lead_files FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create lead files"
  ON lead_files FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update lead files"
  ON lead_files FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete lead files"
  ON lead_files FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view lead rows"
  ON lead_rows FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create lead rows"
  ON lead_rows FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update lead rows"
  ON lead_rows FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete lead rows"
  ON lead_rows FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_lead_files_updated_at
  BEFORE UPDATE ON lead_files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lead_rows_updated_at
  BEFORE UPDATE ON lead_rows
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
