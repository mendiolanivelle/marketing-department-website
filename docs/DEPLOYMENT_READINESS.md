# Deployment Readiness Evidence

Updated: 2026-07-30 (Asia/Manila)

> **Current authority:** use `docs/RELEASE_CANDIDATE_HANDOFF.md` for the
> current migration set (`043`–`051`), external gates, target-specific Stage
> A/Stage B rollout, rollback, and backfill controls. The detailed evidence
> below includes historical checkpoints and must not override that handoff.

## Current Status

- Phase 0 — Repository baseline: **PASS**
- Phase 1 — Production read-only protection gate: **BLOCKED**
- Phase 2 — Reproducible application/runtime baseline: **LOCAL PASS**
- Phase 3 — Public/API containment: **LOCAL PASS; EXTERNAL RATE-LIMIT GATE**
- Phase 6 — Runtime demo and cache-loss containment: **LOCAL PARTIAL PASS**
- Local code release candidate: **PASS**
- Environment release status: **BLOCKED**
- Staging status: **NOT ASSESSED**
- Production status: **BLOCKED; UNCHANGED**
- External systems contacted during this continuation: **None**
- Production data inspected: **Aggregate counts and public metadata only**
- Production data changed: **No**
- Application code changed: **Yes, local worktree only**

The local application, Edge boundaries, and forward migrations now form a
release candidate for controlled staging. Migrations `043`–`047` passed the
earlier isolated PostgreSQL 17 fixture. The expanded `048`–`051` fixture passed
on a fresh local PostgreSQL 17.10 instance and is also wired into CI; controlled
staging execution remains required. Production release is still blocked by managed
recovery evidence, Storage recovery, the remote migration ledger and live
policy inventory, a gateway rate limit for anonymous capability lookups, live
staff authorization, and browser-only sensitive records that have not been
inventoried or migrated. The confirmed live anonymous exposure remains
unchanged until migration `043` is approved and applied.

## Current Local Execution Report

```text
Phase: 2, 3, and 6 — Local Release Candidate
Status: LOCAL PASS; external release gates remain blocked
Changed files: Application, server, Edge Functions, container, CI, and docs
Data impact: No external data changed; no browser keys were cleared or read
Security impact: Public writes contained behind strict Edge functions; 043–051 validated with synthetic data; controlled staging execution remains required
Rollback: Revert the local worktree changes before any deployment
Next action: Revoke the disclosed token, verify recovery and ledger state, then approve staging
Approval required: Staging and production remain separately gated
```

### Completed locally

- Added a committed lockfile and Node `22.13.0` baseline.
- Added TypeScript/TSX ESLint coverage with the official TypeScript ESLint
  parser and rules, while retaining the existing typecheck gate.
- Replaced static Pages deployment with lint/test/build CI.
- Hardened the non-root production container and Node server.
- Made `/healthz` a configuration-aware readiness check and added `/livez`
  for process liveness.
- Removed the unused legacy Project List implementation and duplicate package.
- Removed the unused spreadsheet dependency and limited the local watcher to
  CSV input.
- Removed the unused generic `/api/sync` write endpoint and its unsafe UI.
- Authenticated the paid calling-card API and bounded payloads, timeouts, and
  per-user use.
- Corrected the OpenRouter multimodal payload and now sends the private base64
  image directly, removing the temporary image-serving endpoint.
- Retired the duplicate Edge extraction implementation with a JWT-protected
  `410 Gone` compatibility response so the production function can be disabled
  safely during the reviewed function rollout.
- Added bounded streaming JSON parsing to every reviewed Edge Function.
- Made reviewed Edge Functions validate sessions, inputs, URLs, headers, and
  configured origins; SMTP and trusted link origins now fail closed.
- Made completion email derive the recipient and protected request details
  from the persisted campaign/request row instead of caller-supplied values.
- Removed the unused post-login external redirect path.
- Removed the legacy script-driven acceptance viewer.
- Made public request/acceptance flows retain drafts and report database
  failures instead of displaying success.
- Removed twelve fake assets, four fake outreach leads, four fake dashboard
  tasks, five fake dashboard campaigns, hardcoded team members, and the sample
  active meeting.
- Removed runtime code that deleted saved campaigns by name.
- Added hydration guards to Lead Generation and Timeline so empty async state
  cannot overwrite existing browser caches.
