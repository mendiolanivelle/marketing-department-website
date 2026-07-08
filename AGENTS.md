# AI Agent Guidelines

Use this as the compact context packet for this repo. Do not paste large files into prompts unless the task truly needs them.

## Project

- Internal marketing portal.
- Stack: Vite, React, TypeScript, Tailwind CSS v4, React Router, Supabase.
- Entry: `src/main.tsx`, `src/App.tsx`, `src/index.css`.
- Auth/theme: `src/contexts/AuthContext.tsx`, `src/contexts/ThemeContext.tsx`.
- Supabase client: `src/lib/supabase.ts`.
- Migrations/functions: `supabase/`.

## Token Rules

- Start with `rg --files` and targeted `rg -n` searches.
- Avoid whole-file reads for the large pages: `LeadGeneration.tsx`, `Messaging.tsx`, `Timeline.tsx`, `AcceptanceCriteria.tsx`, `Calendar.tsx`, `Home.tsx`.
- Ignore `node_modules`, `dist`, `.git`, logs, env files, lockfile churn, and generated output.
- Prefer one-file fixes. Extract only when it removes real duplication now.

## Coding Rules

- Reuse existing page patterns and CSS variables before adding helpers.
- No new dependency unless existing code or browser/Node APIs cannot do it.
- Keep Supabase schema/query changes together.
- Do not store secrets in browser code.
- Run `npm run lint` and `npm run build` before pushing.

## Push

Use:

```bash
npm run ai:push -- "short commit message"
```

This runs checks, commits, and pushes the current branch.
