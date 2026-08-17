import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('notification sends are fail-closed and idempotent', async () => {
  const [ticket, outreach, completion, migration, deliveryMigration, acceptance] = await Promise.all([
    read('../supabase/functions/send-ticket-email/index.ts'),
    read('../supabase/functions/send-outreach-email/index.ts'),
    read('../supabase/functions/notify-complete/index.ts'),
    read('../supabase/migrations/051_completion_notification_ledger.sql'),
    read('../supabase/migrations/057_reconcile_review_ticket_delivery.sql'),
    read('../src/pages/AcceptanceCriteria.tsx'),
  ])

  assert.match(ticket, /\.in\('status', \['Pending', 'Failed'\]\)/)
  assert.doesNotMatch(ticket, /\.eq\('status', ticket\.status/)
  assert.doesNotMatch(ticket, /\.update\(\{ status: 'Failed' \}\)/)
  assert.match(ticket, /hasOnlyKeys\(payload, \['ticketId'\]\)/)

  assert.match(deliveryMigration, /ADD COLUMN IF NOT EXISTS acceptance_form_id bigint/)
  assert.match(deliveryMigration, /UNIQUE \(acceptance_form_id\)/)
  assert.match(deliveryMigration, /status text NOT NULL DEFAULT 'Pending'/)
  assert.match(deliveryMigration, /sent_at timestamptz/)

  assert.match(outreach, /410/)
  assert.doesNotMatch(outreach, /createTransport|sendMail/)

  const reserveAt = completion.indexOf(".from('completion_notification_deliveries')")
  const sendAt = completion.indexOf('await transporter.sendMail')
  const recordAt = completion.lastIndexOf(".from('completion_notification_deliveries')")
  assert.ok(reserveAt >= 0 && reserveAt < sendAt && sendAt < recordAt)
  assert.match(completion, /claimError\.code !== '23505'/)
  assert.match(completion, /Delivery state requires administrator review/)

  assert.match(migration, /PRIMARY KEY \(source, source_record_id, payload_hash\)/)
  assert.match(migration, /status IN \('Sending', 'Sent'\)/)
  assert.doesNotMatch(migration, /GRANT[\s\S]*TO authenticated/)

  assert.match(acceptance, /emailResult\?\.deliveryRecorded !== false/)
  assert.match(acceptance, /Email sent — delivery state unknown/)
})
