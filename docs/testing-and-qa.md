# Testing And QA

Use the smallest test that covers the risk. Run broader suites when touching shared workflow, portal shell, scheduling, local-first, Supabase access, or public lead/quote flows.

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

Focused guards:

```bash
npm run docs:guard
npm run text:mojibake
npm run cache:forbid
npm run brand:forbid
npm run schedule:bundle-budget
```

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
npm run text:mojibake
```

`npm run docs:guard` checks required agent-doc links, startup-path docs, stale placeholders, ASCII docs, and superseded redirect shape.

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

- Portal Quality runs repository typecheck, portal Vitest, portal build, authenticated smoke, and portal performance timing.
- Portal Quality runs `npm run docs:guard` before portal app checks.
- Lighthouse Guardrails run mobile and desktop Lighthouse profiles.
- Governance Monthly runs marketing tests, production dependency audit, and Lighthouse.
