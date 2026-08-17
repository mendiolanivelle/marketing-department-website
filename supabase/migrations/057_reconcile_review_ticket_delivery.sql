-- Reconcile the review-ticket delivery contract used by send-ticket-email.
CREATE TABLE IF NOT EXISTS public.ops_emails (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_review_tickets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  acceptance_form_id bigint,
  tracking_id text,
  project_name text NOT NULL DEFAULT '',
  client_name text NOT NULL DEFAULT '',
  email_to text NOT NULL DEFAULT '',
  email_subject text NOT NULL DEFAULT '',
  email_body text NOT NULL DEFAULT '',
  additional_attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ticket_link text,
  status text NOT NULL DEFAULT 'Pending',
  phase text NOT NULL DEFAULT 'Initiation',
  pillar text,
  decision text,
  meet_link text,
  event_id text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  discovery_scheduled_at timestamptz,
  feasibility_decision_at timestamptz
);

ALTER TABLE public.project_review_tickets
  ADD COLUMN IF NOT EXISTS acceptance_form_id bigint,
  ADD COLUMN IF NOT EXISTS tracking_id text,
  ADD COLUMN IF NOT EXISTS project_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS email_to text DEFAULT '',
  ADD COLUMN IF NOT EXISTS email_subject text DEFAULT '',
  ADD COLUMN IF NOT EXISTS email_body text DEFAULT '',
  ADD COLUMN IF NOT EXISTS additional_attachments jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ticket_link text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS phase text DEFAULT 'Initiation',
  ADD COLUMN IF NOT EXISTS pillar text,
  ADD COLUMN IF NOT EXISTS decision text,
  ADD COLUMN IF NOT EXISTS meet_link text,
  ADD COLUMN IF NOT EXISTS event_id text,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS discovery_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS feasibility_decision_at timestamptz;

UPDATE public.project_review_tickets
SET status = 'Pending'
WHERE status IS NULL;

ALTER TABLE public.project_review_tickets
  ALTER COLUMN status SET DEFAULT 'Pending',
  ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT acceptance_form_id
    FROM public.project_review_tickets
    WHERE acceptance_form_id IS NOT NULL
    GROUP BY acceptance_form_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'Duplicate review tickets must be reconciled before enabling idempotent delivery';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_review_tickets_acceptance_form_id_fkey'
      AND conrelid = 'public.project_review_tickets'::regclass
  ) THEN
    ALTER TABLE public.project_review_tickets
      ADD CONSTRAINT project_review_tickets_acceptance_form_id_fkey
      FOREIGN KEY (acceptance_form_id)
      REFERENCES public.acceptance_forms(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_review_tickets_acceptance_form_id_key'
      AND conrelid = 'public.project_review_tickets'::regclass
  ) THEN
    ALTER TABLE public.project_review_tickets
      ADD CONSTRAINT project_review_tickets_acceptance_form_id_key
      UNIQUE (acceptance_form_id);
  END IF;
END;
$$;

ALTER TABLE public.ops_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_review_tickets ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.ops_emails,
  public.project_review_tickets
TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can view ops emails" ON public.ops_emails;
DROP POLICY IF EXISTS "Authenticated users can insert ops emails" ON public.ops_emails;
DROP POLICY IF EXISTS "Authenticated users can update ops emails" ON public.ops_emails;
DROP POLICY IF EXISTS "Authenticated users can delete ops emails" ON public.ops_emails;

CREATE POLICY "Authenticated users can view ops emails"
  ON public.ops_emails FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert ops emails"
  ON public.ops_emails FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update ops emails"
  ON public.ops_emails FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete ops emails"
  ON public.ops_emails FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can view project review tickets" ON public.project_review_tickets;
DROP POLICY IF EXISTS "Authenticated users can insert project review tickets" ON public.project_review_tickets;
DROP POLICY IF EXISTS "Authenticated users can update project review tickets" ON public.project_review_tickets;
DROP POLICY IF EXISTS "Authenticated users can delete project review tickets" ON public.project_review_tickets;

CREATE POLICY "Authenticated users can view project review tickets"
  ON public.project_review_tickets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert project review tickets"
  ON public.project_review_tickets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update project review tickets"
  ON public.project_review_tickets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete project review tickets"
  ON public.project_review_tickets FOR DELETE TO authenticated USING (true);
