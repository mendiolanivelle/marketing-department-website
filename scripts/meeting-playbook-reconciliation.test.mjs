import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { PGlite } from '@electric-sql/pglite'

const migrationUrl = new URL(
  '../supabase/migrations/060_reconcile_meeting_playbook.sql',
  import.meta.url,
)

const tables = [
  {
    name: 'meeting_templates',
    columns: [
      ['id', 'text'],
      ['name', 'text'],
      ['description', 'text'],
      ['goal', 'text'],
      ['kpis', 'jsonb'],
      ['pro_tips', 'jsonb'],
      ['flow_steps', 'jsonb'],
      ['created_at', 'timestamp with time zone'],
      ['updated_at', 'timestamp with time zone'],
    ],
  },
  {
    name: 'active_meetings',
    columns: [
      ['id', 'text'],
      ['name', 'text'],
      ['links', 'jsonb'],
      ['checklist', 'jsonb'],
      ['created_at', 'timestamp with time zone'],
      ['updated_at', 'timestamp with time zone'],
    ],
  },
  {
    name: 'meeting_scripts',
    columns: [
      ['id', 'text'],
      ['name', 'text'],
      ['category', 'text'],
      ['text', 'text'],
      ['created_at', 'timestamp with time zone'],
      ['updated_at', 'timestamp with time zone'],
    ],
  },
]

