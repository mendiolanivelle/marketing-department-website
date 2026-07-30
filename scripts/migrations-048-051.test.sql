\set ON_ERROR_STOP on

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;

CREATE SCHEMA auth;
CREATE SCHEMA storage;

CREATE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

CREATE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT auth.jwt()->>'role';
$$;

CREATE TABLE public.file_tracker_assets (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  type text NOT NULL,
  data_url text,
  url text,
  added_at timestamptz NOT NULL,
  size bigint DEFAULT 0,
  is_mock boolean DEFAULT false
);

CREATE TABLE public.website_requests (
  id uuid PRIMARY KEY,
  attachments jsonb DEFAULT '[]'::jsonb
);

CREATE TABLE storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  public boolean NOT NULL DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

CREATE TABLE storage.objects (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket_id text NOT NULL,
  name text NOT NULL
);

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

\ir ../supabase/migrations/048_explicit_staff_authorization.sql
\ir ../supabase/migrations/049_private_marketing_storage.sql
\ir ../supabase/migrations/050_enforce_private_binary_writes.sql
\ir ../supabase/migrations/051_completion_notification_ledger.sql

GRANT USAGE ON SCHEMA auth, storage TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.jwt(), auth.role()
  TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated;
GRANT USAGE ON SEQUENCE storage.objects_id_seq TO anon, authenticated;

INSERT INTO storage.objects (bucket_id, name)
VALUES ('marketing-assets', 'existing-private-object');

SET request.jwt.claims =
  '{"role":"authenticated","app_metadata":{"staff":true}}';
SET ROLE authenticated;
DO $role_test$
BEGIN
  IF (
    SELECT count(*)
    FROM storage.objects
    WHERE bucket_id = 'marketing-assets'
  ) <> 1 THEN
    RAISE EXCEPTION 'staff could not read private Storage while writes were disabled';
  END IF;

  BEGIN
    INSERT INTO storage.objects (bucket_id, name)
    VALUES ('marketing-assets', 'disabled-write');
    RAISE EXCEPTION 'staff Storage write bypassed disabled switch';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END
$role_test$;
RESET ROLE;

SET request.jwt.claims =
  '{"role":"authenticated","app_metadata":{"staff":false}}';
SET ROLE authenticated;
DO $role_test$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM storage.objects
    WHERE bucket_id = 'marketing-assets'
  ) THEN
    RAISE EXCEPTION 'ordinary account read private Storage';
  END IF;
END
$role_test$;
RESET ROLE;

SET request.jwt.claims = '{"role":"anon"}';
SET ROLE anon;
DO $role_test$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM storage.objects
    WHERE bucket_id = 'marketing-assets'
  ) THEN
    RAISE EXCEPTION 'anonymous account read private Storage';
  END IF;

  BEGIN
    INSERT INTO storage.objects (bucket_id, name)
    VALUES ('marketing-assets', 'anonymous-write');
    RAISE EXCEPTION 'anonymous account wrote private Storage';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END
$role_test$;
RESET ROLE;

UPDATE public.private_storage_control
SET writes_enabled = true
WHERE singleton;
SET request.jwt.claims =
  '{"role":"authenticated","app_metadata":{"staff":true}}';
SET ROLE authenticated;
INSERT INTO storage.objects (bucket_id, name)
VALUES ('marketing-assets', 'enabled-write');
RESET ROLE;

UPDATE public.private_storage_control
SET writes_enabled = false
WHERE singleton;
SET ROLE authenticated;
DELETE FROM storage.objects
WHERE bucket_id = 'marketing-assets'
  AND name = 'enabled-write';
RESET ROLE;

DO $$
DECLARE
  valid_hash constant text := repeat('a', 64);
