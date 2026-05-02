# Testing And QA

Use the smallest test that covers the risk. Run broader suites when touching shared workflow, portal shell, scheduling, local-first, Supabase access, or public lead/quote flows.

## Read First

- Use `## Common Commands` for routine repo, portal, focused, and operational scripts.
- Use `## Docs-Only Checks` when changing docs, agent guidance, or docs tooling.
- Use `## Portal Browser Tests` and `## Drawing Fixture Route` for Playwright/auth/drawing smoke expectations.
- Use `## Schedule QA Gate` for Schedule V2 readiness and focused schedule checks.
- Use `## CI` to confirm which workflows enforce or report each gate.

## Canonical Command Source

Keep general repo command lists here. Other docs should link to this doc instead of duplicating broad command blocks. Feature docs may still list focused commands for their own verification gates.

The root `npm run dev`, `build`, and `start` scripts only print the app-specific command to use.

## Common Commands

```bash
npm run dev:marketing
npm run dev:portal
npm run test
npm run test:marketing
npm run test:portal
npm run build:marketing
npm run build:portal
npm run typecheck
npm run lint
```

Portal readiness sweeps:

```bash
npm run portal:doctor:quick
npm run portal:doctor:quick:log
npm run portal:doctor
npm run portal:doctor:log
```

`portal:doctor:quick` runs docs guard, mojibake check, typecheck, lint, and portal Vitest. `portal:doctor` adds portal build, schedule bundle budget, drawing browser smoke, authenticated smoke, route performance, and production security audit.

Use the `:log` variants when running noisy gates through an AI agent or chat tool. They run the same root npm scripts, write full stdout/stderr to an OS temp log, and print only the command, log path, duration, exit code, and a compact pass/fail summary. On failure they also print the last 120 log lines.

Focused portal commands:

```bash
npm run test:portal:api
npm run test:portal:schedule
npm run test:portal:workbench
npm run test:portal:projects
npm run test:portal:quotes
npm run test:portal:shell
npm run test:portal:log
```

Use focused commands while iterating in one domain, then run `npm run portal:doctor:quick` before handing work back. Use `npm run portal:doctor` for a broad local pre-merge readiness sweep when Playwright auth/env and audit expectations are ready.

Focused guards:

```bash
npm run docs:guard
npm run docs:impact
npm run docs:navigation
npm run docs:readiness
npm run files:report
npm run files:changed
npm run root:compat
npm run root:compat:changed
npm run browser:supabase
npm run browser:supabase:changed
npm run service-role:report
npm run service-role:changed
npm run text:mojibake
npm run packages:guard
npm run cache:forbid
npm run brand:forbid
npm run schedule:bundle-budget
```

`npm run packages:guard` checks that app imports of local `@sp/*` workspace packages are declared in the app manifest and listed in Next `transpilePackages`. `npm run lint` includes this guard after `docs:guard`.

`npm run files:report` is an advisory large-file ownership report. It highlights warning and critical files that should follow `docs/file-decomposition-and-ownership.md` before major feature expansion. `npm run files:changed` narrows that report to touched code files for agent handoffs, including line deltas from HEAD when available. `npm run files:changed:strict` exists for local experiments and later enforcement only. These are not part of `npm run lint` yet.

`npm run root:compat` is an advisory report for root-level compatibility paths such as `components`, `lib`, `data`, `src`, and `styles`. `npm run root:compat:changed` narrows the report to touched root compatibility files for handoffs. These are not part of `npm run lint` yet.

`npm run browser:supabase` is a broad advisory inventory of browser-facing Supabase access. `npm run browser:supabase:changed` narrows the report to touched files for handoffs. The narrower hard guard remains `npm run cache:forbid`, which is included in `npm run lint`.

`npm run service-role:report` is a broad advisory inventory of service-role Supabase access across portal, marketing, root compatibility, and operational scripts. `npm run service-role:changed` narrows the report to touched files for handoffs. The narrower portal-only hard guard remains `apps/portal/lib/supabaseClient.boundaries.test.ts`.

Operational commands:

```bash
npm run portal:invite
npm run running-jobs:legacy-import
npm run costing:rebaseline-overrides
npm run geometry:generate-profile-assets
npm run emails:preview
```

## Docs-Only Checks

For docs-only changes, run these from the repo root:

```bash
npm run docs:guard
npm run docs:impact
npm run docs:navigation
npm run docs:readiness
npm run text:mojibake
```

`npm run docs:guard` checks required agent-doc links, startup-path docs, documented npm scripts, local Markdown link targets and anchors, decision-log structure, change-routing owner paths, portal readiness metadata, stale placeholders, ASCII docs, and superseded redirect shape.