- Removed page-view promotion of browser calendar, file, and acceptance caches
  into Supabase. Existing browser records remain untouched pending migration.
- Stopped the public acceptance form from writing a redundant full submission
  and signature copy to browser storage. Existing browser keys were not read or
  cleared.
- Stopped reviewed lead, timeline, calendar, and meeting flows from caching
  newly fetched or created sensitive records in browser storage or promoting
  page-load cache data back into Supabase.
- Made Campaigns, Timeline, Lead Generation, File Tracker, Marketing Requests,
  and Acceptance Criteria await and verify canonical writes before visible
  success or destructive local state changes. Legacy browser-only records
  remain preserved and read-only.
- Added a 2 MiB bound for database-backed File Tracker uploads pending the
  private Storage migration.
- Removed the directly reachable browser-only Workspace prototype and inert
  spreadsheet controls. Existing user browser keys were not inspected or
  cleared.
- Added programmatic labels, choice-group semantics, invalid-group focus,
  success focus announcements, and visible keyboard focus to the two public
  forms.
- Replaced anonymous browser writes for marketing requests and acceptance
  forms with dedicated, bounded Edge functions.
- Added Cloudflare Turnstile with mandatory server-side action and hostname
  verification, visible fail-closed UI, and production rejection of official
  test credentials.
- Added retry-safe submission UUIDs. Marketing edit capabilities are
  deterministic HMAC values, stored only as SHA-256 hashes after migration,
  expire after 90 days, and can be revoked.
- Separated typed acceptance signatory names, optional drawn PNG signatures,
  and server acceptance timestamps while retaining read-only legacy fallbacks.
- Added migrations `043`–`051` for anonymous-access closure, stable timeline
  authorization, atomic lead ingestion, idempotent ticket delivery, acceptance
  sign-off fields, public-submission idempotency, edit-token hashing, explicit
  staff authorization, private Storage, inline-write enforcement, and the
  completion-notification ledger.
- Made both public functions temporarily compatible with the pre-migration
  schema so functions and the application can be deployed before the final
  access-closing migration without a public-form outage.
- Replaced the platform-specific PowerShell push helper with a dependency-free,
  cross-platform Node script and documented the separate manual Edge Function
  deployment gate.

### Current local checks

| Check | Result |
| --- | --- |
| Clean `npm ci` from lockfile | **PASS** |
| `npm run lint` | **PASS** — zero errors; two Fast Refresh context warnings |
| `npm run typecheck` | **PASS** |
| Stage A and Stage B `npm run build` | **PASS** — explicit `false` and `true` private-Storage builds |
| Focused Node safety tests | **PASS** — 12/12 environment, staff, notification, Storage, and backfill tests |
| Full `npm test` | **LOCAL ENVIRONMENT BLOCKED** — 12/13 passed; only the socket-based server test hit sandbox `listen EPERM`; it remains a CI gate |
| Edge Function bundle/syntax check | **PASS** — nine functions |
| `node --check` for server and watcher | **PASS** |
| `git diff --check` | **PASS** |
| Tracked-source and built-artifact credential-prefix scan | **PASS** |
| Isolated PostgreSQL 17 migrations `043`–`047` | **PASS** — apply, rerun, constraints, auth, legacy JSON, and lock cases |
| PostgreSQL 17 migrations `048`–`051` | **PASS** — fresh PostgreSQL 17.10 role-accurate fixture; CI and controlled staging remain gates |
| Mobile browser smoke: acceptance, request, and login | **PASS** — 390×844, no horizontal overflow |
| Production dependency audit | **REVIEWED EXCEPTION** — RSC-only React Router advisory |

Browser smoke used the built production server at a loopback address with no
Supabase or Turnstile configuration. It confirmed fail-closed login and public
forms, visible verification-unavailable messaging, disabled submits, 13
required acceptance controls, associated critical labels, no horizontal
overflow at 390×844, and the noindex policy. No production system or user
browser storage was accessed.

The host runs Node `25.9.0`, not the pinned Node `22.13.0`, and Docker is not
available locally. CI and the Dockerfile pin Node `22.13.0`; the actual
container build remains a staging gate.

## Historical Evidence Boundary

The chronological Phase 0 through Phase 6 sections below preserve the
pre-remediation findings and dated intermediate evidence. Present-tense
statements in those sections describe their checkpoint, not the current
worktree. Current implementation and release instructions are defined only by
the status above and `docs/RELEASE_CANDIDATE_HANDOFF.md`.

