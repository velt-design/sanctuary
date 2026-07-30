# Schedule

Schedule V2 owns install planning. Its Site Visits capability is retained but hidden from normal staff navigation.

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

Schedule has two normal staff views:

- Board: crew lanes, unscheduled jobs, drag/drop assignment and reorder.
- Gantt: timeline by crew with bars, range controls, and collision/conflict visibility.

The existing Site Visits route/data owner remains directly addressable as dormant compatibility code but is not shown in the Schedule tabs or portal navigation. Project work items do not link to it. Until reactivation is approved, staff may record the bounded manual `SITE_VISIT_COMPLETED` confirmation; that fact does not create work, mutate Schedule, or advance pipeline stage.

## V2 Write Model

Schedule mutations go through staff API routes and Schedule V2 RPC commands. Important command areas include:

- Assign/unassign jobs.
- Reorder queue.
- Pin/unpin and reschedule.
- Set duration and days remaining.
- Adjust a pinned job's start and duration atomically.
- Mark in progress or done.
- Create/update/delete downtime.
- Ack client updates.

Do not bypass these with direct browser writes.

### Mutation trust contract

The V2 client previews a mutation with `force: false`. It asks for confirmation
only when the server reports that other scheduled jobs will move, and the
dialog identifies those projects and their before/after dates. After approval,
the client immediately previews again and sends `force: true` only when the
affected job identities and dates are unchanged. Cancellation or a changed
second preview restores the exact pre-change client state and refreshes the
authoritative snapshot.

Optimistic Board/Gantt changes use one owner-aware lifecycle:

- Keep at most one Schedule mutation in flight across mounted/remounted client
  instances. A new instance remains read-only while another owner is saving.
- Capture the complete affected local Schedule state before optimistic work.
- Roll back that checkpoint on rejection, cancelled impact confirmation, or a
  competing local action.
- Keep unconfirmed optimistic state component-local rather than publishing it
  into shared React Query caches.
- Validate the complete success, confirmation, impact, date, identity, and
  nested crew-schedule envelope before trusting it.
- Apply an accepted Board response only to a compatible cache. For Gantt,
  restore the trusted checkpoint and fetch the authoritative range before
  showing the accepted result; if that fetch fails, show the prior trusted
  snapshot as stale. Remove incompatible caches so they cannot cross views.
- Block Board/Gantt view changes while a command or confirmation is pending.
- Claim success only after the staff API explicitly returns `ok: true`.
- Keep failed/stale state visible in the page until a successful save or an
  explicit refresh reconciles the server snapshot.
- Treat network failures, HTTP 408/5xx responses, and malformed success
  responses as commit-ambiguous: roll back the optimistic copy and refresh the
  authoritative server state rather than claiming that the command failed to
  save. HTTP 501 is the narrow exception because these routes return it only
  when the required Schedule schema/RPC is unavailable before a commit starts.

Queue reorder requests use exactly one strict mode: a complete ordered UUID
list, or one canonical item UUID plus a non-negative position. Finish-early
confirmation cancellation also reconciles the authoritative snapshot rather
than leaving preview-derived state in the client.

Gantt resize-and-pin uses
`POST /api/staff/v1/schedule/job/adjust`. Start, duration, pin mode, and every
recomputed crew forecast commit through one
`schedule_v2_apply_job_patch` RPC call, so a resize cannot save only half of
the requested change.

The second preview protects the time a person spends reading the confirmation
dialog. It does not yet provide a database revision guard between that preview
and the forced RPC. Two staff making nearly simultaneous changes can still race;
a guarded RPC or per-crew revision token is the next concurrency-hardening
step.

## Readiness

Schedule deploys are not ready until:

- V2 read paths load.
- `GET /api/staff/v1/schedule/readiness` returns `200`.

If readiness fails, check migrations and RPC availability before debugging UI state.

## Project Work Integration

Project Work V2 is deployed for newly created projects, and Schedule retains all install truth:

- the Deposit ready pool includes unmarked legacy projects and only Active V2 projects;
- Waiting/Closed/archived V2 projects are excluded from readiness, while already scheduled rows remain visible;
- no Schedule state is copied into a generic V2 work item;
- `CLOSE COMPLETE` requires a Schedule V2 `done` job with an actual finish, plus the separate commercial checks; and
- Running Jobs derives job completion from Schedule for every live project rather than `project_task_checks`. After Schedule confirms completion, the existing pre-V2 `SCHEDULED` lifecycle action may still advance that project's pipeline and run its completion automation; it does not create a task-check row.

Apply any later project-work schema dependency before its app changes. The
legacy-task retirement must promote its exact migration with the matching portal
release so Running Jobs does not call the all-project fact command before that
contract exists.

## Legacy Fallback

The schedule client has an explicit legacy fallback boundary. It exists for schema-not-ready recovery and older data paths. Keep legacy-only loading and mutation code isolated from the normal V2 client path.

When touching fallback:

- Keep normal `ScheduleClient` free of legacy repo imports.
- Keep `ScheduleLegacyFallbackClient` legacy-specific.
- Preserve tests that guard dependency direction.
- Do not remove fallback unless production readiness and telemetry prove it is unused.