async function createBaseline() {
  const db = await PGlite.create('memory://')
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;

    CREATE SCHEMA auth;
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
  `)
  return db
}

async function applyMigration(db) {
  const sql = await readFile(migrationUrl, 'utf8')
  await db.exec(sql)
}

async function insertSentinels(db) {
  await db.exec(`
    INSERT INTO public.meeting_templates (
      id, name, description, goal, kpis, pro_tips, flow_steps, created_at, updated_at
    ) VALUES (
      'legacy-template', 'Legacy template', 'Preserve description', 'Preserve goal',
      '["Metric"]', '["Tip"]', '[{"step":1}]',
      '2026-01-02T03:04:05Z', '2026-01-02T03:04:06Z'
    );

    INSERT INTO public.active_meetings (
      id, name, links, checklist, created_at, updated_at
    ) VALUES (
      'legacy-meeting', 'Legacy meeting', '[{"label":"Call"}]', '[{"done":false}]',
      '2026-01-03T03:04:05Z', '2026-01-03T03:04:06Z'
    );

    INSERT INTO public.meeting_scripts (
      id, name, category, text, created_at, updated_at
    ) VALUES (
      'legacy-script', 'Legacy script', 'Discovery', 'Preserve script text',
      '2026-01-04T03:04:05Z', '2026-01-04T03:04:06Z'
    );
  `)
}

async function readSentinels(db) {
  const { rows } = await db.query(`
    SELECT 'meeting_templates' AS table_name, id, row_to_json(meeting_templates)::jsonb - 'id' AS payload
    FROM public.meeting_templates WHERE id = 'legacy-template'
    UNION ALL
    SELECT 'active_meetings', id, row_to_json(active_meetings)::jsonb - 'id'
    FROM public.active_meetings WHERE id = 'legacy-meeting'
    UNION ALL
    SELECT 'meeting_scripts', id, row_to_json(meeting_scripts)::jsonb - 'id'
    FROM public.meeting_scripts WHERE id = 'legacy-script'
    ORDER BY table_name
  `)
  return rows.map(({ table_name, id, payload }) => ({ table_name, id, payload }))
}

test('migration 060 creates and re-runs the Meeting Playbook contract without rewriting sentinels', async t => {
  const db = await createBaseline()
  t.after(() => db.close())

  await applyMigration(db)

  const { rows: columns } = await db.query(`
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('meeting_templates', 'active_meetings', 'meeting_scripts')
    ORDER BY table_name, ordinal_position
  `)
  const expectedColumns = tables
    .toSorted(({ name: left }, { name: right }) => left.localeCompare(right))
    .flatMap(({ name, columns: tableColumns }) =>
      tableColumns.map(([column_name, data_type]) => ({
        table_name: name,
        column_name,
        data_type,
      })),
    )
  assert.deepEqual(
    columns.map(({ table_name, column_name, data_type }) => ({
      table_name,
      column_name,
      data_type,
    })),
    expectedColumns,
  )
  assert.ok(
    columns
      .filter(({ data_type }) => data_type === 'text' || data_type === 'jsonb')
      .every(({ is_nullable }) => is_nullable === 'NO'),
  )
  for (const column of columns.filter(({ column_name }) =>
    ['kpis', 'pro_tips', 'flow_steps', 'links', 'checklist', 'created_at', 'updated_at'].includes(column_name),
  )) {
    assert.notEqual(column.column_default, null)
  }

  const { rows: primaryKeys } = await db.query(`
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_name IN ('meeting_templates', 'active_meetings', 'meeting_scripts')
    ORDER BY tc.table_name
  `)
  assert.deepEqual(primaryKeys, [
    { table_name: 'active_meetings', column_name: 'id' },
    { table_name: 'meeting_scripts', column_name: 'id' },
    { table_name: 'meeting_templates', column_name: 'id' },
  ])

  await insertSentinels(db)
  const sentinelsBeforeRerun = await readSentinels(db)
  await applyMigration(db)
  assert.deepEqual(await readSentinels(db), sentinelsBeforeRerun)

  const { rows: counts } = await db.query(`
    SELECT 'meeting_templates' AS table_name, count(*)::integer AS count FROM public.meeting_templates
    UNION ALL
    SELECT 'active_meetings', count(*)::integer FROM public.active_meetings
    UNION ALL
    SELECT 'meeting_scripts', count(*)::integer FROM public.meeting_scripts
    ORDER BY table_name
  `)
  assert.deepEqual(counts, [
    { table_name: 'active_meetings', count: 1 },
    { table_name: 'meeting_scripts', count: 1 },
    { table_name: 'meeting_templates', count: 1 },
  ])

  const { rows: anonymousGrants } = await db.query(`
    SELECT grantee, table_name
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name IN ('meeting_templates', 'active_meetings', 'meeting_scripts')
      AND grantee IN ('PUBLIC', 'anon')
  `)
  assert.deepEqual(anonymousGrants, [])

  const { rows: anonymousFunctionGrants } = await db.query(`
    SELECT grantee
    FROM information_schema.routine_privileges
    WHERE routine_schema = 'public'
      AND routine_name = 'is_staff'
    ORDER BY grantee
  `)
  assert.ok(anonymousFunctionGrants.some(({ grantee }) => grantee === 'authenticated'))
  assert.deepEqual(
    anonymousFunctionGrants.filter(({ grantee }) =>
      ['PUBLIC', 'anon', 'service_role'].includes(grantee),
    ),
    [],
  )

  await db.query(
    "SELECT set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ app_metadata: { staff: true } })],
  )
  assert.deepEqual(
    (await db.query('SELECT public.is_staff() AS allowed')).rows,
    [{ allowed: true }],
  )
  await db.query(
    "SELECT set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ app_metadata: { staff: 'true' } })],
  )
  assert.deepEqual(
    (await db.query('SELECT public.is_staff() AS allowed')).rows,
    [{ allowed: false }],
  )

  const { rows: staffPolicies } = await db.query(`
    SELECT tablename, permissive, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('meeting_templates', 'active_meetings', 'meeting_scripts')
      AND policyname = 'staff_only'
    ORDER BY tablename
  `)
  assert.equal(staffPolicies.length, 3)
  for (const policy of staffPolicies) {
    assert.equal(policy.permissive, 'RESTRICTIVE')
    assert.match(policy.qual, /is_staff\(\)/)
    assert.match(policy.with_check, /is_staff\(\)/)
  }

  const { rows: triggerCounts } = await db.query(`
    SELECT event_object_table AS table_name, count(*)::integer AS count
    FROM information_schema.triggers
    WHERE event_object_schema = 'public'
      AND event_object_table IN ('meeting_templates', 'active_meetings', 'meeting_scripts')
      AND event_manipulation = 'UPDATE'
    GROUP BY event_object_table
    ORDER BY event_object_table
  `)
  assert.deepEqual(triggerCounts, [
    { table_name: 'active_meetings', count: 1 },
    { table_name: 'meeting_scripts', count: 1 },
    { table_name: 'meeting_templates', count: 1 },
  ])
})

test('migration 060 fails closed when a legacy Meeting Playbook table has null or duplicate ids', async t => {
  const db = await createBaseline()
  t.after(() => db.close())
  await db.exec(`
    CREATE TABLE public.meeting_scripts (
      id text,
      name text,
      category text,
      text text,
      created_at timestamptz,
      updated_at timestamptz
    );
    INSERT INTO public.meeting_scripts (id, name, category, text)
    VALUES
      ('duplicate', 'First', 'Discovery', 'First row'),
      ('duplicate', 'Second', 'Discovery', 'Second row'),
      (NULL, 'Missing', 'Discovery', 'Null id');
  `)

  await assert.rejects(
    applyMigration(db),
    /meeting_scripts has null or duplicate ids; manual reconciliation is required/,
  )
})