## Phase 0 Report

```text
Phase: 0 — Repository Baseline
Status: PASS
Changed files: Documentation only
Data impact: None
Security impact: None; repository-only inspection
Rollback: Remove the two new documentation files
Next action: Production read-only data protection gate
Approval required: APPROVE_PRODUCTION_READ_ONLY <project-ref>
```

The inventories and failures in the following Phase 0 subsections are the
historical baseline captured before local hardening. Current deltas and checks
are recorded above and in the later phase reports.

## Local Environment

| Item | Result |
| --- | --- |
| Branch | `master` |
| Node | `v25.9.0` |
| npm | `11.12.1` |
| Supabase CLI on `PATH` | Not available |
| Docker on `PATH` | Not available |
| PowerShell on `PATH` | Not available |
| Committed package lockfile | Missing |

The worktree contained the untracked AI execution plan created immediately
before Phase 0. No pre-existing application-code modification was detected.

## Baseline Checks

| Command | Result | Sanitized evidence |
| --- | --- | --- |
| `npm run lint` | **FAIL** | Eight errors in the two legacy JavaScript Project List implementations |
| `npm run typecheck` | **PASS** | TypeScript completed without diagnostics |
| `npm run build` | **FAIL** | Installed dependencies do not contain declared `@iconify/react` |
| `npm ls --depth=0` | **FAIL** | One declared dependency is missing and multiple undeclared packages are installed |

The current install is not reproducible: the repository has no lockfile,
GitHub Actions uses `npm ci`, and Docker uses unpinned `npm install
--legacy-peer-deps`.

## Route Inventory

All client routes use `HashRouter`.

### Public routes

- `#/`
- `#/acceptance-form`
- `#/view-acceptance/:id`
- `#/submit-request`
- `#/edit-request/:token`
- `#/login`
- legacy static `/view-acceptance.html?id=...`

### Authenticated routes

- `#/dashboard`
- `#/team`
- `#/about`
- `#/timeline`
- `#/templates`
- `#/calendar`
- `#/files`
- `#/leads`
- `#/campaigns`
- `#/acceptance-criteria`
- `#/meeting-playbook`
- `#/marketing-project-list`
- `#/marketing-projects`
- `#/requests`
- `#/website-requests`
- `#/workspace`

### Node API routes

- `POST /api/extract-calling-card`
- `GET /api/calling-card-image/:id`
- `POST /api/sync`

### Route defects

- The two Project List routes load different implementations.
- The legacy acceptance viewer and React viewer are both reachable.
- Unknown authenticated routes render an empty protected shell.
- The Node API routes do not authenticate inside their route handlers.

Primary references: `src/App.tsx`, `src/components/Sidebar.tsx`,
`server/index.mjs`, and `public/view-acceptance.html`.

## Source-of-Truth Matrix

| Domain | Current source | Required production source |
| --- | --- | --- |
| Authentication | Supabase Auth plus SDK browser session | Supabase Auth; SDK-managed session only |
| Team directory | Browser-only records and images | Supabase table plus private Storage |
| Dashboard | Browser tasks/campaigns/activity; hybrid calendar and lead state | Supabase operational tables |
| Calendar | Supabase merged with browser data and re-upload logic | Supabase-only writes |
| Files | Supabase metadata, browser base64 files, runtime mocks | Private Storage plus database metadata |
| Lead generation | Supabase plus complete browser copies | Supabase source of truth |
| Timeline | Supabase merged with browser tables and leads | Supabase source of truth |
| Messaging | Browser outreach, hybrid templates/categories | Supabase leads/templates/categories |
| Campaigns | Supabase records merged with browser records | Supabase campaigns/calendar |
| Acceptance | Supabase plus browser form/signature/email copies | Supabase; Storage where appropriate |
| Marketing requests | Supabase or full browser-only fallback | Confirmed Supabase transaction |
| Website requests | Supabase plus browser draft/base64 attachments | Supabase plus private Storage |
| Workspace | Browser-only cards, tasks, links, and images | Supabase/Storage or hidden route |
| Meeting playbook | Browser-only operational records | Supabase or hidden route |
| Project lists | Two Supabase-backed implementations | One typed canonical implementation |

## Browser Storage Classification

No browser values were read. The keys below were discovered statically from
source code.

### Authentication/session

