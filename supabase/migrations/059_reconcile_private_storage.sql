-- Reconcile only the private Storage capability required by File Tracker and
-- Website Requests. Historical migrations 017-051 are intentionally not
-- replayed. Legacy inline values remain readable until a controlled backfill.

DO $$
BEGIN
  IF to_regclass('public.file_tracker_assets') IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42P01',
      MESSAGE = 'file_tracker_assets must exist before private Storage reconciliation';
  END IF;

  IF to_regclass('public.website_requests') IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42P01',
      MESSAGE = 'website_requests must exist before private Storage reconciliation';
  END IF;
END
$$;

-- Migration 017 is outside the production ledger, so reconcile its required
-- column here without changing existing attachment JSON.
ALTER TABLE public.website_requests
  ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;

ALTER TABLE public.file_tracker_assets
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS checksum_sha256 text;

COMMENT ON COLUMN public.file_tracker_assets.storage_path IS
  'Private marketing-assets object path. Legacy data_url values are read-only.';
COMMENT ON COLUMN public.file_tracker_assets.checksum_sha256 IS
  'Lowercase SHA-256 of the private object, calculated before upload.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.file_tracker_assets'::regclass
      AND conname = 'file_tracker_assets_checksum_sha256_format'
  ) THEN
    ALTER TABLE public.file_tracker_assets
      ADD CONSTRAINT file_tracker_assets_checksum_sha256_format
      CHECK (
        checksum_sha256 IS NULL
        OR checksum_sha256 ~ '^[0-9a-f]{64}$'
      );
  END IF;
END
$$;

