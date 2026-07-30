# AI Execution Brief: Production Readiness

This document is the complete instruction set for the AI executing the
production-readiness work. Do not rely on previous chat history.

> Execution checkpoint (2026-07-30): the local release candidate now contains
> forward migrations `043`–`051` and target-specific Stage A/Stage B
> application builds controlled by `VITE_PRIVATE_STORAGE_ENABLED`. Migrations `043`–`047`
> passed earlier isolated PostgreSQL 17 validation; the `048`–`051` fixture
> passed on fresh local PostgreSQL 17.10 and still requires controlled staging
> execution. Phase 1 remains
> blocked on verified database/Storage recovery, the remote migration
> ledger/policy inventory, and revocation of the credential disclosed in chat.
> No staging or production write is authorized. Continue from
> `docs/RELEASE_CANDIDATE_HANDOFF.md`; do not repeat completed cleanup, use the
> disclosed token, or expose credentials.
> JavaScript, JSX, TypeScript, and TSX are included in the local lint gate.
> Do not clear or migrate operational browser storage until the Phase 1
> inventory and recovery gates are satisfied.

## Mission

Act as the senior engineer and release owner for the repository containing
this document. Its current local path is:

`/Users/nivellemendiola/Documents/GitHub/marketing-department-website`

Stack: Vite, React, TypeScript, Tailwind CSS v4, React Router, Supabase, a
Node production server, and Docker/Coolify.

Make the existing internal marketing portal deploy-ready with:

- every real production record and file preserved;
- Supabase as the source of truth for operational data;
- no reachable mock or fabricated operational data;
- no false-success workflows;
- least-privilege public and authenticated access;
- reproducible database and application deployment;
- verified mobile, keyboard, and accessibility basics;
- a tested, reversible production release.

Do not add unrelated features, broadly redesign the application, or refactor
large pages merely for code organization during this release.

## Required Working Style

1. Read `AGENTS.md` completely before doing anything else.
2. Inspect before editing. Use `rg --files` and targeted `rg -n` searches.
3. Trace every caller of code being changed and fix the shared root cause.
4. Preserve unrelated user changes. Never reset or discard the worktree.
5. Reuse existing patterns and dependencies. Add a dependency only when the
   browser, Node, PostgreSQL, Supabase, or an installed dependency cannot
   safely meet the requirement.
6. Prefer one canonical implementation. Remove or hide incomplete duplicate
   flows instead of building speculative abstractions.
7. Do not split large pages unless extraction is required to remove current
   duplication or safely test a critical boundary.
8. Never simplify security, validation, accessibility, error handling, or
   data-loss prevention.
9. Run the required checks after every phase. Never claim an unrun check
   passed.
10. Work one phase at a time. Do not start the next phase until the current
    phase's acceptance gate passes or is explicitly waived by the user.

If the Ponytail skill is available, use Ponytail `full`.

## Authorization Gates

This brief authorizes repository inspection, repository edits, local checks,
and local-only database testing. It does not by itself authorize access to or
mutation of an external environment.

Use these explicit gates:

| Gate | Required user authorization |
| --- | --- |
| Production read-only inspection | `APPROVE_PRODUCTION_READ_ONLY <project-ref>` |
| Staging database/function/application changes | `APPROVE_STAGING_CHANGES <project-ref>` |
| Production database/function/application deployment | `APPROVE_PRODUCTION_DEPLOYMENT <project-ref> <target>` |
| Auth metadata changes | `APPROVE_AUTH_METADATA_CHANGES <project-ref> <exact-user-ids>` |
| Migration-history repair | `APPROVE_MIGRATION_REPAIR <project-ref> <versions>` |
| Sensitive-data backup export | `APPROVE_SENSITIVE_EXPORT <destination-and-retention>` |
| Staging private-file backfill | `APPROVE_STAGING_BACKFILL <project-ref> <secure-runner>` |
| Production private-file backfill | `APPROVE_PRODUCTION_BACKFILL <project-ref> <secure-runner>` |
| Any operator cleanup of an existing record, file, browser key, review entry, or old column | `APPROVE_DATA_DELETION <restricted-target-manifest-sha256-and-count>` |

