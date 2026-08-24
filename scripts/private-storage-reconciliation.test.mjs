import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const migrationUrl = new URL(
  '../supabase/migrations/059_reconcile_private_storage.sql',
  import.meta.url,
)

async function createBaseline() {
  const db = await PGlite.create('memory://')
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;

    CREATE SCHEMA auth;
    CREATE SCHEMA storage;

    CREATE FUNCTION auth.role()
    RETURNS text
    LANGUAGE sql
    STABLE
    AS $$
      SELECT nullif(current_setting('request.jwt.claim.role', true), '')
    $$;

    CREATE FUNCTION auth.jwt()
    RETURNS jsonb
    LANGUAGE sql
    STABLE
    AS $$
      SELECT coalesce(
        nullif(current_setting('request.jwt.claims', true), ''),
        '{}'
      )::jsonb
    $$;

    CREATE TABLE storage.buckets (
      id text PRIMARY KEY,
      name text NOT NULL UNIQUE,
      public boolean NOT NULL DEFAULT false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );

    CREATE TABLE storage.objects (
      id text PRIMARY KEY,
      bucket_id text NOT NULL,
      name text NOT NULL
    );
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

    CREATE TABLE public.file_tracker_assets (
      id text PRIMARY KEY,
      name text NOT NULL,
      category text NOT NULL,
      type text NOT NULL,
      data_url text,
      url text,
      added_at timestamptz NOT NULL,
      size bigint DEFAULT 0,
      is_mock boolean DEFAULT false,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    CREATE TABLE public.website_requests (
      id text PRIMARY KEY,
      title text NOT NULL,
      description text NOT NULL,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    INSERT INTO public.file_tracker_assets (
      id,
      name,
      category,
      type,
      data_url,
      added_at,
      size
    ) VALUES (
      'legacy-file',
      'Legacy inline file',
      'Documents',
      'text/plain',
      'data:text/plain;base64,SGVsbG8=',
      now(),
      5
    );
  `)
  return db
}

async function applyMigration(db) {
  const sql = await readFile(migrationUrl, 'utf8')
  await db.exec(sql)
}

async function setStaffClaim(db, staff) {
  await db.query(
    "SELECT set_config('request.jwt.claim.role', 'authenticated', false)",
  )
  await db.query(
    `SELECT set_config(
      'request.jwt.claims',
      $1,
      false
    )`,
    [JSON.stringify({ app_metadata: { staff } })],
  )
}

test('migration 059 reconciles the private-storage schema idempotently without rewriting legacy data', async t => {
  const db = await createBaseline()
  t.after(() => db.close())

  await applyMigration(db)
  await applyMigration(db)

  const { rows: columns } = await db.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (table_name = 'file_tracker_assets'
          AND column_name IN ('storage_path', 'checksum_sha256'))
        OR (table_name = 'website_requests' AND column_name = 'attachments')
      )
    ORDER BY table_name, column_name
  `)
  assert.deepEqual(columns, [
    { table_name: 'file_tracker_assets', column_name: 'checksum_sha256' },
    { table_name: 'file_tracker_assets', column_name: 'storage_path' },
    { table_name: 'website_requests', column_name: 'attachments' },
  ])

  const { rows: buckets } = await db.query(`
    SELECT id, public, file_size_limit, allowed_mime_types
    FROM storage.buckets
    ORDER BY id
  `)
  assert.deepEqual(buckets, [
    {
      id: 'marketing-assets',
      public: false,
      file_size_limit: 2097152,
      allowed_mime_types: null,
    },
    {
      id: 'website-request-attachments',
      public: false,
      file_size_limit: 2097152,
      allowed_mime_types: [
        'image/avif',
        'image/gif',
        'image/jpeg',
        'image/png',
        'image/webp',
      ],
    },
  ])

  const { rows: control } = await db.query(`
    SELECT writes_enabled FROM public.private_storage_control
  `)
  assert.deepEqual(control, [{ writes_enabled: false }])

  const { rows: legacy } = await db.query(`
    SELECT data_url, storage_path, checksum_sha256
    FROM public.file_tracker_assets
    WHERE id = 'legacy-file'
  `)
  assert.deepEqual(legacy, [{
    data_url: 'data:text/plain;base64,SGVsbG8=',
    storage_path: null,
    checksum_sha256: null,
  }])
})

test('migration 059 refuses a pre-enabled private-storage switch instead of silently accepting it', async t => {
  const db = await createBaseline()
  t.after(() => db.close())
  await db.exec(`
    CREATE TABLE public.private_storage_control (
      singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
      writes_enabled boolean NOT NULL DEFAULT false
    );
    INSERT INTO public.private_storage_control (singleton, writes_enabled)
    VALUES (true, true);
  `)

  await assert.rejects(
    applyMigration(db),
    /Existing private Storage write-switch state requires manual review/,
  )
})

