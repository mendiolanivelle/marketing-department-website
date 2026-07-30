# Marketing Department Portal

Internal marketing department portal built with React, TypeScript, Tailwind CSS, and Supabase.

## Tech Stack

- **React** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS v4** - Utility-first styling
- **React Router** - Client-side routing
- **React Hook Form + Zod** - Form handling and validation
- **Supabase** - Authentication and database
- **Vite** - Build tool

## Prerequisites

- Node.js 22.13.0 (see `.node-version`)
- A Supabase account and project

## Setup

1. Clone the repository:
```bash
git clone https://github.com/mendiolanivelle/marketing-department-website.git
cd marketing-department-website
```

2. Install locked dependencies:
```bash
npm ci
```

3. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Replace the placeholder values with your public Supabase client configuration:
```bash
VITE_SUPABASE_URL=your_actual_supabase_url
VITE_SUPABASE_ANON_KEY=your_actual_supabase_anon_key
VITE_TURNSTILE_SITE_KEY=your_actual_turnstile_site_key
VITE_PRIVATE_STORAGE_ENABLED=false
```

4. Start the development server:
```bash
npm run dev
```

5. Open your browser and navigate to `http://localhost:5173`

## Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Project Settings > API
3. Copy your Project URL and anon/public key
4. Paste them into your `.env` file
5. Follow the controlled migration and staff-claim sequence in
   `docs/RELEASE_CANDIDATE_HANDOFF.md`. Do not point a local setup at production
   or apply the historical migration directory blindly to an existing remote
   project; verify its migration ledger first.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run typecheck` - Check TypeScript without emitting files
- `npm test` - Run server, build-environment, authorization, notification, and backfill tests
- `npm run storage:backfill` - Dry-run the legacy private-file inventory tool; writes require explicit confirmation
- `npm start` - Serve the built application with the production Node server

## Project Structure

```
src/
|-- components/       # Reusable UI components
|-- contexts/         # React context providers
|-- lib/              # Utility libraries (Supabase client)
|-- pages/            # Page components
`-- main.tsx          # Application entry point
```

## AI Agent Context

Generated output, installed dependencies, lockfile churn, logs, and local environment files are excluded from AI indexing in `.aiignore`, `.cursorignore`, `.codexignore`, `.aiderignore`, `.continueignore`, `.windsurfignore`, and `.claudeignore`. This keeps future coding-agent context focused on source files.

Use `AGENTS.md` as the shared context packet for AI models. It contains the project map, token-saving workflow, coding rules, and GitHub push flow. A human-facing website assessment is available in `docs/WEBSITE_ANALYSIS.md`. The authoritative release status and operator sequence are in `docs/RELEASE_CANDIDATE_HANDOFF.md`.

## Features

- **Staff Authorization** - Supabase Auth plus an administrator-controlled staff claim
- **Protected Routes** - Ordinary authenticated accounts cannot access the portal
- **Dashboard** - Central hub with announcements and quick links
- **Operational Workflows** - Campaigns, leads, timeline, calendar, requests, and acceptance
- **Public Forms** - Rate-limit-ready request and acceptance boundaries with Turnstile
- **Private Files** - Signed private Storage access with an explicit staged rollout flag
- **Responsive Design** - Works on desktop, tablet, and mobile

## Deployment

Docker on Coolify is the canonical production path because the application
requires `server/index.mjs`; the static `dist` directory is not a complete
deployment.

Configure Coolify to:

1. Build the repository `Dockerfile`.
2. Pass `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
   `VITE_TURNSTILE_SITE_KEY`, and `VITE_PRIVATE_STORAGE_ENABLED` as Docker
   build arguments. The first three are public browser values; never use a
   service-role or Turnstile secret key.
   - For each target environment, build Stage A with
     `VITE_PRIVATE_STORAGE_ENABLED=false`.
   - Build that environment's Stage B from the same commit and lockfile with
     `VITE_PRIVATE_STORAGE_ENABLED=true`.
   - Staging and production require separate A/B image pairs because every
     `VITE_*` value is compiled into the image. Never promote a staging image
     into production.
   - Use the exact rollout and rollback order in the release-candidate handoff.
   - The database private-write switch starts disabled. Enable it only for
     Stage B; disable it before rollback so already-open Stage B tabs fail
     closed.
3. Set `PUBLIC_SITE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
   `OPENROUTER_API_KEY` as runtime environment variables.