Approval for one gate does not imply approval for another. Continue safe
local work while an external gate is pending.

## Sensitive-Data Contract

- Never print, copy, commit, or expose passwords, API keys, JWTs, service-role
  keys, signed URLs, edit tokens, emails, signatures, form contents, files,
  base64 payloads, or production row contents.
- Secrets may come only from the approved environment or secret manager.
- Never run commands that print environment variables or credential files.
- Use schema metadata, aggregate counts, null/orphan counts, object counts and
  sizes, and server-side aggregate checksums instead of row contents.
- Never download production data locally or send it to a third party without
  the sensitive-export approval and an encrypted destination outside Git.
- Prefer managed database backups/PITR over exporting sensitive data.
- Database backups do not contain Supabase Storage objects. Verify database
  recovery and Storage-object recovery independently.
- Log only event IDs, sanitized counts, status, timing, and redacted errors.
- Use synthetic test records. Track their exact IDs and remove only those IDs
  after the test.
- Do not inspect actual user-browser storage values unless separately
  authorized. Inventory browser keys from source code first.

## Prohibited Actions

Never:

- run `supabase db reset` against a linked or production database;
- run production `DROP`, `TRUNCATE`, broad `DELETE`, or broad `UPDATE`;
- disable RLS globally or expose a sensitive table or bucket publicly;
- rewrite, rename, or delete a migration already applied remotely;
- use destructive migration repair or treat migration repair as schema SQL;
- delete suspected demo records based on their names or appearance;
- clear operational browser storage before verified import;
- copy production data into local development, fixtures, screenshots, chat,
  logs, or reports;
- expose a service-role key or private server secret to Vite/browser code;
- mix cleanup/deletion into a security, migration, or cutover deployment;
- push, deploy, or change an external environment without its explicit gate.

Use additive, backward-compatible:

`expand -> copy -> verify -> cut over -> observe -> delayed cleanup`

After migration `050`, rollback only by disabling the database private-write
switch and deploying the recorded storage-aware Stage A artifact. Never deploy
a pre-Storage artifact. Repair database problems with a reviewed forward
migration. A rollback must never restore anonymous CRUD access.

## Automatic Stop Conditions

Stop the affected external phase and request direction if:

- the exact project reference or deployment target is uncertain;
- credentials point to a different project than the approved target;
- database or Storage recovery cannot be verified;
- remote migration history differs from expectations;
- a proposed change contains destructive or unbounded SQL;
- pre/post counts or checksums differ unexpectedly;
- real operational data may exist only on uninspected user devices;
- a public policy exposes sensitive rows or files;
- validation, staging, or rollback rehearsal fails;
- production contents would need to be displayed to diagnose the problem.

Do not conceal or automatically “fix forward” an unexplained discrepancy.
Preserve sanitized evidence and report the blocker.

## Known Launch Blockers

Verify these findings before changing them; do not assume the list is
complete.

### Security and data integrity

- `supabase/migrations/007_create_marketing_requests.sql` grants broad public
  access to sensitive requests and edit tokens.
- `supabase/migrations/041_ensure_acceptance_forms.sql` grants broad public
  access to forms containing contact, budget, project, and signature data.
- `supabase/migrations/020_create_campaigns_table.sql` grants public campaign
  CRUD, and `013_anyone_insert_calendar_items.sql` permits anonymous inserts.
- `public/view-acceptance.html` renders stored values unsafely and reads auth
  state directly from browser storage.
- `supabase/config.toml` disables JWT verification for multiple functions.
- Email functions accept caller-controlled recipients or content.
- `server/index.mjs` exposes paid AI extraction and generic synchronization
  without a sufficient authenticated authorization boundary.
- Public forms can fall back to browser storage or show success after a
  failed database operation.
- `src/pages/SubmitRequestForm.tsx` generates edit credentials with
  `Math.random()`.
- Browser/database merge logic can resurrect deleted records and report
  partial synchronization as success.
- Base64 files and avatars are stored in browser storage, table columns, JSON,
  or auth metadata instead of private object storage.