## Current Portal UI Contract

Board, Gantt, and the legacy fallback render inside the full-width compact foundation canvas and shared searchable staff header without moving read or mutation ownership. Schedule view controls and page actions remain schedule-owned; global Projects/Contacts discovery remains separate from those controls. V2 load failures, scheduling issues, and action failures use shared accessible feedback. The dormant Site Visit surface retains its existing stale/error and dialog behavior for direct compatibility access. Schedule action dialogs use the shared focus trap and return focus to their trigger; active V2 locked-job unscheduling and downtime deletion use the extracted confirmation owner.

This describes the current Schedule presentation. It does not authorize
restyling another route or replacing Schedule-owned composition with generic
Foundation layout.

Board job cards keep project-open, move, and actions as separate sibling
controls. Pointer and keyboard drag activation belongs only to the labelled
Move control; the card container is not a nested interactive surface. Gantt
job bars are keyboard focusable and open the existing action dialog with
Enter/Space. Dialog-level Enter/P shortcuts run only when the dialog itself is
focused, so Enter on a quick-action button activates that button. Its
crew-label separator is an ARIA-valued keyboard control, and motion respects
the user's reduced-motion preference.

At narrow widths the Unscheduled queue stacks above one horizontally focused
crew lane; collapsing it reclaims the queue body so the first crew lane can
use the remaining height. Gantt preserves usable timeline width by adapting
its crew-label column. The dormant Site Visits route retains its focused day
calendar containment. Route-level document overflow is not allowed; the Board,
Gantt, and calendar keep their specialist internal scroll owners. Presentation
changes must not bypass Schedule V2 staff API/RPC commands, weaken optimistic
rollback, or merge the explicit legacy fallback into the normal client.

These interaction/layout changes retain the current portal colours, fonts,
cards, and crew-lane visual language.

## Performance Posture

Schedule is one of the heaviest portal surfaces. Watch:

- Client bundle size and lazy boundaries.
- Duplicate first-load requests.
- Board payload size.
- Gantt data path duplication.
- CSS coupling between views.
- Drag/drop responsiveness.

Action dialogs are part of the main Schedule client bundle so staff get immediate modal feedback. Board, Gantt, legacy fallback, diagnostics, and Site Visits keep their existing lazy/view boundaries.

Board and Gantt route changes use the shared non-blocking portal progress bar and mark only the selected view button busy. They must not replace the usable Schedule surface with the full-page loading overlay; full-page loading remains a cold-route/auth boundary only.

Use:

```bash
npm run schedule:bundle-budget
npm run test:portal:performance
```

## Verification

Current local gate signal from 2026-07-29:

```bash
npm run test:portal:schedule
npm run schedule:bundle-budget
npx playwright test playwright/portal.schedule-tasks-ui.spec.ts --project=portal-chromium --no-deps
```

The focused Schedule gate currently passes 43 files and 329 tests, including
atomic Gantt adjustment, strict affected-job confirmation/cancellation,
cross-instance mutation ownership, malformed-response rejection, optimistic
rollback/reconciliation, cache authority, Board control semantics, and Gantt
keyboard/responsive behavior. The authenticated non-mutating browser review
covers Board at 1440/1280/1024/768/390, Gantt, Site Visits, action/create
dialogs, project Tasks, 200% zoom, touch targets, focus return, reduced motion,
document overflow, and browser/runtime errors. Record fresh bundle figures
from `npm run schedule:bundle-budget`; do not raise the existing ceilings to
accommodate presentation work.

Focused tests:

```bash
npm run test:portal -- apps/portal/app/staff/schedule
npm run test:portal -- apps/portal/lib/scheduling
npm run test:portal -- apps/portal/app/api/staff/v1/schedule
```

Manual Board checks:

- Assign a job to a crew.
- Use the dedicated Move control for pointer/keyboard drag.
- Reorder jobs within a crew.
- Move a job between crews.
- Unschedule a job.
- Cancel an affected-job confirmation and confirm the optimistic change rolls
  back.
- Force one safe failure and confirm the persistent failure state offers a
  refresh.
- Keep one deliberately slow command open across a Schedule client remount and
  confirm the new instance remains read-only until the owning command finishes.
- Refresh and confirm persistence.

Manual Gantt checks:

- Week headers are Monday-aligned.
- Weekend shading aligns to Saturday/Sunday.
- Bars align to correct dates.
- Enter/Space opens a focused job bar's actions and Escape returns focus.
- Enter on a focused non-first quick-action button runs that button rather than
  the dialog-level Open Project shortcut.
- Resize a pinned bar and confirm one `/job/adjust` request owns start and
  duration.
- Fail the post-accept range refresh safely and confirm the prior trusted range
  remains visible as stale rather than showing optimistic dates as saved.
- Crew collapse and range changes work.

Dormant Site Visits checks (only for direct compatibility QA or an approved reactivation):

- Site visit list loads without Board/Gantt data dependency.
- Booking, confirming, rescheduling, and unscheduling route through staff APIs.