4. Run exactly one application replica while the paid-AI rate limiter remains
   process-local.
5. Expose port `3000` and use `/healthz` for readiness. `/livez` reports only
   process liveness; `/healthz` returns `503` when required runtime
   configuration is missing or invalid.

The container installs from `package-lock.json`, runs as a non-root user, and
contains only the built frontend and Node server. GitHub Actions runs checks
and a build; it does not deploy the application.

## AI-Assisted Pushes

After an AI-assisted change is ready, run:

```bash
npm run ai:push -- "short commit message"
```

This cross-platform Node script runs lint, tests, and build, then stages,
commits, and pushes the current branch to GitHub. For documentation-only
changes, use `--skip-checks` after the message.

## Environment Variables

### Docker build arguments

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Public Supabase project URL compiled into the browser bundle |
| `VITE_SUPABASE_ANON_KEY` | Yes | Publishable Supabase client key compiled into the browser bundle |
| `VITE_TURNSTILE_SITE_KEY` | Yes | Public Cloudflare Turnstile widget key compiled into the browser bundle |
| `VITE_PRIVATE_STORAGE_ENABLED` | Yes | `false` for the migration-safe Stage A artifact; `true` for Stage B |

All `VITE_` values are compile-time settings. Changing the private Storage
flag or target environment requires a new immutable build; it is not a runtime
toggle. A full release records four digests: staging A/B and production A/B,
all from the same reviewed commit and lockfile.

### Coolify runtime

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | HTTP port; defaults to `3000` |
| `PUBLIC_SITE_URL` | Yes | Public HTTPS origin used for server-generated callback URLs |
| `SUPABASE_URL` | Yes | Supabase project URL used by the Node server |
| `SUPABASE_ANON_KEY` | Yes | Publishable Supabase key used by the Node server |
| `OPENROUTER_API_KEY` | Yes | Private server-only credential for calling-card extraction |
| `OPENROUTER_MODEL` | No | Model identifier |
| `OPENROUTER_SITE_URL` | No | OpenRouter attribution URL; defaults to `PUBLIC_SITE_URL` |
| `OPENROUTER_APP_NAME` | No | OpenRouter attribution name |
| `OPENROUTER_BASE_URL` | No | OpenRouter API base URL |
| `OPENROUTER_TIMEOUT_MS` | No | Upstream request timeout |

`OPENROUTER_KEY` and `OPENROUTER_MODEL_NAME` are supported legacy aliases;
new deployments should use the canonical names above.

### Supabase Edge Function secrets

Configure these in Supabase, not in Coolify or any `VITE_` variable:

| Variable | Used by |
|----------|---------|
| `SUPABASE_URL` | Supabase runtime |
| `SUPABASE_ANON_KEY` | User-session validation for authenticated functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side database access |
| `SUPABASE_SECRET_KEYS` | Server-side key rotation/validation |
| `PUBLIC_SITE_URL` | Canonical HTTPS portal origin used in trusted links |
| `OPERATIONS_SITE_URL` | Canonical HTTPS Operations origin used in ticket links |
| `ALLOWED_ORIGINS` | Required comma-separated browser origins allowed by Edge Function CORS |
| `TURNSTILE_SECRET_KEY` | Private Cloudflare Turnstile key used only for server-side form verification |
| `EDIT_TOKEN_SIGNING_SECRET` | Random private value of at least 32 characters used to derive edit capabilities |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `FROM_EMAIL` | Email functions |

Configure the Turnstile widget for the production portal hostname and use
different real widgets for staging and production. Cloudflare test keys are
rejected by the production build and Edge boundary. Email and public form
functions fail closed when required secrets are missing or invalid.

### Deploying Supabase Edge Functions

Edge Functions are deployed separately from the Coolify container through the
manual **Deploy Supabase Edge Functions** GitHub Actions workflow. Protect the
GitHub `staging` and `production` environments independently and give each one
its own verified target secrets:

| Secret | Purpose |
|--------|---------|
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI authentication; never expose it to browser code |
| `SUPABASE_PROJECT_REF` | Exact target project reference |

Select the exact protected environment and type its matching project ref. The
production path additionally requires the default branch and the checked-in
production ref. Run it only after the matching staging/production deployment
gate. It deploys the reviewed functions with their checked-in JWT settings; it
does not apply database migrations or deploy the Coolify application.

`WATCHED_LEADS_DIR` is optional and applies only to the local
`npm run watch:leads` process.

## License

Internal use only.
