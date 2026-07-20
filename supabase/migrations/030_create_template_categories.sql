-- Template categories table for Messaging page
CREATE TABLE IF NOT EXISTS template_categories (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE template_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view template categories"
  ON template_categories FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert template categories"
  ON template_categories FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update template categories"
  ON template_categories FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete template categories"
  ON template_categories FOR DELETE
  USING (auth.role() = 'authenticated');