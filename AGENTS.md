# Project Rules for OpenCode

This is a React/Vite website project.

## Token Control Rules

Do not scan the whole repository unless explicitly asked.

Do not read:
- node_modules
- dist
- build
- .git
- .vite
- .next
- coverage
- logs
- zip files
- csv files
- lock files

Before editing, identify the smallest set of files needed.

Prefer editing only files inside:
- src/
- public/
- package.json
- vite.config.*
- index.html

Keep terminal output short.

Do not rewrite full files unless necessary.

- Read `docs/AI_WORKFLOW_GUIDELINES.md` for the current website analysis, source map, token-saving prompt template, and handoff format.
- Keep future AI prompts short by referencing `AGENTS.md` and `docs/AI_WORKFLOW_GUIDELINES.md` instead of pasting long repeated instructions.
- For every task, first explain which files you will inspect, then inspect only those files.

## Git And Push Preference

After making repository changes, commit and push the completed work to GitHub by default, including small or minor changes. Run the relevant validation commands before committing when code or schema behavior changes. Do not commit secrets, local environment files, dependency folders, build output, or other ignored/generated files.

## Directory Conventions

- `src/App.jsx`: current application shell, screens, forms, local fallback data, and mapping helpers.
- `src/main.jsx`: React entry point.
- `src/index.css`: Tailwind import and global CSS.
- `src/lib/`: client-side integration helpers such as Supabase client setup.
- `src/assets/`: static assets imported by the app.
- `supabase/`: SQL schema and future migration files.
- `docs/`: product, architecture, roadmap, security, and privacy documentation.

For future Next.js work, use `app/` for routes, `components/` for shared UI, `lib/` for framework-agnostic utilities, `server/` for server-only modules, and `supabase/migrations/` for ordered migrations.

## Naming Conventions

- React components use PascalCase.
- Hooks and event handlers use camelCase, such as `handleSubmit`.
- Supabase tables and columns use snake_case.
- Date-only fields use names ending in `_date` in SQL and `Date` in JavaScript or TypeScript.
- Timestamp fields use names ending in `_at`.
- User-owned tables must include `user_id` unless a deliberate shared-family ownership model is documented.

## Date-Handling Rules

- Store estimated due dates and event dates as date-only values, not timestamps.
- Store reminder timestamps in UTC and store the user's timezone separately.
- Avoid relying on browser-local parsing of `YYYY-MM-DD` strings. Parse date-only values deliberately.
- The target stack decision is `date-fns` and `date-fns-tz` for pregnancy calculations and timezone handling once dependencies are introduced in a future task.
- Gestational age from estimated due date is calculated from an estimated pregnancy start date of due date minus 280 days. Display whole weeks and days, such as `Week 12 day 3`.

## Database And Migration Rules

- Every table containing user data must have Row Level Security enabled.
- Never add a user-data table without select, insert, update, and delete policies appropriate to the ownership model.
- Never expose Supabase secret keys or service-role keys to browser code. Browser code may only use publishable or anon keys intended for clients.
- Prefer ordered migrations under `supabase/migrations/` for future schema changes. The current repository also has a legacy `supabase/schema.sql` baseline; keep it coherent until it is retired.
- Treat private files as private Supabase Storage objects. Public buckets require an explicit product and security review.

## Accessibility Expectations

- All interactive controls must be reachable and operable by keyboard.
- Provide visible focus states.
- Do not rely on color alone to convey status.
- The pregnancy timeline must have a chronological list alternative for screen readers, keyboard users, and narrow screens.
- Urgent-help navigation must remain easy to reach on desktop and mobile.
- Test responsive behavior before completing UI work.

## Privacy And Security Rules

- Treat pregnancy data, reminders, appointments, and personal health information as confidential user data.
- Never log, store, or transmit user health data to third-party analytics, marketing, or advertising services beyond what is strictly required for app functionality.
- Do not store Supabase secrets, API keys, or other private credentials in repository code.
- Production authentication must use a hardened authentication provider with MFA support (planned: Supabase Auth with email/password and optional third-party OAuth).
- All cookies and local storage must be scoped appropriately; do not store sensitive data in non-secure storage mechanisms.

## Medical Safety Rules

- Do not invent medical advice.
- Do not diagnose symptoms, recommend treatment, triage risk, or replace a doctor, midwife, emergency service, or local clinical guidance.
- The app must never contain an AI symptom checker.
- Medical or clinical content must include source, region, review date, and publication status before it is published.
- Urgent-help content should direct users to local emergency services and their care team for urgent symptoms or safety concerns.