# Sanctuary

Sanctuary is a private npm workspace for the Sanctuary Pergolas marketing site, staff portal, dedicated background worker, and shared business packages.

## Workspace Map

- `apps/marketing`: public Next.js marketing site on port `3000`.
- `apps/portal`: staff portal Next.js app on port `3001`.
- `apps/worker`: long-running Node 22 background worker with a private health endpoint; through JOB-03 it defaults to dark mode and has no enabled commercial workflow handlers.
- `packages/costing`: canonical costing engine and pricing config.
- `packages/email-provider`: canonical Resend transport, frozen-request hashing, idempotency, timeout, and webhook-verification contracts.
- `packages/geometry`: canonical pergola and house geometry solvers.
- `packages/jobs`: canonical durable background-job kinds, safe contracts, retry/rollout policy, and state/effect transitions.
- `packages/quote-format`: shared quote formatting helpers.
- `packages/theme`: shared theme tokens.
- `supabase`: baseline SQL and ordered migrations.
- `scripts`: maintenance, import, optimization, invite, and audit scripts.
- `playwright`: authenticated portal browser and performance smoke tests.
- `.github`: CI workflows for portal quality, Background Jobs contracts, Lighthouse, and governance.

Other root-level directories are active repo territory:

- `lib`: shared/root legacy application helpers and tests still referenced by current suites.
- `components`: shared/root UI and marketing/portal-era components.
- `data`, `public`, `src`, `styles`, `test`: shared content, assets, compatibility entrypoints, styling, and test support.
- Root config files such as `package.json`, `tsconfig.json`, `vitest.config.ts`, and `playwright.config.ts` define workspace behavior.

Inspect existing root-level paths before assuming ownership. Do not duplicate app or package logic if a root-level helper already participates in tests or shared behavior.

## Common Commands

Use `docs/testing-and-qa.md` as the canonical command source. The root `npm run dev`, `build`, and `start` commands only print the app-specific command to use.

## Environment

At minimum, local portal and marketing work need:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` for server-owned admin tooling, imports, and protected write flows.

Email, tracking, public URL, and Playwright variables are documented in `docs/environment-auth-supabase.md` and `docs/testing-and-qa.md`.

The worker uses `SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY`, never browser-prefixed credentials. Its complete fail-closed environment contract, modes, and local commands live in `apps/worker/README.md`.

## Docs

Start with `AGENTS.md` for coding-agent guidance, then `docs/README.md` for the canonical docs index.

The docs are intentionally current-state references plus active guardrails. Historical implementation plans and stale specs should not be reintroduced unless they are rewritten as current references, active operating rules, or explicit decision records.