### Schema and workflow correctness

- Migration version `020` is duplicated.
- Some policies are created more than once.
- Some migrations alter tables before those tables are created.
- Runtime code references columns not created by repository migrations.
- The `acceptance-pdfs` bucket and its object policies are not reproducibly
  created.
- Tracking numbers are reused without safe concurrency behavior.
- “Send to Ops” uses the wrong authorization and can display false success.
- Acceptance sharing and lookup disagree about whether a row ID or tracking
  ID identifies a form.
- Two Marketing Project List implementations are routed differently, and the
  active legacy implementation fabricates missing operational dates.

### Production UI and deployment

- Runtime mock assets, fake leads, sample meetings, hardcoded people, and
  fabricated dashboard data are reachable.
- Some operational modules use browser storage as their only persistence.
- Several visible controls do nothing.
- Public form validation, labels, signature semantics, and server validation
  are incomplete.
- Login and multiple operational screens have blocking mobile or keyboard
  issues.
- Muted text and brand-button contrast need correction.
- The internal portal lacks an intentional `noindex, nofollow` policy.
- TypeScript/TSX lint coverage and reproducible clean installation need
  verification.
- `.github/workflows/deploy.yml` targets GitHub Pages even though the product
  requires the Node server and README identifies Docker/Coolify as the
  intended deployment.
- `package-lock.json` is missing while deployment uses `npm ci`.
- The production server contains hardcoded Supabase fallback configuration.

## Phase 0: Repository Baseline

This phase is local and read-only except for the sanitized evidence document.

### Actions

1. Confirm the current branch and preserve the existing worktree:

   ```bash
   git status --short
   git branch --show-current
   node --version
   npm --version
   ```

2. Run and record the existing state:

   ```bash
   npm run lint
   npm run typecheck
   npm run build
   ```

3. Inspect, using targeted searches:

   - routes and public routes;
   - sensitive tables, policies, functions, and Storage buckets;
   - migration versions and ordering;
   - every `localStorage` key;
   - runtime mock/demo records;
   - frontend, server, Edge Function, Docker, and CI environment variables;
   - every caller of the affected public forms, email, AI, and sync paths.

4. Create one redacted evidence file:

   `docs/DEPLOYMENT_READINESS.md`

   It may contain commands, pass/fail results, variable names, sanitized
   counts, versions, risks, and decisions. It must not contain credentials,
   row contents, browser values, or sensitive payloads.

### Required inventory

Classify each browser key as:

- authentication/session;
- harmless preference;
- explicit draft;
- optional cache/read marker;
- operational source data;
- uncertain.

Classify each apparent demo source as:

- runtime-only mock;
- confirmed database demo record;
- real record;
- uncertain.

### Acceptance gate

- Pre-existing failures are distinguished from new failures.
- All relevant routes, storage keys, data stores, and environment-variable
  names are inventoried.
- No external system or user data was accessed.
- No application, database, Storage, browser, or deployment state changed.

## Phase 1: Production Read-Only Data Protection Gate

Requires `APPROVE_PRODUCTION_READ_ONLY <project-ref>`.

### Actions

1. Confirm the project reference independently of hardcoded repository values.
2. Inspect only:

   - remote migration history;
   - schemas, constraints, indexes, grants, policies, and functions;
   - Storage buckets and object policies;
   - aggregate row counts for sensitive tables;
   - aggregate object counts and sizes by bucket;
   - deployment configuration names, not secret values.

3. Verify:

   - a recent restorable database backup/PITR point;
   - retention and restore procedure;
   - separate Storage-object recovery;
   - who is authorized to restore;
   - the rollback observation window.

4. Build a source-of-truth matrix mapping each operational feature to
   Supabase tables, Storage, browser storage, runtime mocks, or an uncertain
   source.

Do not create a logical export unless
`APPROVE_SENSITIVE_EXPORT <destination-and-retention>` is separately granted.

### Acceptance gate

- Exact production project identity is confirmed.
- Backup and Storage recovery are verified.
- Sensitive table/object counts are recorded without row contents.
- Migration drift and uncertain browser-only data are explicitly listed.
- No production state changed.