test('migration 059 fails private writes closed and consumes upload review reservations atomically', async t => {
  const db = await createBaseline()
  t.after(() => db.close())
  await applyMigration(db)
  await setStaffClaim(db, true)

  const { rows: staff } = await db.query('SELECT public.is_staff() AS allowed')
  assert.deepEqual(staff, [{ allowed: true }])

  await db.exec(`
    INSERT INTO public.file_tracker_assets (
      id, name, category, type, url, added_at, size
    ) VALUES (
      'link-a', 'Portal', 'Documents', 'link', 'https://example.invalid', now(), 0
    )
  `)

  await assert.rejects(
    db.exec(`
      INSERT INTO public.file_tracker_assets (
        id, name, category, type, storage_path, checksum_sha256, added_at, size
      ) VALUES (
        'blocked-file', 'Blocked', 'Documents', 'text/plain', 'blocked/path',
        '${'a'.repeat(64)}', now(), 1
      )
    `),
    /Private Storage writes are disabled/,
  )

  await assert.rejects(
    db.exec(`
      INSERT INTO public.file_tracker_assets (
        id, name, category, type, data_url, added_at, size
      ) VALUES (
        'inline-file', 'Inline', 'Documents', 'text/plain',
        'data:text/plain;base64,QQ==', now(), 1
      )
    `),
    /New file tracker uploads must use private Storage/,
  )

  await db.exec(`
    UPDATE public.private_storage_control SET writes_enabled = true
  `)
  await setStaffClaim(db, false)
  await assert.rejects(
    db.exec(`
      INSERT INTO public.file_tracker_assets (
        id, name, category, type, storage_path, checksum_sha256, added_at, size
      ) VALUES (
        'nonstaff-file', 'Nonstaff', 'Documents', 'text/plain', 'nonstaff/path',
        '${'9'.repeat(64)}', now(), 1
      )
    `),
    /Staff access required for private Storage writes/,
  )
  await setStaffClaim(db, true)

  await db.exec(`
    INSERT INTO public.private_storage_cleanup (
      bucket_id, object_path, source_table, source_id, cleanup_allowed
    ) VALUES (
      'marketing-assets', 'accepted/path', 'failed_file_upload',
      'accepted-file', false
    );
    INSERT INTO public.file_tracker_assets (
      id, name, category, type, storage_path, checksum_sha256, added_at, size
    ) VALUES (
      'accepted-file', 'Accepted', 'Documents', 'text/plain', 'accepted/path',
      '${'b'.repeat(64)}', now(), 1
    );
  `)

  const { rows: reservation } = await db.query(`
    SELECT count(*)::integer AS count
    FROM public.private_storage_cleanup
    WHERE bucket_id = 'marketing-assets'
      AND object_path = 'accepted/path'
  `)
  assert.deepEqual(reservation, [{ count: 0 }])

  await db.exec(`
    INSERT INTO public.private_storage_cleanup (
      bucket_id, object_path, source_table, source_id, cleanup_allowed
    ) VALUES (
      'marketing-assets', 'cleanup/path', 'failed_file_upload',
      'late-file', true
    )
  `)
  await assert.rejects(
    db.exec(`
      INSERT INTO public.file_tracker_assets (
        id, name, category, type, storage_path, checksum_sha256, added_at, size
      ) VALUES (
        'late-file', 'Late', 'Documents', 'text/plain', 'cleanup/path',
        '${'c'.repeat(64)}', now(), 1
      )
    `),
    /Private object path is already scheduled for cleanup/,
  )

  await db.exec(`
    INSERT INTO public.website_requests (
      id, title, description, attachments
    ) VALUES (
      'request-a', 'Request', 'Description',
      '[{"name":"proof.png","type":"image/png","path":"proof/path","sha256":"${'d'.repeat(64)}"}]'::jsonb
    )
  `)
  await assert.rejects(
    db.exec(`
      INSERT INTO public.website_requests (
        id, title, description, attachments
      ) VALUES (
        'request-inline', 'Inline', 'Description',
        '[{"name":"proof.png","dataUrl":"data:image/png;base64,QQ=="}]'::jsonb
      )
    `),
    /Website request attachments require private paths and SHA-256 checksums/,
  )
})

test('migration 059 keeps cleanup available after writes are disabled and installs restrictive bucket policies', async t => {
  const db = await createBaseline()
  t.after(() => db.close())
  await applyMigration(db)
  await setStaffClaim(db, true)

  await db.exec(`
    UPDATE public.private_storage_control SET writes_enabled = true;
    INSERT INTO public.file_tracker_assets (
      id, name, category, type, storage_path, checksum_sha256, added_at, size
    ) VALUES (
      'delete-file', 'Delete', 'Documents', 'text/plain', 'delete/path',
      '${'e'.repeat(64)}', now(), 1
    );
    INSERT INTO public.website_requests (
      id, title, description, attachments
    ) VALUES (
      'delete-request', 'Delete', 'Description',
      '[{"name":"proof.png","type":"image/png","path":"delete/proof","sha256":"${'f'.repeat(64)}"}]'::jsonb
    );
    UPDATE public.private_storage_control SET writes_enabled = false;
    DELETE FROM public.file_tracker_assets WHERE id = 'delete-file';
    DELETE FROM public.website_requests WHERE id = 'delete-request';
  `)

  const { rows: cleanup } = await db.query(`
    SELECT bucket_id, object_path, source_table, cleanup_allowed
    FROM public.private_storage_cleanup
    ORDER BY bucket_id
  `)
  assert.deepEqual(cleanup, [
    {
      bucket_id: 'marketing-assets',
      object_path: 'delete/path',
      source_table: 'file_tracker_assets',
      cleanup_allowed: true,
    },
    {
      bucket_id: 'website-request-attachments',
      object_path: 'delete/proof',
      source_table: 'website_requests',
      cleanup_allowed: true,
    },
  ])

  const { rows: policies } = await db.query(`
    SELECT policyname, permissive, roles
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
    ORDER BY policyname
  `)
  assert.deepEqual(policies, [
    {
      policyname: 'anonymous boundary for private marketing storage',
      permissive: 'RESTRICTIVE',
      roles: ['anon'],
    },
    {
      policyname: 'staff boundary for private marketing storage',
      permissive: 'RESTRICTIVE',
      roles: ['authenticated'],
    },
    {
      policyname: 'staff private marketing storage',
      permissive: 'PERMISSIVE',
      roles: ['authenticated'],
    },
  ])
})