- SDK-managed Supabase session key
- `mb_remember_me`
- `stale-chunk-reloaded`

### Harmless preference or low-risk view state

- `exodia-dark-mode`
- `exodia-team-directory-v`
- `exodia-deleted-mock-assets`
- `exodia-read-announcements`
- `exodia-ac-total`
- `exodia-ac-read-ids`
- `exodia-website-requests-seen-at`
- `exodia-synced-lead-files`

### Sensitive drafts

- `exodia-marketing-request-draft`
- `exodia-website-request-draft`

### Sensitive or authoritative operational data

- `user-avatar`
- `exodia-team-directory`
- `exodia-file-tracker-assets`
- `exodia-marketing-requests`
- `exodia-calendar-items`
- `exodia-workspace-cards`
- `exodia-timeline-tables`
- `exodia-timeline-leads`
- `exodia-message-templates`
- `exodia-lead-files`
- dynamic `exodia-lead-rows-*`
- `exodia-outreach-leads`
- `exodia-template-categories`
- `exodia-playbook-templates`
- `exodia-playbook-active`
- `exodia-playbook-scripts`
- `exodia-tasks`
- `exodia-campaigns`
- `exodia-ops-emails`
- `exodia-ac-submissions`
- `exodia-acceptance-form`
- `exodia-acceptance-last-id`
- `exodia-activity-log`
- dormant/example-package `prt_leads`

Signing out removes the Supabase session but does not remove operational keys.
Sensitive data can therefore remain on a shared browser after logout. These
keys must not be cleared until the production inventory proves whether real
browser-only records exist and a verified migration path is available.

## Runtime Demo and Uncertain Data

### Confirmed runtime mocks

- Twelve File Tracker assets are always merged into the interface.
- Dashboard initializes and persists fabricated tasks and campaigns.
- Messaging initializes and persists fabricated outreach leads.
- Timeline creates a default local onboarding board when no local board exists.
- Meeting Playbook initializes a sample active meeting.

### Repository migration demo data

The timeline migration unconditionally creates a fabricated pipeline and five
fabricated contacts. Existing database rows must not be deleted based only on
matching these names; production classification requires aggregate inventory
and exact approved identifiers.

### Uncertain business presets

- Hardcoded team records
- Message templates
- Meeting templates/scripts

These may be intentional business configuration. They require owner
classification before removal or migration.

## Migration Baseline

The repository contains 41 migration files.

Confirmed defects:

- version `020` is duplicated;
- migration `009` recreates a policy already created in `007`;
- migrations `020_add_missing_tracking_columns` and
  `023_add_prt_marketing_columns` alter `project_review_tickets` before
  migration `036` creates it;
- migration `006` depends on two external tables not created by this
  repository;
- migration `005` inserts fabricated operational data;
- acceptance forms are referenced before creation, created in `035`, then
  recreated/consolidated in `041`;
- the final acceptance policy set permits anonymous CRUD;
- migration `042` adds a realtime publication without an idempotence guard;
- runtime code uses an acceptance PDF bucket, but no repository migration
  creates any Storage bucket or object policy.

Applied migrations remain immutable until approved production read-only
inspection establishes the actual remote migration ledger.

## Security Call-Flow Baseline

| Flow | Current boundary |
| --- | --- |
| Acceptance submission | Public browser writes directly to a sensitive table, derives tracking state client-side, and can report success after failure |
| Marketing request create/edit | Public direct table access, weak client token generation, and browser-only fallback |
| Acceptance sharing | Sequential identifier reaches a public service-role function returning a full row; legacy viewer has stored-XSS behavior |
| Email | Multiple unauthenticated functions accept caller-controlled delivery inputs |
| AI extraction | Node route does not verify the user before invoking a paid external service |
| Generic sync | Node accepts caller-selected table/row pairs without validating the session |
| SOW synchronization | Authenticated writes can trigger cross-domain `SECURITY DEFINER` database behavior; duplicate function path has no confirmed caller |

Additional findings:

- anonymous full CRUD policies exist for marketing requests, campaigns, and
  acceptance forms;
- anonymous calendar insertion is allowed;
- `ProtectedRoute` protects presentation only; backend authorization depends
  on RLS and functions;
- all authenticated accounts currently receive broad shared-table access;
- login redirect handling is not restricted to same-origin application paths;
- acceptance PDF upload requests a public URL without reproducible bucket
  policies;