If recovery cannot be verified, production work stops here.

## Phase 2: Migration, Environment, and Deployment Baseline

Implement locally first. Staging application requires
`APPROVE_STAGING_CHANGES <project-ref>`.

### Actions

1. Compare repository migrations with remote migration history.
2. Treat applied migrations as immutable.
3. Do not alter either duplicate `020_*` migration until remote history
   proves which version was applied.
4. Add uniquely timestamped, forward-only migrations for required production
   changes.
5. Use `migration repair` only for proven history errors and only after
   `APPROVE_MIGRATION_REPAIR`.
6. Make the repository reproducible for a fresh environment without replaying
   the broken legacy sequence against production.
7. Add missing schema, constraints, indexes, bucket creation, and object
   policies using backward-compatible SQL.
8. Remove hardcoded production project fallbacks. Fail clearly when required
   environment variables are absent.
9. Complete `.env.example` with names and descriptions only.
10. Commit a lockfile and use reproducible `npm ci` installation.
11. Make Docker/Coolify the canonical production path because the application
    requires `server/index.mjs`.
12. Disable or remove the GitHub Pages production workflow unless a
    static-only use is explicitly confirmed.
13. Add a minimal unauthenticated `/healthz` endpoint that reveals no
    sensitive configuration.
14. Ensure the production server applies required security headers, SPA
    fallback, unknown-API `404`, `PORT`, graceful shutdown, and a non-root
    container runtime.

### Required checks

```bash
npm ci
npm run lint
npm run typecheck
npm run build
supabase db reset
```

`supabase db reset` is local-only. Confirm the target is local before running
it. Run it twice to prove repeatability.

Before staging migration:

```bash
supabase db push --dry-run
```

Verify the linked target before running the dry run.

### Acceptance gate

- Fresh local reset succeeds twice.
- Migration history has no unexplained ambiguity.
- Staging dry-run lists only reviewed pending migrations.
- Schema diff contains no unexplained destructive change.
- Existing staging rows remain unchanged.
- Clean install, lint, typecheck, build, container startup, and `/healthz`
  pass.

## Phase 3: Security Containment

### Primary targets

- one new timestamped Supabase security migration;
- `supabase/config.toml`;
- `supabase/functions/*/index.ts`;
- `server/index.mjs`;
- `public/view-acceptance.html`;
- public form/view pages;
- email, AI, sync, and staff-only callers.

### Required behavior

1. Anonymous users cannot directly list, update, or delete sensitive tables.
2. Anonymous creation is allowed only through a narrow server operation that:

   - validates every accepted field;
   - rejects protected fields such as status, owner, tracking ID, or recipient;
   - limits method, content type, body size, field lengths, and allowed values;
   - is rate-limited;
   - returns only the minimum required response.

3. Public edit/view access uses a cryptographically random opaque capability
   token scoped to one record and an allowlist of fields/actions.
4. New edit tokens are generated server-side and stored hashed.
5. Existing valid links use a documented temporary compatibility path; do not
   silently invalidate them.
6. Email, paid AI extraction, synchronization, staff listing, editing, and
   deletion require a verified authenticated user.
7. Derive email recipients, trusted links, and content from persisted
   server-side records. Callers cannot override privileged values.
8. Remove the arbitrary-table sync endpoint. Keep only explicit authenticated
   operations if synchronization is still required.
9. Select one calling-card extraction implementation, secure it, and remove
   the unused duplicate.
10. Remove `public/view-acceptance.html`. Use the canonical React viewer and
    render untrusted content as text. Preserve old links through a safe
    redirect or fail-closed compatibility route.
11. Apply safe CORS, request-size limits, error redaction, and production
    security headers. CORS is not authentication.
12. Verify built frontend assets contain no service-role key or private secret.

Do not add a large authorization framework. Authenticated-only policies plus
narrow public capability operations are sufficient unless existing role data
proves finer access is required.

### Acceptance gate

