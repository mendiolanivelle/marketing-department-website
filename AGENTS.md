# AI Agent Guidelines

Use this file as the compact source of truth before asking another model to work on the repo. Prefer linking to this file instead of pasting large source files into prompts.

## Project Snapshot

- App: internal marketing department portal.
- Stack: Vite, React 19, TypeScript, Tailwind CSS v4, React Router hash routing, React Hook Form, Zod, Supabase.
- Entry points: `src/main.tsx`, `src/App.tsx`, `src/index.css`.
- Auth and themes: `src/contexts/AuthContext.tsx`, `src/contexts/ThemeContext.tsx`.
- Supabase client: `src/lib/supabase.ts`.
- Database migrations: `supabase/migrations/`.
- Supabase Edge Function: `supabase/functions/sync-sow-timeline-lead/index.ts`.

## Page Ownership Map

- `src/pages/Home.tsx`: dashboard, announcements, tasks, lead pipeline summary.
- `src/pages/Login.tsx`: Supabase email/password login.
- `src/pages/Calendar.tsx`: calendar items and notes.
- `src/pages/LeadGeneration.tsx`: CSV/spreadsheet lead files, row editing, duplicates.
- `src/pages/Timeline.tsx`: kanban-style timeline tables/leads, SOW gating, email metadata.
- `src/pages/Messaging.tsx`: outreach leads plus message template management.
- `src/pages/MessageTemplates.tsx`: standalone message template management; check before duplicating template logic.
- `src/pages/About.tsx`, `Services.tsx`, `Team.tsx`, `Contact.tsx`: informational and request pages.
- `src/components/Sidebar.tsx`: navigation, profile/avatar UI, sign-out.
- `src/components/ProtectedRoute.tsx`: auth gate.

## Token-Saving Workflow

- Start with `rg --files`, `rg -n "term" src supabase`, and targeted file snippets. Do not paste full large files unless the task truly spans the whole file.
- The largest files are `Timeline.tsx`, `LeadGeneration.tsx`, `Messaging.tsx`, `Home.tsx`, and `Calendar.tsx`; search inside them by function, state name, table name, or visible UI text.
- Do not include `package-lock.json`, `dist`, logs, `.env`, or generated output in AI context unless dependency changes are the task.
- When handing off between models, use this format:
  - Goal:
  - Files likely touched:
  - Relevant functions/state:
  - Supabase tables/migrations:
  - Tests/checks already run:
  - Open risks:
- Prefer small, file-scoped prompts such as "modify `src/pages/Calendar.tsx` save behavior" over broad prompts like "improve the website".

## Coding Rules

- Follow the existing route and page structure in `src/App.tsx`.
- Keep visual styling aligned with `src/index.css` variables: `--bg-*`, `--text-*`, `--border-*`, `--accent`, and `--btn-*`.
- Use Tailwind utility classes for layout, spacing, and responsiveness; use CSS variables for brand colors and theme-aware values.
- Do not introduce a new UI library without an explicit decision.
- Keep Supabase table names aligned with migrations. If a schema changes, update the related migration and all page queries in the same change.
- Avoid broad rewrites of large page files. Extract helpers/components only when it reduces repeated logic or makes a risky change easier to verify.
- Replace `any` with local interfaces when touching nearby code.
- Avoid adding new `alert` or `confirm` flows; prefer existing modal patterns when the change involves user-facing error or confirmation UI.

## Verification

- Run `npm run build` before pushing meaningful TypeScript or UI changes.
- Run `npm run lint` when JS config or JavaScript files change. Note: the current ESLint config only targets `**/*.{js,jsx}`.
- For Supabase changes, inspect the affected migration and the consuming page query together.
- For route/UI changes, verify the affected route under hash routing, for example `/#/calendar`.

## GitHub Push Workflow

- Use `npm run ai:push -- "short commit message"` after a change is ready.
- The push helper runs checks, stages changes, commits, and pushes the current branch to GitHub.
- Use `npm run ai:push -- "short commit message" -SkipChecks` only for documentation-only changes or when checks are already known.
- Do not commit secrets, `.env`, local build output, or generated logs.
