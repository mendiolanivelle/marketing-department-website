import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  createActivityInsert,
  selectUnsyncedBrowserTasks,
} from '../src/lib/dashboardData.ts'

test('browser tasks are migrated once without duplicating canonical tasks', () => {
  const canonical = [
    { id: 8, text: 'Publish launch post', done: false },
  ]
  const browser = [
    { id: 1, text: ' Publish launch post ', done: false },
    { id: 2, text: 'Review campaign brief', done: true },
    { id: 3, text: 'Review campaign brief', done: true },
    { id: 4, text: '', done: false },
    { id: 5, done: false },
  ]

  assert.deepEqual(selectUnsyncedBrowserTasks(canonical, browser), [
    { text: 'Review campaign brief', done: true },
  ])
})

test('persisted activity is tied to the signed-in user and uses a stable timestamp', () => {
  assert.deepEqual(
    createActivityInsert(
      'Timeline',
      'Created table "Launch Plan"',
      'ad1056ba-f961-4e2a-af90-c369b17f433e',
      new Date('2026-08-17T06:30:00.000Z'),
    ),
    {
      action: 'Timeline',
      detail: 'Created table "Launch Plan"',
      timestamp: '2026-08-17T06:30:00.000Z',
      user_id: 'ad1056ba-f961-4e2a-af90-c369b17f433e',
    },
  )
})

test('dashboard reconciliation grants table and sequence access to authenticated users', async () => {
  const migration = await readFile(
    new URL('../supabase/migrations/056_reconcile_dashboard_tasks_activity.sql', import.meta.url),
    'utf8',
  )

  assert.match(migration, /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE[\s\S]*TO authenticated/)
  assert.match(migration, /GRANT USAGE, SELECT ON SEQUENCE[\s\S]*tasks_id_seq[\s\S]*activity_log_id_seq[\s\S]*TO authenticated/)
})