-- Keep the private buckets staff-only without applying the broader historical
-- authorization migration to tables owned by other applications.
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, auth
AS $$
  SELECT coalesce(
    auth.jwt() -> 'app_metadata' -> 'staff' = 'true'::jsonb,
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated, service_role;

-- The database kill switch stops writes from already-open Stage B tabs. It is
-- created disabled and must stay disabled until the controlled rollout.
CREATE TABLE IF NOT EXISTS public.private_storage_control (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  writes_enabled boolean NOT NULL DEFAULT false
);

INSERT INTO public.private_storage_control (singleton, writes_enabled)
VALUES (true, false)
ON CONFLICT (singleton) DO NOTHING;

DO $$
DECLARE
  control_rows integer;
  any_writes_enabled boolean;
BEGIN
  SELECT count(*), coalesce(bool_or(writes_enabled), false)
  INTO control_rows, any_writes_enabled
  FROM public.private_storage_control;

  IF control_rows <> 1 OR any_writes_enabled THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Existing private Storage write-switch state requires manual review';
  END IF;
END
$$;

ALTER TABLE public.private_storage_control ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.private_storage_control
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, UPDATE ON TABLE public.private_storage_control TO service_role;

CREATE OR REPLACE FUNCTION public.private_storage_writes_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    (
      SELECT writes_enabled
      FROM public.private_storage_control
      WHERE singleton
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.private_storage_writes_enabled()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.private_storage_writes_enabled()
  TO authenticated, service_role;

COMMENT ON TABLE public.private_storage_control IS
  'Release-operator kill switch for new private binary writes; reads and cleanup remain available.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('marketing-assets', 'marketing-assets', false, 2097152, null),
  (
    'website-request-attachments',
    'website-request-attachments',
    false,
    2097152,
    ARRAY[
      'image/avif',
      'image/gif',
      'image/jpeg',
      'image/png',
      'image/webp'
    ]::text[]
  )
ON CONFLICT (id) DO NOTHING;

-- Existing buckets may contain production data. Validate instead of silently
-- rewriting any configuration that has drifted.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'marketing-assets'
      AND name = 'marketing-assets'
      AND public = false
      AND file_size_limit = 2097152
      AND allowed_mime_types IS NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Existing marketing-assets bucket configuration requires manual review';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'website-request-attachments'
      AND name = 'website-request-attachments'
      AND public = false
      AND file_size_limit = 2097152
      AND (
        SELECT array_agg(mime_type ORDER BY mime_type)
        FROM unnest(allowed_mime_types) AS mime_type
      ) = ARRAY[
        'image/avif',
        'image/gif',
        'image/jpeg',
        'image/png',
        'image/webp'
      ]::text[]
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Existing website-request-attachments bucket configuration requires manual review';
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.private_storage_cleanup (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket_id text NOT NULL CHECK (
    bucket_id IN ('marketing-assets', 'website-request-attachments')
  ),
  object_path text NOT NULL,
  source_table text NOT NULL CHECK (
    source_table IN (
      'file_tracker_assets',
      'website_requests',
      'failed_file_upload',
      'failed_website_request_upload'
    )
  ),
  source_id text NOT NULL,
  cleanup_allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket_id, object_path)
);

ALTER TABLE public.private_storage_cleanup
  ADD COLUMN IF NOT EXISTS cleanup_allowed boolean NOT NULL DEFAULT true;

ALTER TABLE public.private_storage_cleanup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.private_storage_cleanup FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.private_storage_cleanup_id_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.private_storage_cleanup TO authenticated;
GRANT USAGE ON SEQUENCE public.private_storage_cleanup_id_seq TO authenticated;

DROP POLICY IF EXISTS "staff can inspect private storage cleanup"
  ON public.private_storage_cleanup;
DROP POLICY IF EXISTS "staff can queue private storage cleanup"
  ON public.private_storage_cleanup;
DROP POLICY IF EXISTS "staff can acknowledge private storage cleanup"
  ON public.private_storage_cleanup;
DROP POLICY IF EXISTS staff_only ON public.private_storage_cleanup;

CREATE POLICY staff_only
  ON public.private_storage_cleanup
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "staff can inspect private storage cleanup"
  ON public.private_storage_cleanup
  FOR SELECT
  TO authenticated
  USING (public.is_staff());

CREATE POLICY "staff can queue private storage cleanup"
  ON public.private_storage_cleanup
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY "staff can acknowledge private storage cleanup"
  ON public.private_storage_cleanup
  FOR DELETE
  TO authenticated
  USING (public.is_staff());

-- Promote a review-only object to normal cleanup only after the database
-- proves that no canonical row references it.
CREATE OR REPLACE FUNCTION public.mark_private_storage_cleanup_safe(
  p_bucket text,
  p_object_path text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF coalesce(auth.role(), '') NOT IN ('', 'service_role')
    AND NOT public.is_staff()
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Staff access required';
  END IF;

  IF p_bucket = 'marketing-assets' THEN
    IF EXISTS (
      SELECT 1
      FROM public.file_tracker_assets
      WHERE storage_path = p_object_path
    ) THEN
      RETURN false;
    END IF;
  ELSIF p_bucket = 'website-request-attachments' THEN
    IF EXISTS (
      SELECT 1
      FROM public.website_requests
      WHERE attachments IS NOT NULL
        AND jsonb_typeof(attachments) <> 'array'
    ) THEN
      RETURN false;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.website_requests AS request
      CROSS JOIN LATERAL jsonb_array_elements(
        coalesce(request.attachments, '[]'::jsonb)
      ) AS attachment(value)
      WHERE attachment.value->>'path' = p_object_path
    ) THEN
      RETURN false;
    END IF;
  ELSE
    RETURN false;
  END IF;

  UPDATE public.private_storage_cleanup
  SET cleanup_allowed = true
  WHERE bucket_id = p_bucket
    AND object_path = p_object_path
    AND NOT cleanup_allowed;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_private_storage_cleanup_safe(text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_private_storage_cleanup_safe(text, text)
  TO authenticated, service_role;

-- Link canonical metadata against the cleanup reservation in the same
-- transaction. A path already approved for cleanup cannot be claimed late.
CREATE OR REPLACE FUNCTION public.consume_private_storage_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  attachment_path text;
  cleanup_claimed boolean;
BEGIN
  IF TG_TABLE_NAME = 'file_tracker_assets' THEN
    IF NEW.storage_path IS NULL THEN
      RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE'
      AND NEW.storage_path IS NOT DISTINCT FROM OLD.storage_path
    THEN
      RETURN NEW;
    END IF;

    SELECT cleanup_allowed
    INTO cleanup_claimed
    FROM public.private_storage_cleanup
    WHERE bucket_id = 'marketing-assets'
      AND object_path = NEW.storage_path
    FOR UPDATE;

    IF FOUND THEN
      IF cleanup_claimed THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          MESSAGE = 'Private object path is already scheduled for cleanup';
      END IF;
      DELETE FROM public.private_storage_cleanup
      WHERE bucket_id = 'marketing-assets'
        AND object_path = NEW.storage_path
        AND NOT cleanup_allowed;
    END IF;
  ELSIF TG_TABLE_NAME = 'website_requests'
    AND jsonb_typeof(NEW.attachments) = 'array'
  THEN
    FOR attachment_path IN
      SELECT DISTINCT attachment.value->>'path'
      FROM jsonb_array_elements(NEW.attachments) AS attachment(value)
      WHERE nullif(attachment.value->>'path', '') IS NOT NULL
    LOOP
      cleanup_claimed := NULL;
      SELECT cleanup_allowed
      INTO cleanup_claimed
      FROM public.private_storage_cleanup
      WHERE bucket_id = 'website-request-attachments'
        AND object_path = attachment_path
      FOR UPDATE;

      IF FOUND THEN
        IF cleanup_claimed THEN
          RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Private attachment path is already scheduled for cleanup';
        END IF;
        DELETE FROM public.private_storage_cleanup
        WHERE bucket_id = 'website-request-attachments'
          AND object_path = attachment_path
          AND NOT cleanup_allowed;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_private_storage_review()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS consume_file_tracker_storage_review
  ON public.file_tracker_assets;
CREATE TRIGGER consume_file_tracker_storage_review
BEFORE INSERT OR UPDATE OF storage_path
ON public.file_tracker_assets
FOR EACH ROW
EXECUTE FUNCTION public.consume_private_storage_review();

DROP TRIGGER IF EXISTS consume_website_request_storage_review
  ON public.website_requests;
CREATE TRIGGER consume_website_request_storage_review
BEFORE INSERT OR UPDATE OF attachments
ON public.website_requests
FOR EACH ROW
EXECUTE FUNCTION public.consume_private_storage_review();

CREATE OR REPLACE FUNCTION public.queue_private_storage_cleanup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  attachment_path text;
BEGIN
  IF TG_TABLE_NAME = 'file_tracker_assets' THEN
    IF OLD.storage_path IS NOT NULL THEN
      INSERT INTO public.private_storage_cleanup (
        bucket_id,
        object_path,
        source_table,
        source_id
      )
      VALUES (
        'marketing-assets',
        OLD.storage_path,
        TG_TABLE_NAME,
        OLD.id::text
      )
      ON CONFLICT (bucket_id, object_path) DO UPDATE
        SET cleanup_allowed = true,
            source_table = EXCLUDED.source_table,
            source_id = EXCLUDED.source_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'website_requests'
    AND jsonb_typeof(OLD.attachments) = 'array'
  THEN
    FOR attachment_path IN
      SELECT attachment.value->>'path'
      FROM jsonb_array_elements(coalesce(OLD.attachments, '[]'::jsonb))
        AS attachment(value)
      WHERE nullif(attachment.value->>'path', '') IS NOT NULL
    LOOP
      INSERT INTO public.private_storage_cleanup (
        bucket_id,
        object_path,
        source_table,
        source_id
      )
      VALUES (
        'website-request-attachments',
        attachment_path,
        TG_TABLE_NAME,
        OLD.id::text
      )
      ON CONFLICT (bucket_id, object_path) DO UPDATE
        SET cleanup_allowed = true,
            source_table = EXCLUDED.source_table,
            source_id = EXCLUDED.source_id;
    END LOOP;
  END IF;

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_private_storage_cleanup()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS queue_file_tracker_storage_cleanup
  ON public.file_tracker_assets;
CREATE TRIGGER queue_file_tracker_storage_cleanup
AFTER DELETE
ON public.file_tracker_assets
FOR EACH ROW
EXECUTE FUNCTION public.queue_private_storage_cleanup();

DROP TRIGGER IF EXISTS queue_website_request_storage_cleanup
  ON public.website_requests;
CREATE TRIGGER queue_website_request_storage_cleanup
AFTER DELETE
ON public.website_requests
FOR EACH ROW
EXECUTE FUNCTION public.queue_private_storage_cleanup();

DROP POLICY IF EXISTS "staff private marketing storage" ON storage.objects;
DROP POLICY IF EXISTS "staff boundary for private marketing storage" ON storage.objects;
DROP POLICY IF EXISTS "anonymous boundary for private marketing storage" ON storage.objects;

CREATE POLICY "staff private marketing storage"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id IN ('marketing-assets', 'website-request-attachments')
    AND public.is_staff()
  )
  WITH CHECK (
    bucket_id IN ('marketing-assets', 'website-request-attachments')
    AND public.is_staff()
    AND public.private_storage_writes_enabled()
  );

-- Restrictive policies keep pre-existing broad Storage policies from opening
-- either private bucket.
CREATE POLICY "staff boundary for private marketing storage"
  ON storage.objects
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    bucket_id NOT IN ('marketing-assets', 'website-request-attachments')
    OR public.is_staff()
  )
  WITH CHECK (
    bucket_id NOT IN ('marketing-assets', 'website-request-attachments')
    OR (
      public.is_staff()
      AND public.private_storage_writes_enabled()
    )
  );

