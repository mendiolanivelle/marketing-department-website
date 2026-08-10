-- Reconciles the production schema without replaying historical migrations.
CREATE TABLE IF NOT EXISTS public.website_requests_seen (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  seen_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.website_requests_seen ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'website_requests_seen'
      AND policyname = 'Authenticated users can view seen_at'
  ) THEN
    CREATE POLICY "Authenticated users can view seen_at"
      ON public.website_requests_seen
      FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'website_requests_seen'
      AND policyname = 'Authenticated users can insert seen_at'
  ) THEN
    CREATE POLICY "Authenticated users can insert seen_at"
      ON public.website_requests_seen
      FOR INSERT
      WITH CHECK (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'website_requests_seen'
      AND policyname = 'Authenticated users can update seen_at'
  ) THEN
    CREATE POLICY "Authenticated users can update seen_at"
      ON public.website_requests_seen
      FOR UPDATE
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END
$$;
