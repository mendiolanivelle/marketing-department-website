import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('marketing users can edit timeline columns without weakening the SOW lead boundary', async () => {
  const [timeline, migration] = await Promise.all([
    read('../src/pages/Timeline.tsx'),
    read('../supabase/migrations/055_allow_marketing_timeline_column_edits.sql'),
  ])

  assert.doesNotMatch(timeline, /if \(changes\.columns && !isSales\)/)
  assert.match(timeline, /targetIndex >= restrictedIndex && !isSales/)
  assert.match(migration, /ADD COLUMN IF NOT EXISTS sales_restricted_from_key text/)
  assert.match(migration, /NEW\.sales_restricted_from_key IS DISTINCT FROM OLD\.sales_restricted_from_key/)
  assert.doesNotMatch(migration, /NEW\.columns IS DISTINCT FROM OLD\.columns/)
  assert.match(migration, /Timeline sales boundary must reference an existing column key/)
  assert.match(migration, /CREATE TRIGGER enforce_timeline_sales_boundary_configuration_trigger/)
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.enforce_sales_only_sow_transition\(\)/)
  assert.match(migration, /CREATE TRIGGER enforce_sales_only_sow_transition_trigger/)
})