- “Send to Ops” uses anonymous authorization and reports success regardless
  of persistence.

## Environment Variable Names

No values are recorded here.

### Browser/build

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_BASE`

### Node server and watcher

- `PORT`
- `PUBLIC_SITE_URL`
- `OPENROUTER_API_KEY`
- `OPENROUTER_KEY`
- `OPENROUTER_MODEL`
- `OPENROUTER_MODEL_NAME`
- `OPENROUTER_SITE_URL`
- `OPENROUTER_APP_NAME`
- `OPENROUTER_BASE_URL`
- `OPENROUTER_TIMEOUT_MS`
- `CALLING_CARD_IMAGE_TTL_MS`
- `WATCHED_LEADS_DIR`

### Supabase Edge Functions

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_SECRET_KEYS`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `FROM_EMAIL`

The checked-in environment example documents only the two browser Supabase
variables and optional base path.

## Deployment Baseline

- GitHub Pages deployment cannot serve the required Node API.
- Its workflow runs `npm ci` without a lockfile.
- CI and Docker use different major Node versions.
- The Supabase workflow deploys only one function, uses an unpinned CLI, and
  does not reproduce migrations or all functions.
- The Node server contains a hardcoded Supabase project/key fallback instead
  of failing closed.
- The Node server has no health endpoint or graceful shutdown.
- Unknown `GET /api/*` paths fall through to the SPA.
- Docker uses non-reproducible installation and runs as root.
- The Caddy configuration is unused by the current Docker image.
- Lint covers JavaScript/JSX but not TypeScript/TSX.

## Launch-Critical UI Baseline

- Public forms can falsely report successful persistence.
- Most public-form labels are not programmatically associated with controls.
- Dialogs lack consistent dialog semantics and focus management.
- Several important actions use mouse-only noninteractive elements.
- Icon-only controls commonly lack accessible names.
- The login password reset control is nonfunctional.
- The public landing delay has no reduced-motion bypass.
- Fixed layouts block or overflow on small screens.
- Current muted and brand text colors fail normal-text contrast.
- The internal portal lacks an intentional `noindex, nofollow` directive.

## Phase 1 Gate

The next phase is read-only production inspection. It must not begin until the
user supplies:

```text
APPROVE_PRODUCTION_READ_ONLY <project-ref>
```

Phase 1 will inspect only the approved project identity, migration ledger,
schema/policy/function metadata, aggregate row counts, aggregate Storage
counts/sizes, and managed recovery status. It will not output row contents,
download production data, or change external state.

## Phase 1 Partial Report

The user approved read-only inspection of the configured project on
2026-07-30.

```text
Phase: 1 — Production Read-Only Data Protection Gate
Status: BLOCKED
Changed files: Documentation only
Data impact: None
Security impact: Confirmed anonymous production exposure
Rollback: None required; no external state changed
Next action: Revoke the disclosed token, then authenticate with a safely configured replacement
Approval required: No additional scope approval; authentication is required
```

### Read-only methods used

- anonymous `HEAD` requests with exact-count preference;
- public REST status checks;
- Edge Function `OPTIONS` preflights;
- public Storage bucket-list status check;
- Supabase dashboard navigation without submitting credentials.

No row response body, browser storage, cookie, credential, file, or object was
read.

### Confirmed live exposure

The following tables returned nonzero exact counts to an anonymous client:

| Table | Anonymous aggregate count |
| --- | ---: |
| `acceptance_forms` | 13 |
| `campaigns` | 5 |
| `potential_projects` | 5 |
| `project_review_tickets` | 18 |

Nonzero counts prove anonymous read visibility for those rows. A zero count is
ambiguous: the table may be empty or RLS may hide its rows.

This also proves that live production policy/schema state has drifted from the
repository. The repository declares authenticated-only reads for
`potential_projects` and `project_review_tickets`, but the approved live
project exposes nonzero counts anonymously.

### Function availability

Anonymous CORS preflights returned live responses for:

- `notify-complete`;
- `send-edit-link`;
- `send-outreach-email`;
- `send-ticket-email`;
- `sync-sow-timeline-lead`.

All observed function preflights allowed any origin. The repository
configuration also disables JWT verification for the four mail functions.

The deployed project returned `404` for the repository's
`extract-calling-card` and `get-public-form` function names during these
probes. Their repository presence does not match live deployment.

