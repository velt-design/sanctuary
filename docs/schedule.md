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

Current local gate signal from 2026-07-18:

```bash
npm run test:portal:schedule
npm run schedule:bundle-budget
```

The schedule test coverage passes, including the readiness route, V2 API/RPC command routes, Board/Gantt/Site Visits clients, action dialogs, and legacy fallback isolation. From the same fresh production build, the general bundle gate passes at 621.9 KiB initial raw, 176.1 KiB initial gzip, 349.1 KiB lazy raw, and 80.6 KiB lazy gzip without changing the original Schedule ceilings.

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