`npm run docs:impact` is an advisory check that maps changed behavior files through `docs/change-routing.md` and suggests owner docs when matching docs were not changed. It exits nonzero only when `DOCS_IMPACT_STRICT=1`.

When `docs:impact` prints an advisory, update the suggested owner doc if the code change affects behavior, data flow, source-of-truth boundaries, test strategy, or known risks. Leaving docs unchanged is acceptable only when the change is mechanical, test-only, or behavior-neutral; note that decision in the handoff. Keep `docs:impact` advisory unless intentionally running `DOCS_IMPACT_STRICT=1` locally.

`npm run docs:navigation` is an advisory report for dense docs. It highlights long docs that may need a routing, index, or "read first" section.

`npm run docs:readiness` is an advisory report for `docs/portal-production-readiness.md`. It summarizes tracker age, status counts, at-risk rows, and unchecked checklist counts, but it does not verify readiness by itself.

## Portal Browser Tests

Required env:

- `PORTAL_TEST_EMAIL`
- `PORTAL_TEST_PASSWORD`

Optional env:

- `PORTAL_BASE_URL`, defaults to `http://127.0.0.1:3001` when the portal harness starts locally.
- `PORTAL_DRAWING_URL`, points the drawing smoke at a known project/design page.

Commands:

```bash
npm run test:portal:browser:auth
npm run test:portal:browser
npm run test:portal:browser:headed
npm run test:portal:smoke
npm run test:portal:performance
```

The auth setup saves local state to `playwright/.auth/portal-staff.json`, which is ignored.

## Drawing Fixture Route

The drawing browser gate uses the hidden fixture workbench route:

```text
/staff/projects/fixture-roof/design-workbench?fixture=mono-standard
```

Fixture mode is read-only. It opens the standard Mono workbench fixture, enters Model Space Plan, verifies viewport diagnostics and gesture state, captures a nonblank plan screenshot, and confirms no page runtime errors. The authenticated browser suite also opens the 3D fixture route and verifies finite, nonblank solved geometry from the same workbench fixture path. For plan/3D accuracy, the browser gate checks the screenshot-style hipped fixture's Model Space Plan top-projection parity diagnostics before switching to 3D Top view and asserting the same screen-axis convention.

`npm run test:portal:browser` uses the no-auth `portal-fixture` Playwright project so fixture parity can run without project data or staff credentials. Run `npm run test:portal:browser:auth` first when you need the auth-backed `portal-chromium` project or project-list discovery smoke.

When Playwright starts the portal dev server itself, it enables the geometry workbench fixture flags for this no-auth fixture gate. If `PORTAL_BASE_URL` points at an already-running portal server, that server must be started with the same fixture flags.

## Schedule QA Gate

Before shipping schedule changes:

1. Confirm migrations are applied through current Schedule V2 command/repair migrations.
2. Confirm `GET /api/staff/v1/schedule/readiness` returns `200`.
3. Run relevant schedule unit and route tests.
4. Manually check Board, Gantt, and Site Visits if UI behavior changed.

Minimum targeted schedule tests:

```bash
npx vitest run lib/scheduling/workingDays.test.ts lib/scheduling/recompute.test.ts apps/portal/lib/scheduling/workingDays.test.ts apps/portal/lib/scheduling/recompute.test.ts
```

## Manual QA Checklist Seeds

Portal shell:

- Navigate between staff pages and confirm header back/forward controls enable, disable, and move through history correctly.

Projects:

- Open `/staff/projects` across desktop and mobile widths.
- Confirm filters wrap without clipped text.
- Toggle follow-up due and confirm the list updates without layout jitter.

Schedule Board:

- Assign an unscheduled job to a crew.
- Reorder jobs within a crew.
- Move a job between crews.
- Unschedule a job and refresh.
- Confirm crew lanes stay fixed-width and horizontally scroll.

Schedule Gantt:

- Confirm week headers are Monday-aligned.
- Confirm weekend shading is Saturday/Sunday.
- Drag or resize bars only through supported interactions.
- Toggle crew collapse and range options.

## Portal Production Readiness

Use `docs/portal-production-readiness.md` as the active readiness tracker for current status, blockers, highest-leverage tasks, and parallel lanes.

This doc remains the canonical command catalog. When readiness work changes command expectations, update this doc; when readiness status changes, update `docs/portal-production-readiness.md`.

## CI

- Portal Quality runs docs guard, repository typecheck, lint, portal Vitest, portal build, schedule bundle budget, fixture browser smoke, authenticated smoke, and portal performance timing.
- Docs Health runs weekly and on demand, with blocking docs guard and mojibake checks plus advisory docs impact, navigation, and readiness reports.
- Lighthouse Guardrails run mobile and desktop Lighthouse profiles.
- Governance Monthly runs marketing tests, production dependency audit, and Lighthouse.
