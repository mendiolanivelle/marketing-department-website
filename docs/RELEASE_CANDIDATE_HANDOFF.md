# Release Candidate Handoff

Updated: 2026-07-31 (Asia/Manila)

This is the authoritative continuation point for the current worktree. It
supersedes older status statements in the longer audit documents.

## Outcome

The repository-side production-readiness work is complete for a controlled
staging rehearsal. No staging or production deployment has been performed.
No production record, object, Auth user, policy, secret, or browser key was
changed by this execution.

The release remains externally blocked. Do not describe it as production
ready until every gate in this document passes.

## Current External Gate Status

- Release commit `75cf1d6` is pushed to `master`.
- GitHub CI run `#723` was not started because the GitHub account is locked by
  a billing issue. No test failed in that run; there was no runner.
- The production portal and Coolify control plane both return Cloudflare Tunnel
  error `1033`. The hosting connector must be restored before deployment.
- The production Supabase project is healthy but reports no managed backups.
- Its migration ledger ends at `016`; repository migrations `017` onward must
  be reconciled before `043`–`051` can be applied.
- Both free Supabase project slots are occupied, and no staging branch/project
  exists. Do not repurpose the other project without an exact data-owner
  decision.
- The management token disclosed in chat matches an already expired token.
  Other active tokens were not changed or exposed.
- No production database, Storage, Auth, Edge Function, or application
  deployment mutation was attempted.

## Implemented Release Boundary

- Internal application access requires the exact administrator-controlled
  boolean claim `app_metadata.staff = true`.
- React routes, the Node server, authenticated Edge Functions, and restrictive
  RLS policies reject ordinary Supabase accounts.
- The SOW transition endpoint additionally requires the designated sales
  account.
- Public request and acceptance submissions use bounded Edge Functions,
  server-side Turnstile validation, retry-safe IDs, and no anonymous table
  writes.
- Public edit capabilities are HMAC-derived, hash-at-rest, expiring, and
  revocable.
- The storage-aware frontend reads legacy/private objects in both stages.
  Stage B enables new private Storage writes with UUID-only paths, one-hour
  signed display URLs, 2 MiB limits, and SHA-256 metadata.
- Legacy inline files remain readable and untouched for rollback and verified
  backfill.
- Object deletion is durably queued before metadata disappears. Failed upload
  cleanup is also queued, and page loads retry only entries proven safe to
  delete. Ambiguous upload/save outcomes preserve the object and create a
  review-only entry when the database is reachable. A canonical metadata write
  atomically consumes its review reservation; a path already claimed for
  cleanup rejects late metadata instead of racing object deletion.
- A database kill switch starts disabled, blocks new private object/metadata
  writes from already-open Stage B tabs, and leaves reads/deletion available.
- Fabricated template records are not substituted when canonical loading
  fails. Canonical mock file rows are hidden.
- Team/About and Meeting Playbook are not routed because their production
  flows are incomplete. Inert spreadsheet and timeline controls are removed.
- Dashboard and project metrics report unavailable canonical data as `—`,
  never as a factual zero.
- Generic outreach email is retired with `410 Gone`.
- Ticket and completion notifications reserve delivery state before SMTP and
  never automatically reclaim an unresolved `Sending` state.

## Forward Migrations

Apply only after the remote migration ledger proves these versions are
pending and in the expected order:

| Version | Purpose |
| --- | --- |
| `043` | Close anonymous table access and enforce timeline integrity |
| `044` | Atomic lead ingestion |
| `045` | Idempotent review-ticket creation |
| `046` | Acceptance sign-off fields |
| `047` | Public submission IDs and hashed edit capabilities |
| `048` | Explicit staff authorization boundary |
| `049` | Private buckets, write kill switch, checksums, and object-cleanup queue |
| `050` | Reject new inline binary writes from staff clients |
| `051` | Idempotent completion-notification delivery ledger |

Migration `048` is fresh-reset safe and fails closed when no users have the
staff claim. Staff assignment is an explicit deployment preflight, not a
schema side effect.

Migration `049` never rewrites a colliding bucket configuration. It stops for
manual review if either expected bucket already exists with different privacy,
size, or MIME settings.

The release operator changes the kill switch only through reviewed server-side
SQL under the staging/production deployment authorization. Each transition
must return exactly one row:

```sql
-- Enable only immediately before Stage B verification.
UPDATE public.private_storage_control
SET writes_enabled = true
WHERE singleton AND NOT writes_enabled
RETURNING writes_enabled;

-- Disable before any Stage B rollback.
UPDATE public.private_storage_control
SET writes_enabled = false
WHERE singleton AND writes_enabled
RETURNING writes_enabled;
```

Zero or multiple returned rows is a stop condition. Never expose this control
through browser code.

## Review-Only Object Reconciliation

Every client upload reserves a `cleanup_allowed = false` row before Storage is
called. A failed reservation prevents the upload. These review-only rows are
never drained automatically, so an ambiguous response cannot cause deletion or
lose the only durable object correlation.