- Anonymous table `SELECT`, `UPDATE`, and `DELETE` fail for protected data.
- Anonymous requests receive `401`/`403` from protected endpoints.
- One valid public token accesses only its intended record and allowed fields.
- Callers cannot override recipients, links, table names, or protected fields.
- Oversized and invalid payloads fail safely.
- Stored-XSS payloads render as inert text.
- Authorized staff workflows still pass.
- Pre/post production row counts are identical.
- A rollback path cannot restore anonymous CRUD.

## Phase 4: Supabase as the Operational Source of Truth

### Actions

1. Define the final Supabase table or private bucket for every operational
   browser key.
2. Keep browser storage only for:

   - auth/session behavior;
   - harmless preferences;
   - explicit drafts;
   - optional caches and read markers that are not authoritative.

3. Do not stop reading or clear operational browser data until a verified
   migration path exists.
4. If the Phase 1 inventory proves real browser-only records exist, implement
   the smallest authenticated one-time importer that:

   - handles only allowlisted known keys;
   - shows sanitized counts, not contents;
   - requires an explicit user action;
   - uses stable IDs and idempotent upserts;
   - reports category-level success/failure;
   - records completion only after server verification;
   - never clears the original browser keys.

5. If no real browser-only records exist, do not build an importer. Remove the
   fallback after the finding is confirmed.
6. Remove automatic browser/database merge and rehydration code that can
   resurrect deleted records.
7. Never report local-only fallback as a successful production save.
8. Move base64 files and avatars to private Supabase Storage:

   - add path/metadata columns first;
   - validate type and size;
   - copy to randomized, authorized object paths;
   - verify count, size, checksum, ownership, and row linkage;
   - switch reads only after verification;
   - retain original columns/files during the observation window.

9. Make data movement idempotent, bounded, and resumable.

### Acceptance gate

- A second authenticated browser sees the same operational records.
- Running an import twice creates no duplicates.
- Interrupted migration retains its source and can safely resume.
- Network/database failure produces an honest error, never success.
- Static searches find no operational browser writes outside approved
  preference/draft/cache keys.
- Private files cannot be downloaded anonymously.
- Counts, stable IDs, object sizes, and checksums match.
- Existing edit links follow the documented compatibility policy.

Stop if authoritative data remains on uninspected user devices.

## Phase 5: Critical Workflow Repair

### Actions

1. Public forms show success and a tracking ID only after a confirmed database
   commit.
2. Generate tracking IDs atomically in PostgreSQL using a non-reused sequence
   or equivalent concurrency-safe mechanism.
3. Repair acceptance lookup and sharing around one canonical tokenized route.
4. Use the authenticated Supabase client for staff-only operations.
5. Treat persistence and external notification as separate outcomes:

   - reserve notification status before delivery;
   - return `alreadySent` for repeated completed deliveries;
   - never automatically retry an unresolved `Sending` reservation;
   - report “saved, notification failed” rather than losing or duplicating the
     saved record.

6. Make synchronization explicit and idempotent; report item-level partial
   failures.
7. Consolidate `/marketing-project-list` and `/marketing-projects` on
   `src/pages/MarketingProjectList.tsx`.
8. Remove the legacy JSX implementation and `marketing-view-package/` only
   after proving no runtime/build consumer remains.
9. Validate every trust boundary on the server using existing capabilities
   before adding dependencies.

### Acceptance gate

- Forced database failure produces no success state or tracking ID.
- Successful submission is queryable using its returned identifier.
- Concurrent submissions produce unique identifiers.
- Repeated completed deliveries return `alreadySent`; an unresolved `Sending`
  reservation is never automatically retried and requires administrator
  reconciliation.
- Repeated synchronization creates no duplicates and reports partial failure.
- Canonical acceptance links work and legacy links redirect safely or fail
  closed.
- End-to-end create, view, edit, approve, sync, upload, download, and notify
  flows pass.

## Phase 6: Remove Runtime Placeholders and Finish Reachable UI

### Actions

1. Remove runtime mock assets, fake companies, fake leads, sample meetings,
   hardcoded people, fabricated metrics, placeholder contact details, broken
   links, and dead controls.
