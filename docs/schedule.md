# Schedule

Schedule V2 owns install planning and site visits in the staff portal.

## Ownership

- Page route: `/staff/schedule`.
- Client code: `apps/portal/app/staff/schedule`.
- Query helpers: `apps/portal/lib/queries/schedule.ts`.
- Server schedule helpers: `apps/portal/lib/scheduling`.
- Legacy and V2 repos: `apps/portal/lib/repo/scheduleRepo.ts` and `apps/portal/lib/repo/scheduleV2Repo.ts`.
- Staff APIs: `apps/portal/app/api/staff/v1/schedule`.
- Readiness route: `GET /api/staff/v1/schedule/readiness`.
- Schema ownership map: `docs/supabase-schema-map.md`.

## Views

Schedule has three user-facing views:

- Board: crew lanes, unscheduled jobs, drag/drop assignment and reorder.
- Gantt: timeline by crew with bars, range controls, and collision/conflict visibility.
- Site Visits: site visit scheduling and salesperson calendar workflow.

## V2 Write Model

Schedule mutations go through staff API routes and Schedule V2 RPC commands. Important command areas include:

- Assign/unassign jobs.
- Reorder queue.
- Pin/unpin and reschedule.
- Set duration and days remaining.
- Mark in progress or done.
- Create/update/delete downtime.
- Ack client updates.

Do not bypass these with direct browser writes.

## Readiness

Schedule deploys are not ready until:

- V2 read paths load.
- `GET /api/staff/v1/schedule/readiness` returns `200`.

If readiness fails, check migrations and RPC availability before debugging UI state.

## Legacy Fallback

The schedule client has an explicit legacy fallback boundary. It exists for schema-not-ready recovery and older data paths. Keep legacy-only loading and mutation code isolated from the normal V2 client path.

When touching fallback:

- Keep normal `ScheduleClient` free of legacy repo imports.
- Keep `ScheduleLegacyFallbackClient` legacy-specific.
- Preserve tests that guard dependency direction.
- Do not remove fallback unless production readiness and telemetry prove it is unused.

## UI Foundation Contract

Board, Gantt, Site Visits, and the legacy fallback render inside the full-width compact foundation canvas without moving read or mutation ownership. V2 load failures, scheduling issues, Site Visit stale/error state, and action failures use shared accessible feedback. Schedule action dialogs use the shared focus trap and return focus to their trigger; active V2 locked-job unscheduling and downtime deletion use the extracted confirmation owner. Site Visit unscheduling uses a two-step in-modal confirmation and states explicitly that project/contact data is retained.

At narrow widths the Unscheduled queue stacks above one horizontally focused crew lane, and Site Visits stack the waiting queue above a horizontally focused day calendar. Route-level document overflow is not allowed; the Board, Gantt, and calendar keep their specialist internal scroll owners. Presentation changes must not bypass Schedule V2 staff API/RPC commands, change optimistic rollback, or merge the explicit legacy fallback into the normal client.

## Performance Posture

Schedule is one of the heaviest portal surfaces. Watch:

- Client bundle size and lazy boundaries.
- Duplicate first-load requests.
- Board payload size.
- Gantt data path duplication.
- CSS coupling between views.
- Drag/drop responsiveness.

Action dialogs are part of the main Schedule client bundle so staff get immediate modal feedback. Board, Gantt, legacy fallback, diagnostics, and Site Visits keep their existing lazy/view boundaries.

Board, Gantt, and Site Visits route changes use the shared non-blocking portal progress bar and mark only the selected view button busy. They must not replace the usable Schedule surface with the full-page loading overlay; full-page loading remains a cold-route/auth boundary only.

Use:

```bash
npm run schedule:bundle-budget
npm run test:portal:performance
```

## Verification

Current local gate signal from 2026-07-21:

```bash
npm run test:portal:schedule
npm run schedule:bundle-budget
npx playwright test playwright/portal.schedule-tasks-ui.spec.ts --project=portal-chromium --no-deps
```

The focused UI coverage includes 58 Schedule, Site Visit modal, and project-task tests. The authenticated non-mutating browser review covers Board at 1440/1280/1024/768/390, Gantt, Site Visits, action/create dialogs, project Tasks, 200% zoom, touch targets, focus return, reduced motion, document overflow, and browser/runtime errors. Record fresh bundle figures from `npm run schedule:bundle-budget`; do not raise the existing ceilings to accommodate presentation work.

Focused tests:

```bash
npm run test:portal -- apps/portal/app/staff/schedule
npm run test:portal -- apps/portal/lib/scheduling
npm run test:portal -- apps/portal/app/api/staff/v1/schedule
```

Manual Board checks:

- Assign a job to a crew.
- Reorder jobs within a crew.
- Move a job between crews.
- Unschedule a job.
- Refresh and confirm persistence.

Manual Gantt checks:

- Week headers are Monday-aligned.
- Weekend shading aligns to Saturday/Sunday.
- Bars align to correct dates.
- Crew collapse and range changes work.

Manual Site Visits checks:

- Site visit list loads without Board/Gantt data dependency.
- Booking, confirming, rescheduling, and unscheduling route through staff APIs.
