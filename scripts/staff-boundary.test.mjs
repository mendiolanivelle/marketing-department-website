import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { isStaffUser } from '../src/lib/staff.js'

test('staff access requires an explicit boolean app_metadata claim', () => {
  assert.equal(isStaffUser(null), false)
  assert.equal(isStaffUser({ app_metadata: {} }), false)
  assert.equal(isStaffUser({ app_metadata: { staff: 'true' } }), false)
  assert.equal(isStaffUser({ app_metadata: { staff: true } }), true)
})

test('staff migration is reset-safe and scoped to portal tables', async () => {
  const sql = await readFile(
    new URL('../supabase/migrations/048_explicit_staff_authorization.sql', import.meta.url),
    'utf8',
  )

  assert.doesNotMatch(sql, /\bauth\.users\b/i)
  assert.match(sql, /auth\.jwt\(\)\s*->\s*'app_metadata'\s*->\s*'staff'\s*=\s*'true'::jsonb/i)
  assert.match(sql, /AS RESTRICTIVE FOR ALL TO authenticated/i)
  assert.match(sql, /FOREACH protected_table IN ARRAY ARRAY\[/i)
  assert.doesNotMatch(sql, /\bpg_class\b|\bpg_namespace\b/i)
  assert.match(sql, /'team_directory'/)
  assert.match(sql, /'timeline_leads'/)
  assert.match(sql, /'workspace_cards'/)
})
