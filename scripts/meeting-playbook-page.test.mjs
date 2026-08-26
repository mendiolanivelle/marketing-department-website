import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

const bundleDirectory = mkdtempSync(join(tmpdir(), 'meeting-playbook-page-'))
const bundlePath = join(bundleDirectory, 'page.cjs')

await build({
  bundle: true,
  format: 'cjs',
  logLevel: 'silent',
  platform: 'node',
  outfile: bundlePath,
  plugins: [{
    name: 'configured-supabase-boundary',
    setup(buildApi) {
      buildApi.onResolve({ filter: /(?:^|\/)supabase(?:\.ts)?$/ }, () => ({ path: 'supabase-stub', namespace: 'test' }))
      buildApi.onLoad({ filter: /.*/, namespace: 'test' }, () => ({
        contents: 'export const isSupabaseConfigured = true; export const supabase = { from() { throw new Error("effects must not run during static render") } };',
        loader: 'js',
      }))
    },
  }],
  stdin: {
    contents: `
      import { createElement } from 'react'
      import { renderToStaticMarkup } from 'react-dom/server'
      import MeetingPlaybook from ${JSON.stringify(fileURLToPath(new URL('../src/pages/MeetingPlaybook.tsx', import.meta.url)))}

      export const markup = renderToStaticMarkup(createElement(MeetingPlaybook))
    `,
    loader: 'js',
    resolveDir: fileURLToPath(new URL('..', import.meta.url)),
  },
  target: 'node22',
})

const { markup } = createRequire(import.meta.url)(bundlePath)
rmSync(bundleDirectory, { recursive: true })

test('configured mode waits for canonical data before showing playbook records', () => {
  assert.match(markup, /Loading canonical Meeting Playbook/i)
  assert.doesNotMatch(markup, /Discovery Call/)
})