The canonical metadata trigger locks and consumes the matching review-only row
inside the same database transaction. If an operator has already promoted that
row to `cleanup_allowed = true`, the metadata write fails. This serializes
linkage against cleanup and prevents a referenced object from being deleted.
Transaction-local consumption of the reservation created by the same upload is
operational bookkeeping. Every operator reconciliation deletion or promotion
still requires the separate deletion authorization below.

Monitor only aggregate counts in ordinary release logs:

```sql
SELECT bucket_id, count(*) AS review_count
FROM public.private_storage_cleanup
WHERE NOT cleanup_allowed
GROUP BY bucket_id
ORDER BY bucket_id;
```

Resolve exact entries only in the approved secure operator session; do not
copy paths or source IDs into chat, tickets, or normal logs. Put the exact
targets in a restricted manifest and identify the authorization by that
manifest's SHA-256 digest and target count:

1. Check whether the exact path is referenced by `file_tracker_assets` or an
   array attachment in `website_requests`.
2. If referenced and verified, obtain deletion approval and delete only its
   review-queue row. The canonical row and Storage object remain untouched.
3. If unreferenced, obtain deletion approval unconditionally before calling
   `public.mark_private_storage_cleanup_safe(bucket, path)`. Promotion enables
   automatic object deletion. The function rechecks database references and
   returns `true` only when it safely promotes the row.
4. A `false` result, missing row, malformed legacy JSON, or uncertain Storage
   result remains a stop/review condition.

## Data Impact

The initial release is additive:

- existing rows and inline base64 values remain unchanged;
- existing Storage objects remain unchanged;
- two private bucket definitions may be created;
- one disabled private-write control row, nullable path/checksum columns,
  policy metadata, cleanup rows, and notification-ledger rows may be added;
- approved Auth users must receive a staff claim by merging it into their
  existing `app_metadata`; existing metadata must not be replaced.

The backfill creates private objects and adds path/checksum metadata while
retaining every original inline value. It performs no deletion.

No cleanup or source deletion is part of this release.

## Local Backfill Tool

`npm run storage:backfill -- [options]`

The tool is dry-run by default. It:

- accepts only a canonical Supabase project URL and a server-side service-role
  credential from the current process environment;
- rejects publishable, anonymous, and management-token formats;
- requires `--execute --confirm-project-ref <exact-ref>` before any write;
- uses bounded keyset pagination;
- validates strict base64, size, MIME, and image signatures;
- uses deterministic source-scoped, non-identifying object paths;
- uploads without overwrite and verifies downloaded SHA-256 before updating
  metadata;
- retains all inline source values;
- writes `0600` JSON/Markdown reports containing aggregate verification data,
  not row IDs, names, individual checksums, or object paths;
- in execute mode, writes a separate restricted `0600` JSONL manifest before
  every possible object upload. It contains opaque object paths, checksums, and
  sizes—but no names, row IDs, or inline content—so an interrupted/conflicted
  run can be reconciled without guessing.

The tool decodes sensitive files in process memory. Run it only in an approved
secure environment. Do not run it on a developer laptop or CI runner against
production without an explicit sensitive-processing/backfill authorization.
Retain the restricted manifest only on that runner until reconciliation is
complete, then dispose of it under the operator's sensitive-artifact policy.

## Local Verification

- TypeScript, lint, both explicit private-Storage flag builds, Edge Function
  bundling, syntax checks, and `git diff --check` pass.
- Focused environment, staff, notification, private-Storage, and backfill
  tests pass 12/12.
- The full `048`–`051` synthetic fixture passes on fresh PostgreSQL 17.10,
  including role-accurate Storage policies and cleanup/linkage serialization.
- The filename-only credential-prefix scan found no tracked-source or built
  artifact match.
- The full Node suite passes 12/13 locally; its only failure is the sandbox
  denying the server test's loopback bind with `listen EPERM`. It remains a CI
  gate.
- Docker is unavailable on this host. Container build/start, controlled
  staging, WAF behavior, live recovery, remote ledger, Auth claims, and target
  configuration remain external gates.

## Required External Gates

1. Revoke the management credential disclosed in chat. Do not reuse it.
2. Establish a replacement credential through a secret manager or a signed-in
   dashboard session. Never paste it into chat, source, logs, or commands that
   print it.
3. Verify the exact target project, managed database backup/PITR timestamp,
   separate Storage-object recovery, remote migration ledger, table policy and
   grant inventory, bucket configuration, object counts, and aggregate sizes.
4. Identify the exact approved staff user IDs. Under the separate Auth-metadata
   authorization, read each current `app_metadata` object server-side, merge
   `staff: true` without replacing other keys, verify the exact IDs including
   the sales account, and force fresh sessions.
5. Configure real staging/production Turnstile widgets, allowed origins, edit
   signing secret, SMTP, trusted portal origins, and server runtime secrets.
6. Configure an external gateway/WAF rate limit for:
   - `public-marketing-request`;
   - `public-acceptance-form`;
   - `send-edit-link`, with stricter lookup/resend treatment.
7. Prove `429` behavior and monitoring evidence in staging. Origin checks and
   Turnstile are not substitutes for an IP/gateway limit.
