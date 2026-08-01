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

The existing Site Visits route/data owner remains directly addressable as a bounded specialist workflow but is not shown in the Schedule tabs or portal navigation. Project work items do not link to it; the shared server ranking may expose **Arrange the site visit** at `Contacted` and **Book or confirm site visit** at `Site Visit`. Its `project` deep link resolves the project's active booking independently of the currently displayed week and salesperson filter: an existing visit switches to its week, highlights it, and opens the edit dialog, while a project with no visit opens the create dialog already linked to that project. In that direct compatibility surface, booking creates a tentative visit and the edit dialog saves its current date, time, salesperson, and notes before an explicit **Confirm booking** action. Confirmation is a compare-and-swap from `TENTATIVE` to `CONFIRMED`; only a verified affected row emits qualified-lead analytics, using the immutable database-owned `confirmed_at`. A recent confirmed replay may repair the idempotent event with that original time, while an old replay cannot create a fresh conversion; legacy confirmed rows with no `confirmed_at` fail closed. Confirmation does not mark the customer notified because this path sends no email. Staff may also record the separate bounded manual `SITE_VISIT_COMPLETED` confirmation; that fact removes the visit specialist candidate but does not create work, mutate Schedule, or advance pipeline stage.

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

On larger screens, Board crew lanes use a responsive wrapping grid instead of a horizontally scrolling strip. Up to three readable lanes share a row; narrower desktop containers reduce to two or one, while the lane grid owns vertical movement between crew rows. A normal lane is tall enough to show a typical two-job sequence without an immediate nested scroll trap, while large crews retain a bounded lane-body scroll. The Unscheduled queue is narrower, and neither its cards nor crew cards create horizontal scroll. Wrapped-row drag movement retains semantic crew targets and auto-scrolls the owning grid toward offscreen rows.

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
Move control; the card container is not a nested interactive surface. Board
drag targeting is pointer-owned, keeps the source card anchored, renders one
overlay and a non-layout-shifting insertion cue, and names the exact one-based
queue position. Release remeasures current geometry and commits that valid
destination, falling back to the last visible valid cue only when end-event
collision data disappears. The zero-based Schedule V2 command position is
derived by the pure `scheduleBoardOrder.ts` owner after removing the moving
card from its source lane. Same-position/unscheduled drops, hidden crews, and
cross-crew downtime moves are rejected before a command. While any Schedule
write or authoritative reconciliation is active, Board move and action
controls are unavailable before activation. The affected project card names
checking, review, saving, reconciliation, saved, restored, or verified state
and its intended destination; only a validated command response may show
saved, while ambiguous outcomes remain reconciling until a fresh snapshot.
`useScheduleBoardDragController.ts` owns gesture geometry and scroll behavior;
`useScheduleBoardChangeFeedback.ts` presents the existing command lifecycle
without creating Schedule truth. Gantt
job bars are keyboard focusable and open the existing action dialog with
Enter/Space. Dialog-level Enter/P shortcuts run only when the dialog itself is
focused, so Enter on a quick-action button activates that button. Its
crew-label separator is an ARIA-valued keyboard control, and motion respects
the user's reduced-motion preference.

Board cards group forecast dates and duration first, show routine project,
Schedule and pin state as quieter metadata, and reserve bordered badges for
commitment or attention states. Routine metadata is visibly qualified as
**Stage**, **Job**, and **Timing**, while the commitment badge is qualified as
**Plan**, so pipeline, execution, pin, and commitment concepts do not collapse
into an unexplained row of statuses. Every card action panel is named for its
project and groups state-aware commands as Plan and timing, Job progress,
Customer, and Exceptions. Redundant +1/+2 duration commands live inside Set
duration rather than expanding the job-level panel. `ScheduleBoardCards.tsx`
owns card composition; `ScheduleBoardActions.tsx` owns the grouped action
presenter;
`scheduleBoardOrder.ts` owns exact beginning/middle/end and cross-crew order;
`ScheduleCrewFilter.tsx` and `useScheduleCrewVisibility.ts` own the shared
view-only crew preference.

`ScheduleOperationalPresentation.ts` owns shared commitment/flex wording,
factual attention signals, and presentation-only crew workload summaries.
Board and Gantt both count a job as needing attention when it has an attached
warning/error, a required client update, or drift beyond stored flex. Crew
headers show job count plus summed server-forecast days for comparison; this
is a scan aid, not a browser-derived capacity limit or replacement for the
server-owned next-available date. The route-level saved/saving/refreshing/
failed/stale indicator remains visible across both views and uses text plus
shape/border treatment rather than colour alone.

Project name is the primary job label. Customer display name and site address
form one deduplicated secondary identity line on Board cards, Gantt rows,
keyboard labels, quick actions, and Schedule action dialogs. Search includes
all three fields. `ScheduleJobPresentation.ts` owns this presentation model;
Board and Gantt must not independently reconstruct identity or current timing.
The server read projection stays bounded to the projects already present in
the active Board/Gantt dataset. It does not create browser-owned Schedule
truth or broaden any write contract.

Gantt separates planning controls (range, scale, today, All jobs/Needs
attention, and crews) from secondary view options (planned dates, completed
jobs, density, and legend). Its default visual scale is eight weeks, while the
Monday-aligned query, cache, and authoritative refresh range remains twelve
weeks/84 days. Needs attention is a presentation filter over existing facts
only: an attached Schedule warning/error, a required client update, or planned
drift beyond the stored flex allowance. It does not create a new priority or
Schedule state.

