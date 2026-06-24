# Website Analysis

## Current Shape

This is an authenticated internal marketing portal built with Vite, React, TypeScript, Tailwind CSS v4, React Router hash routing, and Supabase. The app is organized around page-level features rather than many shared components, with `src/App.tsx` providing lazy-loaded routes behind `ProtectedRoute`.

Main user areas:

- Dashboard with announcements, local tasks, quick links, and lead pipeline stats.
- Calendar management backed by Supabase.
- Lead generation CSV/spreadsheet workflow backed by `lead_files` and `lead_rows`.
- Timeline/kanban workflow backed by `timeline_tables` and `timeline_leads`.
- Messaging and email templates backed by `message_templates`, plus local outreach state.
- Department information pages for about, services, team, and contact/request intake.

## Strengths

- The app has a clear internal-portal purpose and a practical feature set for marketing operations.
- Supabase is already integrated for auth, database-backed templates, calendar items, lead files, and timeline data.
- Routes are lazy-loaded, which keeps initial app loading lighter.
- Theme variables in `src/index.css` give the project a single brand/color source of truth.
- Multiple AI ignore files already exclude dependencies, generated output, logs, env files, and lockfile churn from model indexing.
- The README documents setup, tech stack, environment variables, and deployment expectations.

## Key Risks

- Several pages are large monoliths. `Timeline.tsx`, `LeadGeneration.tsx`, `Messaging.tsx`, `Home.tsx`, and `Calendar.tsx` are expensive for AI models to read and harder for humans to maintain.
- Some features duplicate concepts. `Messaging.tsx`, `ReachOut.tsx`, and `MessageTemplates.tsx` overlap around outreach/templates.
- Some production-like data is still seeded with placeholder companies, emails, and dates. Confirm what should remain demo content.
- Authorization is broad in current RLS policies: authenticated users can generally view, create, update, and delete shared records.
- SOW-stage gating is partially enforced in frontend code for one email address. Security-sensitive gates should live in database policies or server-side logic.
- The current ESLint config only applies to JavaScript/JSX files, so TypeScript quality depends mostly on `npm run build`.
- Several UI flows use `alert` and `confirm`, which are fast but inconsistent with the rest of the polished portal UI.

## Highest-Value Improvements

- Split the largest pages into feature components and typed hooks, starting with `Timeline.tsx` and `LeadGeneration.tsx`.
- Consolidate duplicated outreach/template pages into one canonical flow or shared components.
- Add stricter TypeScript and lint coverage for `.ts` and `.tsx`.
- Move role/permission rules from frontend checks into Supabase RLS, RPCs, or Edge Functions.
- Replace browser alerts/confirms with reusable modal/toast components.
- Add lightweight smoke tests for auth routing and the highest-risk Supabase workflows.
- Add a seed-data policy so demo records do not accidentally look like real operational data.

## AI Collaboration Notes

The repo is a good candidate for multi-model work if each model receives a narrow task and only the relevant files. Use `AGENTS.md` as the model-facing context packet, then add only the specific component, migration, or route involved in the change.
