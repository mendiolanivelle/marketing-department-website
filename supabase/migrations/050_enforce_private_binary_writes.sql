-- Apply after the Storage-aware frontend is live. Service-role migrations may
-- backfill paths/checksums while preserving legacy inline values; staff clients
-- can only create private-Storage metadata.

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
      AND NOT public.private_storage_writes_enabled()
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'Private Storage writes are disabled';
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