BEGIN
  IF (
    SELECT count(*)
    FROM storage.buckets
    WHERE id IN ('marketing-assets', 'website-request-attachments')
      AND public = false
      AND file_size_limit = 2097152
  ) <> 2 THEN
    RAISE EXCEPTION 'private bucket assertion failed';
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    '{"role":"authenticated","app_metadata":{"staff":false}}',
    true
  );
  IF public.is_staff() THEN
    RAISE EXCEPTION 'non-staff claim was accepted';
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    '{"role":"authenticated","app_metadata":{"staff":true}}',
    true
  );
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'staff claim was rejected';
  END IF;

  IF public.private_storage_writes_enabled() THEN
    RAISE EXCEPTION 'private Storage kill switch must start disabled';
  END IF;

  -- Stage A must keep non-binary writes working after all migrations.
  INSERT INTO public.file_tracker_assets (
    id,
    name,
    category,
    type,
    url,
    added_at
  )
  VALUES (
    'stage-a-link',
    'Approved link',
    'Documents',
    'link',
    'https://example.test/document',
    now()
  );

  BEGIN
    INSERT INTO public.file_tracker_assets (
      id,
      name,
      category,
      type,
      url,
      storage_path,
      checksum_sha256,
      added_at
    )
    VALUES (
      'link-with-binary-rejected',
      'Invalid link',
      'Documents',
      'link',
      'https://example.test/invalid',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/ffffffff-ffff-4fff-8fff-ffffffffffff',
      valid_hash,
      now()
    );
    RAISE EXCEPTION 'link with binary metadata unexpectedly succeeded';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    UPDATE public.file_tracker_assets
    SET type = 'text/plain'
    WHERE id = 'stage-a-link';
    RAISE EXCEPTION 'asset type mutation unexpectedly succeeded';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  INSERT INTO public.website_requests (id, attachments)
  VALUES (
    '00000000-0000-4000-8000-000000000001',
    '[]'::jsonb
  );

  BEGIN
    INSERT INTO public.file_tracker_assets (
      id,
      name,
      category,
      type,
      data_url,
      added_at
    )
    VALUES (
      'inline-rejected',
      'legacy.txt',
      'Documents',
      'text/plain',
      'data:text/plain;base64,SGVsbG8=',
      now()
    );
    RAISE EXCEPTION 'inline file insert unexpectedly succeeded';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.file_tracker_assets (
      id,
      name,
      category,
      type,
      storage_path,
      checksum_sha256,
      added_at
    )
    VALUES (
      'null-checksum-rejected',
      'private.txt',
      'Documents',
      'text/plain',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      NULL,
      now()
    );
    RAISE EXCEPTION 'NULL checksum unexpectedly succeeded';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.file_tracker_assets (
      id,
      name,
      category,
      type,
      storage_path,
      checksum_sha256,
      added_at
    )
    VALUES (
      'kill-switch-rejected',
      'private.txt',
      'Documents',
      'text/plain',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc/dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      valid_hash,
      now()
    );
    RAISE EXCEPTION 'disabled private Storage write unexpectedly succeeded';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  -- A malformed legacy JSON value must never block deletion.
  PERFORM set_config(
    'request.jwt.claims',
    '{"role":"service_role"}',
    true
  );
  INSERT INTO public.website_requests (id, attachments)
  VALUES (
    '00000000-0000-4000-8000-000000000002',
    '{"legacy":"invalid-shape"}'::jsonb
  );

  INSERT INTO public.private_storage_cleanup (
    bucket_id,
    object_path,
    source_table,
    source_id,
    cleanup_allowed
  )
  VALUES (
    'website-request-attachments',
    'review/website-unreferenced',
    'failed_website_request_upload',
    'malformed-legacy-guard',
    false
  );

  IF public.mark_private_storage_cleanup_safe(
    'website-request-attachments',
    'review/website-unreferenced'
  ) THEN
    RAISE EXCEPTION 'malformed legacy attachments did not block cleanup promotion';
  END IF;

  DELETE FROM public.website_requests
  WHERE id = '00000000-0000-4000-8000-000000000002';

  IF NOT public.mark_private_storage_cleanup_safe(
    'website-request-attachments',
    'review/website-unreferenced'
  ) THEN
    RAISE EXCEPTION 'valid unreferenced website cleanup was not promoted';
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    '{"role":"authenticated","app_metadata":{"staff":true}}',
    true
  );
  UPDATE public.private_storage_control
  SET writes_enabled = true
  WHERE singleton;
  IF NOT public.private_storage_writes_enabled() THEN
    RAISE EXCEPTION 'private Storage kill switch did not enable';
  END IF;

  INSERT INTO public.private_storage_cleanup (
    bucket_id,
    object_path,
    source_table,
    source_id,
    cleanup_allowed
  )
  VALUES (
    'marketing-assets',
    'review/unreferenced',
    'failed_file_upload',
    'review-unreferenced',
    false
  );
  IF NOT public.mark_private_storage_cleanup_safe(
    'marketing-assets',
    'review/unreferenced'
  ) THEN
    RAISE EXCEPTION 'unreferenced review entry was not promoted';
  END IF;

  INSERT INTO public.private_storage_cleanup (
    bucket_id,
    object_path,
    source_table,
    source_id,
    cleanup_allowed
  )
  VALUES (
    'marketing-assets',
    '11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222',
    'failed_file_upload',
    'private-file',
    false
  );

  INSERT INTO public.file_tracker_assets (
    id,
    name,
    category,
    type,
    storage_path,
    checksum_sha256,
    added_at
  )
  VALUES (
    'private-file',
    'private.txt',
    'Documents',
    'text/plain',
    '11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222',
    valid_hash,
    now()
  );

  IF EXISTS (
    SELECT 1
    FROM public.private_storage_cleanup
    WHERE bucket_id = 'marketing-assets'
      AND object_path = '11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222'
  ) THEN
    RAISE EXCEPTION 'canonical metadata did not consume its review reservation';
  END IF;

  IF public.mark_private_storage_cleanup_safe(
    'marketing-assets',
    '11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222'
  ) THEN
    RAISE EXCEPTION 'referenced review entry was promoted';
  END IF;

  INSERT INTO public.private_storage_cleanup (
    bucket_id,
    object_path,
    source_table,
    source_id,
    cleanup_allowed
  )
  VALUES (
    'marketing-assets',
    '55555555-5555-4555-8555-555555555555/66666666-6666-4666-8666-666666666666',
    'failed_file_upload',
    'cleanup-claimed-file',
    true
  );

  BEGIN
    INSERT INTO public.file_tracker_assets (
      id,
      name,
      category,
      type,
      storage_path,
      checksum_sha256,
      added_at
    )
    VALUES (
      'cleanup-claimed-file',
      'late.txt',
      'Documents',
      'text/plain',
      '55555555-5555-4555-8555-555555555555/66666666-6666-4666-8666-666666666666',
      valid_hash,
      now()
    );
    RAISE EXCEPTION 'cleanup-claimed path accepted late metadata';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  IF NOT EXISTS (
    SELECT 1
    FROM public.private_storage_cleanup
    WHERE bucket_id = 'marketing-assets'
      AND object_path = '55555555-5555-4555-8555-555555555555/66666666-6666-4666-8666-666666666666'
      AND cleanup_allowed
  ) THEN
    RAISE EXCEPTION 'cleanup claim was lost after rejected metadata';
  END IF;

  DELETE FROM public.file_tracker_assets WHERE id = 'private-file';
  IF NOT EXISTS (
    SELECT 1
    FROM public.private_storage_cleanup
    WHERE bucket_id = 'marketing-assets'
      AND source_id = 'private-file'
      AND cleanup_allowed
  ) THEN
    RAISE EXCEPTION 'file cleanup was not queued';
  END IF;

  BEGIN
    INSERT INTO public.website_requests (id, attachments)
    VALUES (
      '11111111-1111-4111-8111-111111111111',
      '[{"name":"inline.png","dataUrl":"data:image/png;base64,AA=="}]'::jsonb
    );
    RAISE EXCEPTION 'inline website attachment unexpectedly succeeded';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  INSERT INTO public.website_requests (id, attachments)
  VALUES (
    '22222222-2222-4222-8222-222222222222',
    jsonb_build_array(jsonb_build_object(
      'name', 'private.png',
      'type', 'image/png',
      'path', '33333333-3333-4333-8333-333333333333/44444444-4444-4444-8444-444444444444',
      'sha256', valid_hash
    ))
  );

  DELETE FROM public.website_requests
  WHERE id = '22222222-2222-4222-8222-222222222222';
  IF NOT EXISTS (
    SELECT 1
    FROM public.private_storage_cleanup
    WHERE bucket_id = 'website-request-attachments'
      AND source_id = '22222222-2222-4222-8222-222222222222'
  ) THEN
    RAISE EXCEPTION 'website attachment cleanup was not queued';
  END IF;

  INSERT INTO public.completion_notification_deliveries (
    source,
    source_record_id,
    payload_hash
  )
  VALUES ('campaigns', 1, valid_hash);
END
$$;
