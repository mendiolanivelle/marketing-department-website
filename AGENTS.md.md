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

For every task, first explain which files you will inspect, then inspect only those files.