CREATE POLICY "anonymous boundary for private marketing storage"
  ON storage.objects
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (
    bucket_id NOT IN ('marketing-assets', 'website-request-attachments')
  )
  WITH CHECK (
    bucket_id NOT IN ('marketing-assets', 'website-request-attachments')
  );

CREATE OR REPLACE FUNCTION public.enforce_private_binary_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() IS NULL OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'file_tracker_assets' THEN
    IF TG_OP = 'UPDATE' AND NEW.type IS DISTINCT FROM OLD.type THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'File tracker asset type is immutable';
    END IF;

    IF TG_OP = 'INSERT' AND NEW.data_url IS NOT NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'New file tracker uploads must use private Storage';
    END IF;

    IF TG_OP = 'UPDATE'
      AND NEW.data_url IS NOT NULL
      AND NEW.data_url IS DISTINCT FROM OLD.data_url
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'New file tracker uploads must use private Storage';
    END IF;

    IF NEW.type = 'link' THEN
      IF NEW.data_url IS NOT NULL
        OR NEW.storage_path IS NOT NULL
        OR NEW.checksum_sha256 IS NOT NULL
      THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          MESSAGE = 'Links cannot contain private binary metadata';
      END IF;
    ELSE
      IF NOT public.is_staff() THEN
        RAISE EXCEPTION USING
          ERRCODE = '42501',
          MESSAGE = 'Staff access required for private Storage writes';
      END IF;

      IF (
        nullif(NEW.storage_path, '') IS NULL
        OR coalesce(NEW.checksum_sha256, '') !~ '^[0-9a-f]{64}$'
      ) THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          MESSAGE = 'File tracker objects require a private path and SHA-256 checksum';
      END IF;

      IF NOT public.private_storage_writes_enabled() THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          MESSAGE = 'Private Storage writes are disabled';
      END IF;
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'website_requests' THEN
    IF NEW.attachments IS NOT NULL
      AND jsonb_typeof(NEW.attachments) <> 'array'
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'Website request attachments must be an array';
    END IF;

    IF jsonb_typeof(NEW.attachments) = 'array'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(NEW.attachments) AS attachment(value)
        WHERE jsonb_typeof(attachment.value) <> 'object'
          OR attachment.value ?| ARRAY['dataUrl', 'data_url']
          OR nullif(attachment.value->>'path', '') IS NULL
          OR coalesce(attachment.value->>'sha256', '') !~ '^[0-9a-f]{64}$'
      )
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'Website request attachments require private paths and SHA-256 checksums';
    END IF;

    IF jsonb_typeof(NEW.attachments) = 'array'
      AND jsonb_array_length(NEW.attachments) > 0
    THEN
      IF NOT public.is_staff() THEN
        RAISE EXCEPTION USING
          ERRCODE = '42501',
          MESSAGE = 'Staff access required for private Storage writes';
      END IF;

      IF NOT public.private_storage_writes_enabled() THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          MESSAGE = 'Private Storage writes are disabled';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_private_binary_writes()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_private_file_tracker_writes
  ON public.file_tracker_assets;
CREATE TRIGGER enforce_private_file_tracker_writes
BEFORE INSERT OR UPDATE OF type, data_url, storage_path, checksum_sha256
ON public.file_tracker_assets
FOR EACH ROW
EXECUTE FUNCTION public.enforce_private_binary_writes();

DROP TRIGGER IF EXISTS enforce_private_website_request_writes
  ON public.website_requests;
CREATE TRIGGER enforce_private_website_request_writes
BEFORE INSERT OR UPDATE OF attachments
ON public.website_requests
FOR EACH ROW
EXECUTE FUNCTION public.enforce_private_binary_writes();
