ALTER TABLE public.acceptance_forms
  ADD COLUMN IF NOT EXISTS signatory_name text,
  ADD COLUMN IF NOT EXISTS signature_png text,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;