2. Do not delete database rows because they appear to be examples.
3. Input `placeholder` hints are valid form UX and are not fake operational
   data.
4. Use truthful loading, empty, success, partial-success, and error states.
5. Complete each reachable route or remove it from navigation and routing for
   this release.
6. Fix launch-critical:

   - responsive layout at 320px, 375px, 768px, desktop, and 200% zoom;
   - native labels and fieldset/legend semantics;
   - keyboard-operable controls and visible focus;
   - accessible dialogs with focus entry, trapping, Escape, and focus return;
   - signature-canvas labeling and keyboard alternative;
   - inline validation and error announcements;
   - WCAG text contrast;
   - reduced-motion behavior;
   - honest empty/error states;
   - internal-portal `noindex, nofollow`.

7. Prefer existing components and CSS variables. Do not introduce a new design
   system for this release.

### Acceptance gate

- No reachable screen presents fabricated operational data.
- Every visible control performs its stated action.
- Critical routes work at the required widths and zoom without blocked content
  or unintended horizontal scrolling.
- Every workflow is keyboard-operable with visible focus.
- Inputs have programmatic labels and dialogs manage focus correctly.
- Reduced-motion preference is respected.
- Empty/error states never imply that data was saved or loaded.

## Phase 7: Release Verification and Staging

### Required checks

```bash
npm ci
npm run lint
npm run typecheck
npm run build
supabase db reset
supabase db push --dry-run
```

Also complete:

- staging migration application;
- anonymous/authenticated/staff RLS matrix for create/read/update/delete;
- endpoint abuse, invalid-token, and payload-limit tests;
- secret scan that reports filenames only;
- `npm audit --omit=dev`, resolving high/critical production issues;
- Docker image build and non-root container startup;
- `/healthz`, deep SPA route, unknown API `404`, and graceful shutdown checks;
- desktop and mobile browser smoke tests;
- submission, notification retry, synchronization, and Storage-integrity tests;
- application rollback rehearsal;
- access-policy correction rehearsal using a forward migration.

Use existing tooling and Node's built-in test facilities where practical. Do
not add a test framework solely for this release.

### Deployment manifest

Record in `docs/DEPLOYMENT_READINESS.md`:

- commit SHA and all target-specific immutable image digests;
- environment-variable names;
- migration and Edge Function versions;
- test commands and pass/fail status;
- database/Storage recovery confirmation timestamps without credentials;
- pre-deployment sanitized counts;
- rollout order and rollback procedure;
- remaining risks and deferred cleanup.

### Acceptance gate

- All prior phase gates pass against staging.
- Zero P0/P1 security, data-integrity, workflow, accessibility, build, or
  deployment blocker remains.
- Rollback rehearsal succeeds without data deletion.
- Both exact staging artifacts are immutable and identified; production will
  use a separately built target-specific pair from the same commit and lockfile.
- The operator explicitly approves production deployment.

Status may be `LOCAL READY` after local checks or `STAGING READY` after this
gate. Never claim `PRODUCTION READY` here.

## Phase 8: Controlled Production Release

Requires:

`APPROVE_PRODUCTION_DEPLOYMENT <project-ref> <target>`

### Deployment order

1. Confirm the approved project and deployment target.
2. Verify final database/PITR and Storage recovery timestamps.
3. Record pre-deployment counts and critical aggregate checksums.
4. Run the final production migration dry-run.
5. Under the separate Auth-metadata gate, read each approved user's existing
   `app_metadata`, merge `staff: true` without replacing other keys, verify the
   exact user IDs including sales, and force fresh sessions.
6. Confirm production Edge secrets, hostname-restricted Turnstile, allowed
   origins, and the gateway/IP limit for anonymous capability endpoints.
7. Deploy the schema-compatible Edge Functions with the reviewed JWT
   configuration.
8. Because Vite compiles the target Supabase URL, publishable key, and
   Turnstile key into the bundle, never promote staging images. In the
   protected production builder, build exactly one production Stage A
   (`VITE_PRIVATE_STORAGE_ENABLED=false`) and Stage B (`true`) pair from the
   exact staging-tested commit and lockfile. Run the same checks and container
   smoke, record both digests, and do not rebuild those production artifacts.
