-- Store public links that other departments can fetch
CREATE TABLE IF NOT EXISTS public_links (
  key text PRIMARY KEY,
  url text NOT NULL,
  label text DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public_links (key, url, label)
VALUES ('submit-request', 'https://marketing.exodiagamedev.com/#/submit-request', 'Submit a Marketing Request')
ON CONFLICT (key) DO UPDATE SET url = EXCLUDED.url, label = EXCLUDED.label, updated_at = now();

ALTER TABLE public_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read public_links"
  ON public_links FOR SELECT
  USING (true);