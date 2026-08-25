import assert from 'node:assert/strict'
import test from 'node:test'

let queueCampaignFormPatch
try {
  ;({ queueCampaignFormPatch } = await import('../src/lib/campaignFormState.ts'))
} catch (error) {
  if (error?.code !== 'ERR_MODULE_NOT_FOUND') throw error
}

const initialForm = {
  name: '',
  dept: '',
  status: 'Pending',
  due: '2026-08-25',
  requesterName: '',
  requesterEmail: '',
  priority: '',
  requestType: [],
  description: '',
}

test('queued Campaign field changes preserve a previously selected due date', () => {
  assert.equal(
    typeof queueCampaignFormPatch,
    'function',
    'Campaign form updates must be queued from the latest React state',
  )

  const queuedUpdates = [
    queueCampaignFormPatch({ due: '2026-09-15' }),
    queueCampaignFormPatch({ dept: 'Stage 3A-2F UAT' }),
  ]
  const result = queuedUpdates.reduce((form, update) => update(form), initialForm)

  assert.equal(result.due, '2026-09-15')
  assert.equal(result.dept, 'Stage 3A-2F UAT')
  assert.equal(result.status, 'Pending')
})
