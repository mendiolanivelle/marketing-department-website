CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.marketing_requests
  ADD COLUMN IF NOT EXISTS submission_key uuid,
  ADD COLUMN IF NOT EXISTS edit_token_hash text,
  ADD COLUMN IF NOT EXISTS edit_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS edit_token_revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS edit_link_last_sent_at timestamptz;

ALTER TABLE public.acceptance_forms
  ADD COLUMN IF NOT EXISTS submission_key uuid;

CREATE UNIQUE INDEX IF NOT EXISTS marketing_requests_submission_key_key
  ON public.marketing_requests (submission_key)
  WHERE submission_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS marketing_requests_edit_token_hash_key
  ON public.marketing_requests (edit_token_hash)
  WHERE edit_token_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS acceptance_forms_submission_key_key
  ON public.acceptance_forms (submission_key)
  WHERE submission_key IS NOT NULL;

UPDATE public.marketing_requests
SET
  edit_token_hash = encode(extensions.digest(edit_token, 'sha256'), 'hex'),
  edit_token_expires_at = coalesce(edit_token_expires_at, now() + interval '90 days')
WHERE edit_token IS NOT NULL
  AND edit_token_hash IS NULL;

UPDATE public.marketing_requests
SET edit_token = NULL
WHERE edit_token IS NOT NULL
  AND edit_token_hash IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'marketing_requests_edit_token_hash_format'
      AND conrelid = 'public.marketing_requests'::regclass
  ) THEN
    ALTER TABLE public.marketing_requests
      ADD CONSTRAINT marketing_requests_edit_token_hash_format
      CHECK (edit_token_hash IS NULL OR edit_token_hash ~ '^[0-9a-f]{64}$');
  END IF;
END
$$;
