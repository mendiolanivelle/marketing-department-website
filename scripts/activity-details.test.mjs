import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

const detailsBundle = await build({
  bundle: true,
  entryPoints: [
    fileURLToPath(new URL('../src/lib/activityDetails.ts', import.meta.url)),
  ],
  format: 'esm',
  logLevel: 'silent',
  platform: 'node',
  target: 'node22',
  write: false,
})
const detailsUrl = `data:text/javascript;base64,${Buffer.from(
  detailsBundle.outputFiles[0].contents,
).toString('base64')}`
const {
  fileLinkAddedDetail,
  templateFailureDetail,
  timelineNoteDetail,
} = await import(detailsUrl)

test('Timeline note events describe only the completed operation', () => {
  assert.equal(timelineNoteDetail('added', 'Acme'), 'Added note to "Acme"')
  assert.equal(timelineNoteDetail('deleted', 'Acme'), 'Deleted a note from "Acme"')
})

test('File Tracker link activity omits the destination URL', () => {
  assert.equal(
    fileLinkAddedDetail('Private brief'),
    'Added link "Private brief"',
  )
})

test('template failures distinguish save and deletion outcomes', () => {
  assert.equal(
    templateFailureDetail('create', 'Follow-up'),
    'Creation failed for "Follow-up"',
  )
  assert.equal(
    templateFailureDetail('update', 'Follow-up'),
    'Update failed for "Follow-up"',
  )
  assert.equal(
    templateFailureDetail('delete', 'Follow-up'),
    'Deletion failed for "Follow-up"',
  )
})