### Storage result

The anonymous bucket-list endpoint returned an empty visible list. This does
not prove that no private buckets or objects exist; private Storage inventory
requires authorized metadata or read-only SQL.

### Blocking recovery evidence

Phase 1 cannot pass because the current environment has:

- no safely configured replacement management credential;
- no Supabase CLI;
- no database password;
- no authenticated Supabase dashboard session.

Therefore the following required checks remain unverified:

- managed database backup or PITR status and latest recovery point;
- separate Storage-object recovery coverage;
- remote migration ledger;
- complete live RLS policy/grant matrix;
- complete table counts where anonymous RLS hides rows;
- bucket/object counts and sizes.

The signed-in dashboard or a least-privilege management token with
`database:read` and backup-read permissions is required. Do not place that
token in chat or source control.

### Credential handling incident

A Supabase management token was disclosed in chat after the partial Phase 1
audit. The token was not copied into the repository, shell commands, reports,
or application configuration, and was not used by this execution.

Required response:

1. revoke the disclosed management token;
2. create a replacement with the least available read-only permissions;
3. configure it through the local secret/environment mechanism, never chat,
   Git, `.env` committed to the repository, or browser code;
4. resume Phase 1 only after the replacement is configured, or authenticate
   manually in the Supabase dashboard.

The publishable browser key and project URL are not privileged management
credentials, but production still must source them from environment
configuration rather than hardcoded fallbacks.

## Phase 2 Local Report

```text
Phase: 2 — Reproducible Application and Runtime
Status: LOCAL PASS
Data impact: None
External impact: None
```

- Clean installation uses `package-lock.json` and `npm ci`.
- CI uses `.node-version`, runs lint, tests, and build, and performs no
  automatic production deployment.
- Docker uses Node `22.13.0`, a non-root runtime user, a health check, and only
  copies the built frontend and server into the runtime image.
- Browser Supabase configuration is build-time public configuration. Private
  provider credentials remain server-only.
- The server has separate liveness and configuration-aware readiness
  endpoints, graceful shutdown, bounded bodies and timeouts, a noindex policy,
  security headers, redacted errors, safe static caching, and explicit
  unknown-API responses.
- Calling-card images are sent to OpenRouter as private base64 input using the
  provider's documented nested image shape; there is no temporary public image
  endpoint. Deploy one replica until rate limiting is shared.
- The obsolete JavaScript Project List and duplicate example package were
  removed. Both routes now use the typed canonical page.
- The `xlsx` dependency and spreadsheet watcher path were removed. The
  production dependency audit has no finding except the reviewed React Router
  advisory below.
- ESLint now parses and checks JavaScript, JSX, TypeScript, and TSX. Core React
  hook rules remain errors; existing unused-code and dependency warnings stay
  visible as cleanup debt rather than forcing a broad release refactor.

### Dependency exception

`react-router-dom` is pinned to `7.18.2`. The published high-severity advisory
[GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2)
affects unstable React Server Components APIs. This portal
uses a client-side `HashRouter`, has no RSC routes or server actions, and does
not execute the affected feature. The only patched line is the unreleased
8.3.0 series, so the risk is documented rather than hidden. Re-evaluate when a
compatible patched package is published.

## Phase 3 Local Report

```text
Phase: 3 — Public and Privileged Call-Flow Containment
Status: LOCAL PASS; external gateway and staging verification remain
Data impact: None
External impact: None
```

- Calling-card extraction authenticates the Supabase session before invoking
  the paid model, limits each user to five requests per minute per process,
  bounds images, and redacts upstream errors.
- The unused generic browser-to-table sync route and sidebar action were
  removed.
- Staff Edge Functions require a verified user session. Public edit-link mail
  accepts only a cryptographic edit capability and derives the recipient and
  content server-side.
- Every reviewed Edge Function enforces JSON content type and a route-specific
  streaming body limit before parsing.
- CORS accepts only explicitly configured origins. SMTP, portal, and
  Operations link configuration has no hardcoded business fallback.
- Ticket mail accepts a ticket ID, queries the canonical row, verifies the
  recipient allowlist, builds the Operations URL server-side, and only reports
  success after mail delivery.
- Completion mail accepts a canonical campaign/request ID, derives its
  recipient and protected summary from that row, and escapes staff-authored
  delivery notes and links.
- The legacy acceptance viewer is fail-closed. The React viewer requires an
  authenticated user and a row ID.