9. Deploy Stage A, check `/healthz`, and verify both public forms use the Edge
   boundary while the legacy database policies are still present.
10. Apply forward migrations `043`–`051` in version order. Do not exercise
   completion notifications until `051` is installed.
11. Prove anonymous denial, ordinary-account denial, approved staff access,
    sales-only SOW access, private buckets, idempotent public retries, and
    gateway `429` behavior. Also prove inline-write rejection and fail-closed,
    idempotent notification reservation.
12. Keep the write switch disabled, deploy Stage B, verify health and a
    rejected private write, then enable exactly one control row and prove
    private upload, signed read/download, metadata update, delete,
    ambiguous-response preservation, and cleanup/review behavior.
13. Disable the database write switch first and prove an already-open Stage B
    tab cannot start a private write. Roll back to Stage A and prove public,
    link-only, attachment-free, and existing private-file read paths. Redeploy
    Stage B while disabled, then re-enable and repeat the private-write smoke.
14. Enter explicit staff maintenance/quiescence, stop all staff file
    operations, disable private writes, and let automatic cleanup queues
    settle. The switch alone does not block deletion. Then run the separately
    authorized dry-run/backfill/reconciliation sequence on the approved secure
    runner.
15. While maintenance remains active and writes stay disabled, compare
    post-deployment row/object counts, logical and unique bytes,
    restricted-manifest paths, and aggregate checksums. End maintenance,
    re-enable exactly one row, and repeat the Stage B write smoke afterward.
16. Monitor authorization failures, submissions, sync, notification delivery,
    file operations, and redacted server errors.
17. Retain Stage A, compatibility branches, nullable legacy token and inline
    columns, and all original data for the observation window.

If verification fails:

- stop further writes where safely possible;
- preserve sanitized evidence;
- disable the private-write switch and deploy only the recorded storage-aware
  Stage A artifact;
- use the reviewed forward correction for database/RLS issues;
- never restore broad anonymous access;
- never delete records to make counts appear correct.

### Production acceptance gate

- Expected sensitive-table counts reconcile exactly.
- Anonymous access is denied except for approved narrow public submissions.
- Approved staff critical workflows pass; ordinary authenticated accounts
  remain denied.
- No private data appears in client responses, logs, or monitoring.
- Production URL, database, functions, Storage, and application health pass.
- Rollback artifact and forward-correction procedure remain available.

Only now may status be `PRODUCTION READY`.

## Deferred Cleanup Release

The first production deployment does not delete:

- suspected demo database rows;
- original browser keys;
- old base64/file columns;
- compatibility token fields;
- original Storage objects;
- obsolete schema columns.

After the observation window, inventory exact targets and request:

`APPROVE_DATA_DELETION <restricted-target-manifest-sha256-and-count>`

Cleanup must be a separate reviewed deployment with its own backup,
verification, and rollback plan.

## Required Phase Report

After every phase, report:

```text
Phase:
Status: PASS | BLOCKED
Changed files:
Commands and checks:
Data impact:
Security impact:
Evidence:
Remaining blocker or risk:
Rollback:
Next action:
Approval required:
```

Do not say “done,” “deploy-ready,” or `PRODUCTION READY` while a required gate
is blocked.

## Definition of Done

The task is complete only when:

- production deployment and health verification have succeeded;
- all required migrations and functions are versioned and reproducible;
- no reachable runtime mock operational data remains;
- no critical workflow can report success without confirmed persistence;
- sensitive tables and private files pass the full access matrix;
- operational data is no longer dependent on browser storage;
- lint, typecheck, build, clean install, migrations, container, security,
  browser, and rollback checks pass;
- before/after data verification finds no unexplained change;
- no real row or file was deleted during the initial release;
- the final report contains the production URL, release version, evidence, and
  separately deferred cleanup.

Begin with Phase 0. Continue autonomously through safe repository work. Pause
only at the explicit external, production, migration-history, export, or
deletion gates above.
