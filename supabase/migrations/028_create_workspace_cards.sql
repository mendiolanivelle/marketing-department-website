-- Workspace cards table for Workspace page
CREATE TABLE IF NOT EXISTS workspace_cards (
  id text PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('note', 'link', 'todo', 'column', 'image', 'shape')),
  shape_type text,
  x double precision NOT NULL,
  y double precision NOT NULL,
  content text DEFAULT '',
  todos jsonb DEFAULT '[]'::jsonb,
  column_items jsonb DEFAULT '[]'::jsonb,
  image_url text,
  width double precision,
  height double precision,
  z_index integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE workspace_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view workspace cards"
  ON workspace_cards FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert workspace cards"
  ON workspace_cards FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update workspace cards"
  ON workspace_cards FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete workspace cards"
  ON workspace_cards FOR DELETE
  USING (auth.role() = 'authenticated');