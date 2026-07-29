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
- Acquire that mutation owner and cancel active Board/Gantt reads before
  applying optimism, so a rejected second action never flashes on screen.
- Capture the complete affected local Schedule state before optimistic work.
- Roll back that checkpoint on rejection, cancelled impact confirmation, or a
  competing local action.
- Keep unconfirmed optimistic state component-local rather than publishing it
  into shared React Query caches.
- Stamp Board and Gantt reads separately when they start. Within each view,
  ignore any response that started before the current mutation settled, or
  that is older than a snapshot already applied, even if cancellation reached
  the server too late. Never compare ordering across the two different
  datasets.
- Validate the complete success, confirmation, impact, date, identity, and
  nested crew-schedule envelope before trusting it.
- Apply an accepted Board response only to a compatible cache. For Gantt, keep
  the confirmed direct-job preview visible while fetching the authoritative
  range, then replace it atomically. If that fetch fails, keep the confirmed
  preview visible as stale and block further writes until refresh. Never
  restore a known-older checkpoint after the API has explicitly accepted the
  command. Remove incompatible caches so they cannot cross views.
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

The repository-local project-work slice is new-project-only and not deployed. Schedule retains all install truth:

- the Deposit ready pool includes unmarked legacy projects and only Active V2 projects;
- Waiting/Closed/archived V2 projects are excluded from readiness, while already scheduled rows remain visible;
- no Schedule state is copied into a generic V2 work item;
- `CLOSE COMPLETE` requires a Schedule V2 `done` job with an actual finish, plus the separate commercial checks; and
- Running Jobs derives V2 job completion from Schedule rather than `project_task_checks`.

Apply the project-work migration before its app changes. App-first rollout breaks Schedule's new model/state relation reads.

## Legacy Fallback

The schedule client has an explicit legacy fallback boundary. It exists for schema-not-ready recovery and older data paths. Keep legacy-only loading and mutation code isolated from the normal V2 client path.

When touching fallback:

- Keep normal `ScheduleClient` free of legacy repo imports.
- Keep `ScheduleLegacyFallbackClient` legacy-specific.
- Preserve tests that guard dependency direction.
- Do not remove fallback unless production readiness and telemetry prove it is unused.

## Current Portal UI Contract

Board, Gantt, and the legacy fallback render inside the full-width compact foundation canvas and shared searchable staff header without moving read or mutation ownership. Schedule view controls and page actions remain schedule-owned; global Projects/Contacts discovery remains separate from those controls. V2 load failures, scheduling issues, and action failures use shared accessible feedback. The dormant Site Visit surface retains its existing stale/error and dialog behavior for direct compatibility access. Schedule action dialogs use the shared focus trap and return focus to their trigger; active V2 locked-job unscheduling and downtime deletion use the extracted confirmation owner.

On larger screens, Board crew lanes use a responsive wrapping grid instead of a horizontally scrolling strip. Up to four lanes share a row, so eight crews fit as two rows when the available Board width permits; narrower desktop containers reduce the column count and keep vertical scrolling inside the lane grid or lane body. The Unscheduled queue is narrower, and neither its cards nor crew cards create horizontal scroll. Wrapped-row drag movement retains semantic crew targets and auto-scrolls the owning grid toward offscreen rows.

The crew filter is one browser-saved presentation preference shared by Board
and Gantt. Staff can hide individual crews, hide empty crews, or restore
everyone. Hidden work is counted as schedule items, and the filter remains
available when every crew is hidden. This preference never changes installer
activity, access, project links, Schedule data, or API/RPC commands. New crews
default visible; malformed or unavailable browser storage fails open. The
existing `sp.schedule.board.hiddenCrewIds.v1` storage key is retained so Board
preferences carry into Gantt without resetting staff choices.

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

Board cards group forecast dates and duration first, show routine project,
Schedule and pin state as quieter metadata, and reserve bordered badges for
commitment or attention states. `ScheduleBoardCards.tsx` owns this card/action
presentation; `ScheduleCrewFilter.tsx` and `useScheduleCrewVisibility.ts` own
the shared view-only crew preference.

Gantt separates planning controls (range, scale, today, All jobs/Needs
attention, and crews) from secondary view options (planned dates, completed
jobs, density, and legend). Its default visual scale is eight weeks, while the
Monday-aligned query, cache, and authoritative refresh range remains twelve
weeks/84 days. Needs attention is a presentation filter over existing facts
only: an attached Schedule warning/error, a required client update, or planned
drift beyond the stored flex allowance. It does not create a new priority or
Schedule state.

The current week wash and today marker provide the primary timeline anchors.
Crew groups show scheduled-item and attention counts, while project rows keep
their forecast dates and duration beside the project name. `ScheduleGanttModel.ts`
owns pure timeline/row/attention modelling, `ScheduleGanttToolbar.tsx` owns the
grouped controls, and `ScheduleGanttTimeline.tsx` owns timeline presentation.
`ScheduleGanttView.tsx` remains the interaction coordinator for drag/resize,
scroll anchoring, focus return, and client-owned command callbacks.

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

Board and Gantt changes are client-owned within the mounted Schedule page. The
target lazy view and authenticated query are prefetched on pointer/focus
intent, a fresh cached snapshot is applied immediately, and the URL is updated
without asking the App Router to rebuild the server page. Back/Forward and
direct URL changes still synchronize the selected view. Only the active view's
model is derived: Board does not build while Gantt is active, and Gantt builds
only its lane items.

These changes retain the shared non-blocking portal progress bar and mark only
the selected view button busy. They must not replace the usable Schedule
surface with the full-page loading overlay; full-page loading remains a
cold-route/auth boundary only. The separate dormant Site Visits route keeps
normal App Router navigation.

Use:

```bash
npm run schedule:bundle-budget
npm run test:portal:performance
```

## Verification

Current local gate signal from 2026-07-30:

```bash
npm run test:portal:schedule
npm run schedule:bundle-budget
npx playwright test playwright/portal.schedule-tasks-ui.spec.ts --project=portal-chromium --no-deps
```

The focused Schedule gate currently passes 47 files and 371 tests, including
atomic Gantt adjustment, confirmed-preview continuity, stale-response
rejection, strict affected-job confirmation/cancellation,
cross-instance mutation ownership, malformed-response rejection, optimistic
rollback/reconciliation, cache authority, nine-crew Board rendering,
crew-filter persistence/fail-open recovery, hidden-lane exclusion, wrapped-row
drop geometry and auto-scroll, Board control semantics, and Gantt
keyboard/responsive behavior. The authenticated non-mutating browser review
covers deterministic eight-crew desktop wrapping, Board internal overflow and
filter persistence at
1440/1280/1024/768/390, Gantt, Site Visits, action/create
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
- Delay the post-accept range refresh and confirm the accepted bar never jumps
  back to its old dates. Fail that refresh safely and confirm the accepted
  direct-job preview remains visible with a stale/refresh-needed state.
- Crew collapse and range changes work.

Dormant Site Visits checks (only for direct compatibility QA or an approved reactivation):

- Site visit list loads without Board/Gantt data dependency.
- Booking, confirming, rescheduling, and unscheduling route through staff APIs.
