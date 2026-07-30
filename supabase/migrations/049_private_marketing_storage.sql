-- New binary uploads belong in private Storage, not base64 database columns.
-- Existing data_url and attachment JSON values remain untouched for controlled
-- recovery; all new writes use object paths.

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

-- This database switch stops new private binary writes even from already-open
-- Stage B tabs. It starts disabled and is changed only by the release operator.
CREATE TABLE IF NOT EXISTS public.private_storage_control (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  writes_enabled boolean NOT NULL DEFAULT false
);

INSERT INTO public.private_storage_control (singleton, writes_enabled)
VALUES (true, false)
ON CONFLICT (singleton) DO NOTHING;

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

-- Never silently rewrite a bucket that may already contain production data.
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

DROP POLICY IF EXISTS "staff can inspect private storage cleanup" ON public.private_storage_cleanup;
DROP POLICY IF EXISTS "staff can queue private storage cleanup" ON public.private_storage_cleanup;
DROP POLICY IF EXISTS "staff can acknowledge private storage cleanup" ON public.private_storage_cleanup;
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

-- Promote a review-only entry only after the database itself proves that no
-- canonical row references the object path.
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
    -- A malformed legacy value could conceal a reference. Require operator
    -- review instead of assuming it is an empty attachment list.
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

-- Serialize metadata linkage against cleanup promotion. A normal upload
-- consumes its review reservation in the same transaction as the canonical
-- row write. A path already claimed for cleanup rejects late linkage.
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
  ELSIF TG_TABLE_NAME = 'website_requests' THEN
    IF jsonb_typeof(OLD.attachments) = 'array' THEN
      FOR attachment_path IN
        SELECT attachment.value->>'path'
        FROM jsonb_array_elements(coalesce(OLD.attachments, '[]'::jsonb)) AS attachment(value)
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
  END IF;

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_private_storage_cleanup() FROM PUBLIC, anon, authenticated;

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

-- Restrictive policies prevent a pre-existing broad Storage policy from
-- accidentally reopening either private bucket.
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
