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
      import MeetingPlaybook, * as MeetingPlaybookModule from ${JSON.stringify(fileURLToPath(new URL('../src/pages/MeetingPlaybook.tsx', import.meta.url)))}

      export const markup = renderToStaticMarkup(createElement(MeetingPlaybook))
      export const controls = MeetingPlaybookModule
      export const renderPersistenceNotice = state => renderToStaticMarkup(
        createElement(MeetingPlaybookModule.MeetingPlaybookPersistenceNotice, { state, onRetry() {} })
      )
    `,
    loader: 'js',
    resolveDir: fileURLToPath(new URL('..', import.meta.url)),
  },
  target: 'node22',
})

const { controls, markup, renderPersistenceNotice } = createRequire(import.meta.url)(bundlePath)
rmSync(bundleDirectory, { recursive: true })

test('configured mode waits for canonical data before showing playbook records', () => {
  assert.match(markup, /Loading canonical Meeting Playbook/i)
  assert.doesNotMatch(markup, /Discovery Call/)
})

test('blocked initialization explains the precondition and renders no inert Retry control', () => {
  const blockedMarkup = renderPersistenceNotice('blocked')
  assert.match(blockedMarkup, /initialization was blocked/i)
  assert.match(blockedMarkup, /canonical or preserved browser data appeared/i)
  assert.doesNotMatch(blockedMarkup, />Retry</)

  const retryableMarkup = renderPersistenceNotice('failed')
  assert.match(retryableMarkup, /canonical save failed/i)
  assert.match(retryableMarkup, />Retry</)
})

test('edit blur followed by delete is serialized without dropping either action', async () => {
  const coordinator = controls.createCanonicalActionCoordinator()
  const events = []
  let records = [{ id: 'template-1', name: 'Before edit' }]
  let releaseEdit
  const editGate = new Promise(resolve => { releaseEdit = resolve })

  const edit = coordinator.enqueueAction(async () => {
    events.push('edit:start')
    await editGate
    records = records.map(record => record.id === 'template-1' ? { ...record, name: 'After edit' } : record)
    events.push('edit:saved')
    return 'saved'
  })
  const remove = coordinator.enqueueAction(async () => {
    events.push(`delete:saw:${records[0]?.name}`)
    records = records.filter(record => record.id !== 'template-1')
    return 'saved'
  })

  releaseEdit()
  await Promise.all([edit, remove])
  assert.deepEqual(events, ['edit:start', 'edit:saved', 'delete:saw:After edit'])
  assert.deepEqual(records, [])
})

test('rapid sequential mutations execute once each against the latest confirmed state', async () => {
  const coordinator = controls.createCanonicalActionCoordinator()
  let confirmedCount = 0
  const calls = [1, 2, 3].map(() => coordinator.enqueueAction(async () => {
    const previous = confirmedCount
    await Promise.resolve()
    confirmedCount = previous + 1
    return 'saved'
  }))

  await Promise.all(calls)
  assert.equal(confirmedCount, 3)
})

test('rapid creates receive distinct ids', () => {
  assert.equal(typeof controls.createMeetingPlaybookId, 'function')
  const ids = new Set(Array.from({ length: 20 }, () => controls.createMeetingPlaybookId('template')))
  assert.equal(ids.size, 20)
  for (const id of ids) assert.match(id, /^template-/)
})

test('rapid record updates compose from the latest confirmed canonical record', async () => {
  assert.equal(typeof controls.createLatestRecordUpdate, 'function')
  const coordinator = controls.createCanonicalActionCoordinator()
  let records = [{ id: 'template-1', kpis: [] }]
  const persist = async next => {
    records = records.map(record => record.id === next.id ? structuredClone(next) : record)
    return structuredClone(next)
  }
  const add = label => controls.createLatestRecordUpdate({
    getRecords: () => records,
    id: 'template-1',
    update: current => ({ ...current, kpis: [...current.kpis, label] }),
    persist,
  })

  await Promise.all([
    coordinator.enqueueAction(async () => { await add('First')(); return 'saved' }),
    coordinator.enqueueAction(async () => { await add('Second')(); return 'saved' }),
  ])
  assert.deepEqual(records[0].kpis, ['First', 'Second'])
})

test('failed older update blocks a newer update until retry preserves invocation order', async () => {
  assert.equal(typeof controls.createCanonicalActionCoordinator, 'function')
  const coordinator = controls.createCanonicalActionCoordinator()
  let remote = [{ id: 'template-1', kpis: [] }]
  const persistenceOrder = []
  let firstAttempts = 0
  let releaseFailed
  const firstFailed = new Promise(resolve => { releaseFailed = resolve })

  const enqueueAdd = (label, failFirstAttempt = false) => coordinator.enqueueMutation({
    execute: async () => {
      if (label === 'First') firstAttempts += 1
      const current = remote[0]
      const intended = { ...current, kpis: [...current.kpis, label] }
      persistenceOrder.push(`${label}:attempt-${label === 'First' ? firstAttempts : 1}`)
      if (failFirstAttempt && firstAttempts === 1) throw new Error('uncommitted failure')
      remote = [structuredClone(intended)]
      return intended
    },
    refresh: async () => structuredClone(remote),
    isSatisfied: records => records[0]?.kpis.includes(label) === true,
    applyConfirmed: records => { remote = [structuredClone(records)] },
    applyRefreshed: records => { remote = structuredClone(records) },
    onSaving: () => {},
    onSaved: () => {},
    onFailed: () => { if (label === 'First') releaseFailed() },
  })

  const first = enqueueAdd('First', true)
  const second = enqueueAdd('Second')
  await firstFailed
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(persistenceOrder, ['First:attempt-1'])
  assert.deepEqual(remote[0].kpis, [])

  coordinator.retry()
  await Promise.all([first, second])
  assert.deepEqual(persistenceOrder, ['First:attempt-1', 'First:attempt-2', 'Second:attempt-1'])
  assert.deepEqual(remote[0].kpis, ['First', 'Second'])
})

test('ambiguous committed create, update, and delete outcomes reconcile as saved', async () => {
  assert.equal(typeof controls.executeCanonicalMutationWithReconciliation, 'function')
  const cases = [
    {
      name: 'create',
      initial: [],
      intended: { id: 'template-1', name: 'Created' },
      commit(records, intended) { records.push(intended) },
      satisfied(records, intended) { return records.some(record => record.id === intended.id && record.name === intended.name) },
    },
    {
      name: 'update',
      initial: [{ id: 'template-1', name: 'Before' }],
      intended: { id: 'template-1', name: 'After' },
      commit(records, intended) { records.splice(0, records.length, intended) },
      satisfied(records, intended) { return records.some(record => record.id === intended.id && record.name === intended.name) },
    },
    {
      name: 'delete',
      initial: [{ id: 'template-1', name: 'Before' }],
      intended: { id: 'template-1' },
      commit(records) { records.splice(0, records.length) },
      satisfied(records, intended) { return !records.some(record => record.id === intended.id) },
    },
  ]

  for (const scenario of cases) {
    const remote = structuredClone(scenario.initial)
    let executeCalls = 0
    let applied = null
    const result = await controls.executeCanonicalMutationWithReconciliation({
      execute: async () => {
        executeCalls += 1
        scenario.commit(remote, scenario.intended)
        throw new Error(`lost ${scenario.name} confirmation`)
      },
      refresh: async () => structuredClone(remote),
      isSatisfied: records => scenario.satisfied(records, scenario.intended),
      applyConfirmed: () => { throw new Error('no direct confirmation expected') },
      applyRefreshed: records => { applied = records },
    })
    assert.equal(result.status, 'saved', scenario.name)
    assert.equal(result.via, 'refresh', scenario.name)
    assert.equal(executeCalls, 1, scenario.name)
    assert.deepEqual(applied, remote, scenario.name)
  }
})

test('ambiguous committed active-meeting create accepts JSONB-reordered nested keys without replay', async () => {
  assert.equal(typeof controls.areMeetingPlaybookRecordsEqual, 'function')
  const coordinator = controls.createCanonicalActionCoordinator()
  const intended = {
    id: 'active-1',
    name: 'Client kickoff',
    links: [{ id: 'link-1', label: 'Meeting link', url: 'https://example.test/meet' }],
    checklist: [{ id: 'check-1', text: 'Send agenda', checked: false }],
  }
  const remote = []
  let executeCalls = 0
  let savedCalls = 0

  await coordinator.enqueueMutation({
    execute: async () => {
      executeCalls += 1
      remote.push({
        name: intended.name,
        id: intended.id,
        links: [{ url: intended.links[0].url, label: intended.links[0].label, id: intended.links[0].id }],
        checklist: [{ checked: false, text: 'Send agenda', id: 'check-1' }],
      })
      throw new Error('confirmation lost after commit')
    },
    refresh: async () => structuredClone(remote),
    isSatisfied: records => records.some(record => controls.areMeetingPlaybookRecordsEqual(record, intended)),
    applyConfirmed: () => { throw new Error('direct confirmation was not expected') },
    applyRefreshed: () => {},
    onSaving: () => {},
    onSaved: () => { savedCalls += 1 },
    onFailed: () => {},
  })

  assert.equal(executeCalls, 1)
  assert.equal(savedCalls, 1)
  assert.equal(remote.length, 1)
  assert.equal(controls.areMeetingPlaybookRecordsEqual(
    { ...intended, links: [...intended.links].reverse(), checklist: [...intended.checklist].reverse() },
    intended,
  ), true)
  assert.equal(controls.areMeetingPlaybookRecordsEqual(
    { ...intended, links: [intended.links[0], { id: 'link-2', label: 'Brief', url: '' }] },
    { ...intended, links: [{ id: 'link-2', label: 'Brief', url: '' }, intended.links[0]] },
  ), false)
})

test('production coordinator reconciles committed update and delete without replay', async () => {
  assert.equal(typeof controls.createCanonicalActionCoordinator, 'function')
  const scenarios = [
    {
      name: 'update',
      initial: [{ id: 'template-1', name: 'Before' }],
      commit: () => [{ id: 'template-1', name: 'After' }],
      satisfied: records => records[0]?.name === 'After',
    },
    {
      name: 'delete',
      initial: [{ id: 'template-1', name: 'Before' }],
      commit: () => [],
      satisfied: records => records.length === 0,
    },
  ]

  for (const scenario of scenarios) {
    const coordinator = controls.createCanonicalActionCoordinator()
    let remote = structuredClone(scenario.initial)
    let executeCalls = 0
    let savedCalls = 0
    await coordinator.enqueueMutation({
      execute: async () => {
        executeCalls += 1
        remote = scenario.commit()
        throw new Error('confirmation lost')
      },
      refresh: async () => structuredClone(remote),
      isSatisfied: scenario.satisfied,
      applyConfirmed: () => { throw new Error('direct confirmation was not expected') },
      applyRefreshed: records => { remote = structuredClone(records) },
      onSaving: () => {},
      onSaved: () => { savedCalls += 1 },
      onFailed: () => {},
    })
    assert.equal(executeCalls, 1, scenario.name)
    assert.equal(savedCalls, 1, scenario.name)
  }
})

test('confirmed create, update, and delete apply direct canonical outcomes without refreshing', async () => {
  for (const operationName of ['create', 'update', 'delete']) {
    let refreshCalls = 0
    let applied = null
    const confirmed = { operationName, id: 'record-1' }
    const result = await controls.executeCanonicalMutationWithReconciliation({
      execute: async () => confirmed,
      refresh: async () => { refreshCalls += 1; return [] },
      isSatisfied: () => false,
      applyConfirmed: value => { applied = value },
      applyRefreshed: () => {},
    })
    assert.deepEqual(result, { status: 'saved', via: 'operation' }, operationName)
    assert.deepEqual(applied, confirmed, operationName)
    assert.equal(refreshCalls, 0, operationName)
  }
})

test('retry refreshes and reconciles before replaying an ambiguously committed create', async () => {
  assert.equal(typeof controls.executeCanonicalMutationWithReconciliation, 'function')
  const intended = { id: 'template-1', name: 'Created' }
  const remote = []
  let executeCalls = 0
  let refreshCalls = 0
  const flow = {
    execute: async () => {
      executeCalls += 1
      remote.push(intended)
      throw new Error('confirmation lost')
    },
    refresh: async () => {
      refreshCalls += 1
      if (refreshCalls === 1) throw new Error('refresh unavailable')
      return structuredClone(remote)
    },
    isSatisfied: records => records.some(record => record.id === intended.id && record.name === intended.name),
    applyConfirmed: () => {},
    applyRefreshed: () => {},
  }

  assert.equal((await controls.executeCanonicalMutationWithReconciliation(flow)).status, 'failed')
  const retried = await controls.executeCanonicalMutationWithReconciliation({ ...flow, reconcileBeforeExecute: true })
  assert.equal(retried.status, 'saved')
  assert.equal(retried.via, 'refresh')
  assert.equal(executeCalls, 1)
})

test('retry does not replay a create when the canonical id is now occupied by different data', async () => {
  let executeCalls = 0
  const remote = [{ id: 'template-1', name: 'Another confirmed template' }]
  const result = await controls.executeCanonicalMutationWithReconciliation({
    execute: async () => {
      executeCalls += 1
      throw new Error('duplicate id')
    },
    refresh: async () => structuredClone(remote),
    isSatisfied: records => records.some(record => record.id === 'template-1' && record.name === 'Intended template'),
    canExecuteAfterRefresh: records => !records.some(record => record.id === 'template-1'),
    applyConfirmed: () => {},
    applyRefreshed: () => {},
    reconcileBeforeExecute: true,
  })

  assert.equal(result.status, 'failed')
  assert.equal(executeCalls, 0)
})

test('default initialization re-reads legacy and canonical state and blocks stale preconditions', async () => {
  assert.equal(typeof controls.executeDefaultInitializationAttempt, 'function')
  const emptyRecords = { templates: [], activeMeetings: [], scripts: [] }
  const emptyIssues = {
    'exodia-playbook-templates': [],
    'exodia-playbook-active': [],
    'exodia-playbook-scripts': [],
  }
  const scenarios = [
    {
      name: 'legacy record appeared',
      legacy: {
        records: { ...emptyRecords, scripts: [{ id: 'script-1' }] },
        counts: { templates: 0, activeMeetings: 0, scripts: 1 },
        issues: emptyIssues,
      },
      canonical: emptyRecords,
    },
    {
      name: 'canonical record appeared',
      legacy: {
        records: emptyRecords,
        counts: { templates: 0, activeMeetings: 0, scripts: 0 },
        issues: emptyIssues,
      },
      canonical: { ...emptyRecords, templates: [{ id: 'template-1' }] },
    },
    {
      name: 'legacy parse issue appeared',
      legacy: {
        records: emptyRecords,
        counts: { templates: 0, activeMeetings: 0, scripts: 0 },
        issues: { ...emptyIssues, 'exodia-playbook-scripts': ['invalid JSON'] },
      },
      canonical: emptyRecords,
    },
  ]

  for (const scenario of scenarios) {
    let importCalls = 0
    const result = await controls.executeDefaultInitializationAttempt({
      continuation: false,
      defaults: emptyRecords,
      readLegacy: () => structuredClone(scenario.legacy),
      fetchCanonical: async () => structuredClone(scenario.canonical),
      applyCanonical: () => {},
      importMissing: async () => { importCalls += 1; return { complete: true } },
    })
    assert.equal(result.status, 'blocked', scenario.name)
    assert.equal(importCalls, 0, scenario.name)
  }
})

test('default initialization retry rechecks eligibility when the failed attempt committed no defaults', async () => {
  const defaults = {
    templates: [{ id: 'template-default', name: 'Default template' }],
    activeMeetings: [],
    scripts: [{ id: 'script-default', name: 'Default script' }],
  }
  const emptyRecords = { templates: [], activeMeetings: [], scripts: [] }
  const emptyIssues = {
    'exodia-playbook-templates': [],
    'exodia-playbook-active': [],
    'exodia-playbook-scripts': [],
  }
  const scenarios = [
    {
      name: 'canonical data appeared',
      afterFailure: () => ({
        canonical: { ...emptyRecords, templates: [{ id: 'template-external', name: 'External template' }] },
        legacy: { records: emptyRecords, counts: { templates: 0, activeMeetings: 0, scripts: 0 }, issues: emptyIssues },
      }),
    },
    {
      name: 'browser data appeared',
      afterFailure: () => ({
        canonical: emptyRecords,
        legacy: {
          records: { ...emptyRecords, scripts: [{ id: 'script-browser', name: 'Browser script' }] },
          counts: { templates: 0, activeMeetings: 0, scripts: 1 },
          issues: emptyIssues,
        },
      }),
    },
  ]

  for (const scenario of scenarios) {
    let state = {
      canonical: structuredClone(emptyRecords),
      legacy: { records: structuredClone(emptyRecords), counts: { templates: 0, activeMeetings: 0, scripts: 0 }, issues: emptyIssues },
    }
    let legacyReads = 0
    let importCalls = 0
    let failedCalls = 0
    let blockedCalls = 0

    const initialize = controls.createDefaultPlaybookInitializationAction({
      defaults,
      readLegacy: () => { legacyReads += 1; return structuredClone(state.legacy) },
      fetchCanonical: async () => structuredClone(state.canonical),
      applyCanonical: () => {},
      importMissing: async () => { importCalls += 1; return { complete: false } },
      onSaving: () => {},
      onSaved: () => {},
      onFailed: () => { failedCalls += 1 },
      onBlocked: () => { blockedCalls += 1 },
    })

    assert.equal(await initialize(false), 'failed', scenario.name)
    state = scenario.afterFailure()
    assert.equal(await initialize(true), 'saved', scenario.name)

    assert.equal(legacyReads, 2, scenario.name)
    assert.equal(importCalls, 1, scenario.name)
    assert.equal(blockedCalls, 1, scenario.name)
  }
})

test('partial default initialization retries only missing defaults without rerunning eligibility', async () => {
  assert.equal(typeof controls.createCanonicalActionCoordinator, 'function')
  assert.equal(typeof controls.createDefaultPlaybookInitializationAction, 'function')
  const coordinator = controls.createCanonicalActionCoordinator()
  const defaults = {
    templates: [{ id: 'template-1', name: 'Default template' }],
    activeMeetings: [],
    scripts: [{ id: 'script-1', name: 'Default script' }],
  }
  const emptyIssues = {
    'exodia-playbook-templates': [],
    'exodia-playbook-active': [],
    'exodia-playbook-scripts': [],
  }
  let canonical = { templates: [], activeMeetings: [], scripts: [] }
  let legacyReads = 0
  const importSnapshots = []
  let failedCalls = 0

  const initialize = coordinator.enqueueAction(controls.createDefaultPlaybookInitializationAction({
    defaults,
    readLegacy: () => {
      legacyReads += 1
      return {
        records: { templates: [], activeMeetings: [], scripts: [] },
        counts: { templates: 0, activeMeetings: 0, scripts: 0 },
        issues: emptyIssues,
      }
    },
    fetchCanonical: async () => structuredClone(canonical),
    applyCanonical: records => { canonical = structuredClone(records) },
    importMissing: async freshCanonical => {
      importSnapshots.push(structuredClone(freshCanonical))
      if (freshCanonical.templates.length === 0) {
        canonical = { ...canonical, templates: structuredClone(defaults.templates) }
        return { complete: false }
      }
      canonical = { ...canonical, scripts: structuredClone(defaults.scripts) }
      return { complete: true }
    },
    onSaving: () => {},
    onSaved: () => {},
    onFailed: () => { failedCalls += 1 },
    onBlocked: () => { throw new Error('continuation must not rerun initial eligibility') },
  }))

  while (failedCalls === 0) await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(canonical, { templates: defaults.templates, activeMeetings: [], scripts: [] })
  assert.equal(legacyReads, 1)

  coordinator.retry()
  await initialize
  assert.equal(legacyReads, 1)
  assert.deepEqual(importSnapshots, [
    { templates: [], activeMeetings: [], scripts: [] },
    { templates: defaults.templates, activeMeetings: [], scripts: [] },
  ])
  assert.deepEqual(canonical, defaults)
})

test('partial default initialization keeps continuation proof across a transient refresh failure', async () => {
  const defaults = {
    templates: [{ id: 'template-1', name: 'Default template' }],
    activeMeetings: [],
    scripts: [{ id: 'script-1', name: 'Default script' }],
  }
  const emptyIssues = {
    'exodia-playbook-templates': [],
    'exodia-playbook-active': [],
    'exodia-playbook-scripts': [],
  }
  let canonical = { templates: [], activeMeetings: [], scripts: [] }
  let fetchCalls = 0
  let importCalls = 0
  let blockedCalls = 0

  const initialize = controls.createDefaultPlaybookInitializationAction({
    defaults,
    readLegacy: () => ({
      records: { templates: [], activeMeetings: [], scripts: [] },
      counts: { templates: 0, activeMeetings: 0, scripts: 0 },
      issues: emptyIssues,
    }),
    fetchCanonical: async () => {
      fetchCalls += 1
      if (fetchCalls === 3) throw new Error('transient refresh failure')
      return structuredClone(canonical)
    },
    applyCanonical: records => { canonical = structuredClone(records) },
    importMissing: async freshCanonical => {
      importCalls += 1
      if (freshCanonical.templates.length === 0) {
        canonical = { ...canonical, templates: structuredClone(defaults.templates) }
        return { complete: false }
      }
      canonical = { ...canonical, scripts: structuredClone(defaults.scripts) }
      return { complete: true }
    },
    onSaving: () => {},
    onSaved: () => {},
    onFailed: () => {},
    onBlocked: () => { blockedCalls += 1 },
  })

  assert.equal(await initialize(false), 'failed')
  assert.deepEqual(canonical, { templates: defaults.templates, activeMeetings: [], scripts: [] })
  assert.equal(await initialize(true), 'failed')
  assert.equal(await initialize(true), 'saved')

  assert.equal(blockedCalls, 0)
  assert.equal(importCalls, 2)
  assert.deepEqual(canonical, defaults)
})

test('canonical load failure remains retryable and applies records only after success', async () => {
  assert.equal(typeof controls.loadCanonicalMeetingPlaybook, 'function')
  const records = { templates: [{ id: 'template-1' }], activeMeetings: [], scripts: [] }
  let fetchCalls = 0
  const applied = []
  const flow = {
    fetchCanonical: async () => {
      fetchCalls += 1
      if (fetchCalls === 1) throw new Error('temporarily unavailable')
      return structuredClone(records)
    },
    applyCanonical: value => applied.push(value),
  }

  assert.equal((await controls.loadCanonicalMeetingPlaybook(flow)).status, 'failed')
  assert.deepEqual(applied, [])
  assert.equal((await controls.loadCanonicalMeetingPlaybook(flow)).status, 'ready')
  assert.deepEqual(applied, [records])
})

test('partial import and initialize outcomes refresh confirmed records and remain failed', async () => {
  assert.equal(typeof controls.executeBulkActionWithRefresh, 'function')
  for (const actionName of ['import', 'initialize']) {
    const refreshed = { templates: [{ id: `${actionName}-partial` }], activeMeetings: [], scripts: [] }
    let refreshCalls = 0
    let applied = null
    const result = await controls.executeBulkActionWithRefresh({
      execute: async () => ({ complete: false }),
      refresh: async () => { refreshCalls += 1; return structuredClone(refreshed) },
      applyRefreshed: records => { applied = records },
    })
    assert.equal(result.status, 'failed', actionName)
    assert.equal(refreshCalls, 1, actionName)
    assert.deepEqual(applied, refreshed, actionName)
  }
})

test('each canonical tab reports its own empty state even when another group has records', () => {
  assert.equal(typeof controls.getMeetingPlaybookEmptyMessage, 'function')
  const records = {
    templates: [{ id: 'template-1' }],
    activeMeetings: [],
    scripts: [{ id: 'script-1' }],
  }

  assert.match(controls.getMeetingPlaybookEmptyMessage('active', records), /No active meetings/i)
  assert.equal(controls.getMeetingPlaybookEmptyMessage('master', records), null)
  assert.equal(controls.getMeetingPlaybookEmptyMessage('vault', records), null)
  assert.match(controls.getMeetingPlaybookEmptyMessage('master', { ...records, templates: [] }), /No meeting templates/i)
  assert.match(controls.getMeetingPlaybookEmptyMessage('vault', { ...records, scripts: [] }), /No scripts/i)
})
