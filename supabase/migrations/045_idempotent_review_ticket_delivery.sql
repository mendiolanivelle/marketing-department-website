ALTER TABLE public.project_review_tickets
  ADD COLUMN IF NOT EXISTS acceptance_form_id bigint;

DO $$
BEGIN
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