The current week wash and today marker provide the primary timeline anchors.
Crew groups keep the full crew identity beside forecast workload and factual
attention counts, while project rows keep their forecast dates and duration
beside the project name. Bars show a project label whenever their rendered
width can support legible text; short bars remain fully identified by the
sticky project rail and keyboard label. `ScheduleGanttModel.ts`
owns pure timeline/row/attention modelling, `ScheduleGanttToolbar.tsx` owns the
grouped controls, and `ScheduleGanttTimeline.tsx` owns timeline presentation.
`ScheduleGanttView.tsx` remains the interaction coordinator for drag/resize,
scroll anchoring, focus return, and client-owned command callbacks.

Gantt exposes an explicit **View unscheduled jobs** route back to Board with
the queue expanded. A pointer drag or resize ends in a local review dialog
that names the project, customer/site, crew, authoritative current timing, and
the requested start and duration before invoking the existing command
callback. The browser does not claim an exact proposed finish: crew calendars,
holidays, closures, and affected-job dates remain server-calculated. **Check
impact** enters the unchanged server-owned affected-job preview, immediate
re-preview, explicit confirmation, optimistic rollback, and reconciliation
lifecycle. If the underlying item changes while the local review is open,
impact checking is disabled and staff must preview again.

At narrow widths the Unscheduled queue stacks above one horizontally focused
crew lane; collapsing it reclaims the queue body so the first crew lane can
use the remaining height. At 640 CSS pixels or narrower, or when 200% zoom
leaves too little operating height, Gantt becomes a read-only crew agenda built
from the same Gantt model instead of compressing desktop timeline controls into
the available space. It keeps the date range,
crew filter, attention filter, completed-job choice, forecast/plan identity,
and a clear route to Board for schedule changes. Agenda jobs use a single
reading column with timing before quieter stage/plan facts; they do not expose drag or
resize. Wider layouts retain the scroll-owned timeline and adaptable crew-label
column. The dormant Site Visits route retains its focused day calendar
containment. Route-level document overflow is not allowed; the Board, Gantt,
and calendar keep their specialist internal scroll owners. Presentation changes
must not bypass Schedule V2 staff API/RPC commands, weaken optimistic rollback,
or merge the explicit legacy fallback into the normal client.

These interaction/layout changes retain the current portal colours, fonts,
cards, and crew-lane visual language.

## Performance Posture

Schedule is one of the heaviest portal surfaces. Watch:

- Client bundle size and lazy boundaries.
- Duplicate first-load requests.
- Board payload size.
- Gantt data path duplication.
- Unbounded identity reads: Gantt identity lookup must remain constrained to
  the scheduled project IDs in its requested range.
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

Current local gate signal from 2026-07-31:

```bash
npm run test:portal:schedule
npm run schedule:bundle-budget
npx playwright test playwright/portal.schedule-board-confidence-fixture.spec.ts --project=portal-fixture --workers=1
npx playwright test playwright/portal.schedule-board-confidence-fixture.spec.ts --project=portal-chromium --workers=1
```

The focused Schedule gate currently passes 53 files and 406 tests, including
atomic Gantt adjustment, confirmed-preview continuity, stale-response
rejection, strict affected-job confirmation/cancellation,
cross-instance mutation ownership, malformed-response rejection, optimistic
rollback/reconciliation, cache authority, nine-crew Board rendering,
crew-filter persistence/fail-open recovery, hidden-lane exclusion,
pointer-owned drop geometry, fresh release remeasurement, exhaustive insertion
positions and cross-crew ordering, proportional
auto-scroll, blocked uncommittable gestures, grouped actions, card-level
transaction outcomes, Board control semantics, shared job
identity/search presentation, server-authoritative Gantt timing review,
stale-impact disabling, bounded Gantt project loading, phone/zoom agenda mode,
and Gantt keyboard/responsive behavior. With current staff test credentials,
also run the authenticated non-mutating browser review:

```bash
npx playwright test playwright/portal.schedule-tasks-ui.spec.ts --project=portal-chromium --no-deps
```

That review covers deterministic eight-crew desktop wrapping, Board internal overflow and
filter persistence at
1440/1280/1024/768/390, Gantt, Site Visits, action/create
dialogs, project Tasks, 200% zoom, touch targets, focus return, reduced motion,
document overflow, and browser/runtime errors. Record fresh bundle figures
from `npm run schedule:bundle-budget`; do not raise the existing ceilings to
accommodate presentation work.

The data-free `/qa/schedule-ops-fixture` route is gated by
`ENABLE_PORTAL_QA_FIXTURES=1`. It renders the production Board/Gantt
presenters with long customer/site identity, nine crews, conflicts, 12
unscheduled jobs, and an optional 108-bar large schedule. Every command
callback is inert. Use `?view=board|gantt&scale=standard|large` for deterministic
responsive and performance evidence without creating or mutating shared
Schedule records. Board drops update fixture-only in-memory arrays so the
rendered committed position can be asserted without any API/RPC call. Board additionally accepts
`&state=checking|reviewing|saving|reconciling|saved|restored|verified` to render
transaction feedback without a command. Run
`playwright/portal.schedule-board-confidence-fixture.spec.ts` with the
`portal-fixture` project for the six-width/200%-zoom, beginning/middle/end and
cross-crew order, held-pointer drag,
grouped-action, focus-return, no-write, and state matrix.
Use `portal-chromium` after the normal staff-auth setup to prove the same inert
matrix in an authenticated browser context; use `portal-fixture` for the
credential-free local gate. Neither variant may issue a staff write.

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