8. Provide a real staging project and deployment target.

Required authorizations:

```text
APPROVE_STAGING_CHANGES <project-ref>
APPROVE_AUTH_METADATA_CHANGES <project-ref> <exact-user-ids>
APPROVE_STAGING_BACKFILL <project-ref> <secure-runner>
APPROVE_PRODUCTION_DEPLOYMENT <project-ref> <target>
APPROVE_PRODUCTION_BACKFILL <project-ref> <secure-runner>
APPROVE_DATA_DELETION <restricted-target-manifest-sha256-and-count>
```

Each authorization is independent. Production deployment does not authorize
Auth metadata changes, backfill, or deletion.

## Exact Staging Rehearsal

1. Verify recovery, target identity, migration ledger, bucket inventory, and
   pre-change aggregate counts/sizes.
2. Assign approved staging staff claims and refresh their sessions.
3. Configure Edge/runtime secrets and gateway limits.
4. Deploy the reviewed Edge Functions.
5. From one reviewed commit and dependency lock, build and record two immutable
   staging application/container artifacts using only staging public
   configuration:
   - Stage A: `VITE_PRIVATE_STORAGE_ENABLED=false`;
   - Stage B: `VITE_PRIVATE_STORAGE_ENABLED=true`.
   Vite embeds every `VITE_*` value at build time. These staging images must
   never be promoted into production.
6. Deploy Stage A.
   - Public flows are compatible before migration `043`.
   - File Tracker is link-only and Website Request attachments are hidden.
   - Both flows remain schema-compatible before `049`.
7. Verify both public Edge submission flows while legacy policies still exist.
8. Apply migrations `043` through `051` in order. Do not exercise completion
   notifications until `051` is installed.
9. Prove:
   - anonymous reads/writes to protected tables fail;
   - an ordinary authenticated account fails UI, API, function, table, and
     Storage access;
   - approved staff succeeds;
   - only the sales account crosses the restricted SOW boundary;
   - both buckets are private and reject anonymous access;
   - public idempotent retry works;
   - gateway limits return `429`;
   - inline binary writes fail;
   - notification reservation is idempotent and unresolved email delivery
     never retries automatically.
10. Keep the write switch disabled, deploy Stage B, verify health, and prove a
    private write is rejected without creating an object. Then enable the
    single control row, verify exactly one row changed, and prove private
    upload, signed view/download, metadata update, delete,
    ambiguous-response preservation, and durable cleanup/review behavior.
11. Disable the database write switch first. Prove an already-open Stage B tab
    cannot start a new private write. Roll back to the recorded Stage A
    artifact and prove public submissions, link-only File Tracker writes,
    Website Requests without attachments, and existing private-file reads
    still work. Redeploy Stage B while writes remain disabled, then re-enable
    the switch and repeat the private-write smoke test.
12. Enter an explicit staff maintenance/quiescence window, stop all staff file
    operations, disable private writes, and let every `cleanup_allowed = true`
    queue item settle. Record unresolved review-only counts. The write switch
    alone is insufficient because reads and deletions intentionally remain
    available. Only then run the backfill in dry-run mode on the approved
    secure runner. Review only aggregate counts, bytes, invalid-item counts,
    and aggregate checksums.
13. With the environment-specific backfill authorization, execute it and
    repeat until the result is idempotent.
14. While maintenance remains active and staff private writes remain disabled,
    reconcile database rows, Storage objects, logical bytes, unique bytes,
    restricted-manifest paths, and aggregate checksums. Any unexplained
    difference is a stop condition.
15. End maintenance, re-enable exactly one control row, repeat the Stage B
    private-write smoke, and observe the release with original inline data
    retained. Never restore anonymous policies.

## Production Release

Do not promote a staging image into production: its Supabase URL, publishable
key, and Turnstile site key are compiled into the browser bundle. After staging
passes and production deployment is approved, build exactly one immutable
production Stage A and one production Stage B image from the same reviewed
commit and lockfile, using only production public configuration in the
protected builder. Run the same checks and container smoke against both, pin
their digests, and deploy those exact production-target images without another
rebuild. A full release therefore has four target-specific artifacts.

Repeat the staging-tested rollout sequence with the production pair and record:

- release commit and all four staging/production artifact digests;
- pre/post row and object aggregates;
- backup and Storage recovery timestamps;
- migration versions;
- function versions;
- smoke-test results;
- WAF `429` evidence;
- rollback result.

Do not send real notification tests without approved recipients. Raw SMTP
cannot prove duplicate-free retry after an uncertain network outcome; an
unresolved `Sending` row requires administrator reconciliation.

Application rollback must disable `private_storage_control.writes_enabled`
before replacing Stage B. Redeploying Stage A alone does not stop already-open
Stage B tabs.

## Delayed Cleanup

Only after the observation window and a separate deletion approval:

- remove verified legacy inline values;
- remove obsolete plaintext token compatibility;
- remove exact orphaned objects;
- remove exact confirmed demo rows;
- clear exact approved browser keys.

The cleanup report must contain exact targets and counts, backup evidence, and
a tested restore path.
