# Sanctuary

Sanctuary is a private npm workspace for the Sanctuary Pergolas marketing site, staff portal, and shared business packages.

## Workspace Map

- `apps/marketing`: public Next.js marketing site on port `3000`.
- `apps/portal`: staff portal Next.js app on port `3001`.
- `packages/costing`: canonical costing engine and pricing config.
- `packages/geometry`: canonical pergola and house geometry solvers.
- `packages/quote-format`: shared quote formatting helpers.
- `packages/theme`: shared theme tokens.
- `supabase`: baseline SQL and ordered migrations.
- `scripts`: maintenance, import, optimization, invite, and audit scripts.
- `playwright`: authenticated portal browser and performance smoke tests.

## Common Commands

```bash
npm run dev:marketing
npm run dev:portal
npm run build:marketing
npm run build:portal
npm run test
npm run test:marketing
npm run test:portal
npm run test:portal:smoke
npm run test:portal:performance
npm run lint
```

The root `npm run dev`, `build`, and `start` commands only print the app-specific command to use.

## Environment

At minimum, local portal and marketing work need:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` for server-owned admin tooling, imports, and protected write flows.

Email, tracking, public URL, and Playwright variables are documented in `docs/environment-auth-supabase.md` and `docs/testing-and-qa.md`.

## Docs

Start with `AGENTS.md` for coding-agent guidance, then `docs/README.md` for the canonical docs index.

The docs are intentionally current-state references. Historical implementation plans and stale specs should not be reintroduced unless they are rewritten as current references or explicit decision records.
