# Stage 3B-2 Task 2 implementation report

## Scope

Implemented only the Task 2 canonical Meeting Playbook data/recovery module,
its behavior tests, and the existing `npm test` command registration:

- `src/lib/meetingPlaybookData.ts`
- `scripts/meeting-playbook-data.test.mjs`
- `package.json`

No Supabase instance, browser storage, environment, deployment, remote service,
or migration was changed.

## Delivered behavior

- Exports the Meeting Playbook UI/domain and exact canonical row types, plus
  `exodia-playbook-templates`, `exodia-playbook-active`, and
  `exodia-playbook-scripts` constants.
- Reads legacy storage through a `getItem` dependency only. It safely handles
  unavailable storage, malformed JSON, non-arrays, malformed/duplicate stable
  IDs, reports per-key issues and valid-record counts, and makes no storage
  mutation.
- Creates deterministic versioned backups from the caller-provided timestamp.
  The serializer projects only the three canonical record shapes, including
  nested record fields, so unexpected auth/session/token properties are not
  exported.
- Maps all three UI record shapes to the exact snake_case migration-060 table
  payloads and back.
- Plans imports by stable ID without treating collisions as permission to
  overwrite. Canonical reads fail as one operation if any table read is not
  confirmed.
- Requires matching returned IDs for every create/update/delete and rejects
  ambiguous or failed outcomes without reporting local success.
- Imports only planner-approved missing rows and returns per-table saved,
  failed, or skipped outcomes. Partial failures remain retryable because no
  collision is overwritten and legacy keys are never touched.

## TDD evidence

Initial RED command:

```text
node --test scripts/meeting-playbook-data.test.mjs
```

Result: 7/7 tests failed with the expected assertion that
`src/lib/meetingPlaybookData.ts` could not resolve.

Additional RED checks were run before their corresponding changes:

- Duplicate legacy stable IDs initially produced a second valid record; the
  reader test failed until duplicates were rejected from the valid payload.
- A legacy record carrying an unexpected `session` property initially appeared
  in backup JSON; the backup test failed until the serializer projected only
  canonical fields.

Final GREEN commands:

```text
node --test scripts/meeting-playbook-data.test.mjs
npm test
npm run typecheck
```

Results:

- Focused behavior suite: 7 passed, 0 failed.
- Full suite: 67 passed, 0 failed.
- Type check: `tsc --noEmit` completed successfully.

## Review notes

`git diff --check` completed successfully. The test uses a faithful in-memory
query-builder fake only at the external Supabase boundary; all parser, mapper,
backup, planner, and persistence outcomes exercise the real module behavior.
No record content is logged by the module, and error messages intentionally do
not expose database errors or record payloads.

## Fix Round 1

### Corrected behavior

- Bulk insert confirmation now fails closed unless the returned payload is an
  array with exactly one valid, non-empty string ID for each requested row;
  returned IDs must be unique and exactly match the requested stable IDs.
  Duplicate or malformed confirmation rows are therefore never reported as a
  successful import.
- The partial-import behavior now performs a real second import after clearing
  the scripted failure and reloading canonical data. Rows saved on the first
  attempt are skipped as collisions; only the previously failed scripts are
  inserted.
- Removed the unused `emptyRecords` helper.

### TDD evidence

RED command:

```text
node --test scripts/meeting-playbook-data.test.mjs
```

Result: 7 tests passed and the new bulk-confirmation behavior failed as
expected: a two-row duplicate-ID response for one requested template was
incorrectly reported as `{ status: 'saved', saved: 1 }`.

GREEN commands:

```text
node --test scripts/meeting-playbook-data.test.mjs
npm test
npm run typecheck
```

Results:

- Focused behavior suite: 8 passed, 0 failed.
- Full suite: 68 passed, 0 failed.
- Type check: `tsc --noEmit` completed successfully.

`git diff --check` completed successfully before the local commit.
