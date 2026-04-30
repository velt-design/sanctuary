# Testing And QA

Use the smallest test that covers the risk. Run broader suites when touching shared workflow, portal shell, scheduling, local-first, Supabase access, or public lead/quote flows.

## Common Commands

```bash
npm run test
npm run test:marketing
npm run test:portal
npm run build:marketing
npm run build:portal
npm run lint
```

Focused guards:

```bash
npm run text:mojibake
npm run cache:forbid
npm run brand:forbid
npm run schedule:bundle-budget
```

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

The drawing smoke uses:

```text
/staff/projects/fixture-roof/design-workbench?fixture=mono-standard
```

It opens the standard Mono workbench fixture, enters Model Space Plan, switches the house footprint mode to Draw outline, checks diagnostics and pan behavior, creates a three-point draft, and stops before polygon commit.

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

## CI

- Portal Quality runs portal Vitest, portal build, authenticated smoke, and portal performance timing.
- Lighthouse Guardrails run mobile and desktop Lighthouse profiles.
- Governance Monthly runs marketing tests, production dependency audit, and Lighthouse.