- Public marketing and acceptance forms call dedicated service-role Edge
  functions instead of writing sensitive tables from the browser.
- Both creates require Cloudflare Turnstile server verification, strict
  action/hostname matching, bounded payloads, strict field allowlists, and
  retry-safe UUIDs.
- Marketing edit links use a deterministic 256-bit HMAC capability. Migration
  `047` hashes existing plaintext values, clears the plaintext column values,
  and adds expiry/revocation fields.
- Acceptance sign-off stores the typed name, optional bounded PNG, and
  server-generated acceptance time in separate fields.
- Migration `043` discovers and removes any `anon`/`PUBLIC` policies on the
  sensitive submission tables, revokes anonymous table privileges, and
  recreates authenticated-only policies.

Remaining blockers:

- Anonymous invalid edit-token and resend attempts need a gateway/IP rate
  limit. The application deliberately does not add a new external rate-limit
  service solely for this release.
- A valid Supabase account is not yet proven to be an authorized staff member.
- Notification state and retries still lack a canonical transactional outbox.
- Native Deno/Supabase local-runtime and staging smoke tests remain unrun
  because those tools and a staging gate are unavailable.
- The pre-migration plaintext compatibility branches and legacy `edit_token`
  column must remain through the observation/rollback window, then be removed
  in a reviewed delayed-cleanup release.

## Phase 6 Local Report

```text
Phase: 6 — Runtime Data and Cache Safety
Status: LOCAL PARTIAL PASS
Data impact: Existing browser and production records preserved
External impact: None
```

- Removed all confirmed fabricated runtime records without clearing storage.
- Existing team, lead, campaign, file, task, meeting, and timeline browser
  records are still loaded.
- Timeline and Lead Generation now wait for hydration before persistence.
  Timeline same-ID conflicts keep the local copy, emit only the conflicting
  ID to the local console, and leave Supabase unchanged.
- Page views no longer upload local calendar, file, or acceptance caches.
- Reviewed operational mutations in Campaigns, Timeline, Lead Generation, File
  Tracker, Marketing Requests, and Acceptance Criteria now require confirmed
  canonical writes. Legacy browser-only records remain visible but cannot be
  silently changed or deleted.
- The sidebar bulk sync was removed because it could replace unsynced local
  records before upload.
- The historical migration still seeds a fake pipeline and five contacts.
  Those rows have not been changed or classified.

Remaining blockers:

- Browser-only operational records may exist on user devices and cannot be
  deleted or made non-authoritative until an approved inventory/import path
  exists.
- Some modules still use browser storage as their primary persistence layer.
- Historical migration files cannot safely bootstrap a new environment:
  version `020` is duplicated, migrations alter tables before creation, one
  policy is recreated, and migration `005` embeds fabricated records.
- Production needs a reconciled baseline for new environments and new
  timestamped forward migrations for the existing project. Historical files
  remain immutable until the remote ledger is verified.

## Required Next Gates

1. Revoke the credential disclosed in chat and configure a replacement through
   a local secret mechanism, or authenticate manually in the dashboard.
2. Verify database backup/PITR, separate Storage recovery, the full migration
   ledger, grants/policies, and aggregate object/row inventories.
3. Configure a production-hostname-restricted Turnstile widget,
   `ALLOWED_ORIGINS`, `TURNSTILE_SECRET_KEY`, `EDIT_TOKEN_SIGNING_SECRET`, and
   the documented Edge/runtime secrets. Add and verify one gateway/IP limit for
   anonymous edit-token and resend attempts.
4. Approve a staging target before applying or testing any schema, policy,
   function, or application deployment.
5. Rehearse the exact Stage A (`VITE_PRIVATE_STORAGE_ENABLED=false`), migrations
   `043`–`051`, database write-switch enable, Stage B (`true`), write-switch
   disable, Stage A rollback, and Stage B reapply sequence in the authoritative
   release-candidate handoff.
6. Preserve the compatibility branches and nullable legacy token column during
   the observation window. Remove them only in a separate reviewed cleanup
   after rollback is no longer required.
7. Prove staff authorization, private Storage, notification reservation, and
   approved secure-runner backfill behavior in staging before those affected
   modules are declared production-ready.
8. Deploy to production only with
   `APPROVE_PRODUCTION_DEPLOYMENT <project-ref> <target>`.
