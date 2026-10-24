# Schedule

## Progressive real interface candidate (22 October 2026)

For ordinary document entry, the Schedule page starts its request-owned seed
without awaiting the full Board or Gantt report. A valid, overwritten Schedule
navigation callback omits that extra report after the same fresh leaf access gate;
navigation and intent-prefetch retain the client's guarded query/prefetched cache.
The real client and selected view render independently. The document seed
is consumed through the existing tracked query, normalized with `Promise.resolve`
for React Flight thenables, matched by view, Auckland day and Gantt range, then
retired. An unavailable initial read uses normal authenticated API recovery; schema
not-ready keeps the legacy fallback. No shared evidence cache is added.

The current actual-frame split gives ScheduleFrame, ScheduleBoardSurface and
ScheduleGanttSurface one stable public DOM owner. Pure date-axis calculation is
in ScheduleGanttCalendarModel; the complete ScheduleGanttModel reuses it and adds
verified crew/work rows. ScheduleSurfaceContext separates public viewport controls
from source-owned evidence. Private Board/Gantt runtimes portal rows/empty evidence
into those existing slots; one DndContext still spans unscheduled and lane rows.
The public provider reads neutral density/label-width settings only; crew visibility
and record state remain guarded. Old-source publications and cleanup cannot change
a newer source's slots. ScheduleFrameOutput alone imports the private renderers;
legacy ssr:false behavior is retained. Fresh bundle and browser proof is pending.

The persistent Workspace owns the unscheduled panel's collapse state and updates
the same public Frame urgently before and after guarded adoption. Private clients
receive its stable adoption setter, without subscribing to that neutral value.
Toggle and View unscheduled jobs share an intent setter that retains choices
through pending or unavailable evidence; healthy source defaults stay separate.
Stable viewport callbacks keep an unrelated panel toggle from republishing private
Board rows. Initial source defaults, early user choice and standalone behavior
remain with their existing owners. This removes unnecessary work; current
compiled bundle, interaction and performance targets still require verification.

`ScheduleBoardView` and `ScheduleGanttView` supply their verified pending values. Gantt dates,
calendar lines, scale and density controls are real before crews/work arrive.
Crew rows come from actual known crew data. Missing active-view records never
become zero totals or an empty-business claim. Board/Gantt switches retain real
view controls; incomplete view data cannot be moved or edited. Errors and Retry
stay within the interface. Initial read failures do not claim an unsaved command;
Schema diagnostics remain with the established V2 schema-not-ready legacy
fallback. Unreachable table/code repair markup was retired from generic V2 read
errors; the only assignments to that state carry a message, never table facts. The decorative Schedule route fallback is removed.

Focused component coverage includes the deferred server seed through the real
query client under StrictMode and a void-returning Flight thenable, no duplicate
initial browser read, and existing Board/Gantt mutation/trust regressions.
Pending attention counts and crew membership read as pending, never zero; roster
controls remain disabled until real crew data exists. Calendar date/scale/density
controls remain usable. The gated fixture keeps Board/Gantt navigation inside its
fictional route; normal Schedule navigation retains its canonical path. Its
controlled failure consumes both automatic attempts before explicit Retry recovers.

`/qa/schedule-progressive-fixture` is separately gated fictional proof of the same
client/server-promise path, with delayed read-only loaders and no provider access.
It does not establish hosted timing or successful production mutations.

The12 lazy-budget regression came only from CSS chunk coalescing; Schedule lazy
JavaScript sizes/hashes were unchanged. Twelve orphan Gantt presentation classes
for retired popover/column/text owners were removed after all-consumer and dynamic
reference searches. Actual Gantt/route regressions pass; the unchanged84,000-byte
gzip gate remains unresolved until the next canonical compilation.


Schedule V2 owns install planning. The Outlook site-visit agenda is a separate
source-backed workflow at `/staff/site-visits`, available under Schedule navigation.

The designer-performance candidate adds `?visit=<uuid>` as an exact correction
entry, optionally constrained by `project`. It loads the retained visit even
outside the rolling agenda window, preserves the existing correction editor and
does not infer attendance. The explicit selected-visit notice offers return to
History; changing agenda filters clears the exact selection. Report links open a
new tab so the original report retains its date and attendee filters. Hidden or
wrong-project records are not exposed. An exact visit with no accessible record
shows an empty result, never a substitute appointment. See
[designer reporting](marketing-performance.md#designer-visits-and-conversion-candidate-21-october-2026).

The released 21 October navigation change makes agenda scope and filters
share `siteVisitNavigation.ts`. Plain "Show all visits"
navigation clears only project scope through native history, preserving the
selected view/search/person and avoiding a late server transition that can
overwrite a newer click. Back restores the scoped URL; modified clicks retain
normal link behavior. `navRouteMatch.ts` keeps Schedule active in both sidebar
sizes, with Site Visits selected only on the agenda route.
The subsequent first-load candidate keeps these controls above changing scope,
freshness, retry and refresh-result content. A reserved review-count slot and
bounded attending-select width prevent data arrival from moving later targets;
counts above 999 display 999+ with the full count in the button's accessible name.
Source/scope information stays visible immediately below the controls. This is
layout stability, not delayed interaction or a change to URL/read semantics.
The Outlook integration and reviewed corrections were qualified and released on
20 October, including the 15-minute source update. The qualification steps below
remain the activation/recovery contract, not unfinished initial setup.
The older Portal booking editor remains a compatibility
surface; imported Outlook visits never enter its booking/confirmation commands.

## Saved Visits first-load candidate (22 October 2026)

The local candidate starts the saved-calendar read after the Site Visits page's
fresh staff gate, only for its initial HTML document. It passes a pending result
to the existing agenda query while controls remain mounted. Page view, person and
search stay local filters; project and exact visit retain their existing scope.
This reads the saved mirror only and never requests an Outlook refresh.

`lib/siteVisits/readSavedVisits.server` owns the API/document-shared validation,
RPC selection, reviewed projection, provider-enabled flag and safe failures.
`savedVisitsContract` owns their small result/scope contract. The page's
`loadCalendarVisitsInitialRead` uses its cookie-bound client; the component's
`calendarVisitsInitialRead` adopts a matching user/host/scope once in the existing
QueryClient. Cancelled, superseded, populated or invalidated queries keep the API
path. Thirty-second freshness, sixty-second polling, correction invalidation,
denial hiding and explicit Retry retain their existing behavior. Project and
dashboard visit consumers receive no document handoff. The candidate is local and
unreleased; optimized browser comparison and independent review qualify it.

## Outlook site visits (20 October 2026)

Ellen books in the shared Outlook calendar. `lib/siteVisits` owns the bounded
Graph reader, normalization and mirror publication; `components/site-visits`
owns the agenda, project summary and dashboard slice. Staff see Today, This week,
Upcoming, Needs review, History and Changes, with attending-person and text filters. Views
and filters live in the URL for project/agenda return. All times use
`Pacific/Auckland`; provisional bookings are counted separately, and duplicate or
uncertain entries stay out of the scheduled count. Cancelled, removed and manually
excluded entries remain reachable in Changes. Passing time never means completed.
Every normal-sensitivity appointment without explicit visit/provisional evidence
is retained as Needs review, including an unlabelled place or person. This is a
conservative capture decision: it may include ordinary nonvisit appointments for
local exclusion, never schedules them or adds dashboard alerts. The source window
bounds the review list. Private/personal/confidential entries remain withheld.

All-day events preserve `isAllDay` and date-only `allDayStartDate`/
`allDayEndDate` (exclusive), and display **All day** in the agenda, dashboard and
project summary. Multi-day entries show their inclusive covered-date range, remain
visible on every occupied day/week, and expire at Auckland midnight on the end
date. The agenda groups an ongoing range under the visible day/week boundary
without duplicating its booking count. Timed events keep source clock times.
The normalizer accepts same-zone literal midnight date boundaries without shifting
the written calendar day, including non-NZ source zone labels. A narrowly scoped compatibility
path accepts two converted UTC boundaries only when both are exactly Auckland
midnight. Mixed, invalid or unresolved boundaries fail the source update and
retain the last good mirror. Storage instants use the corresponding Auckland
midnights, including 23/25-hour DST days. Explicit date fields drive all-day
presentation and expiry. This follows the Graph all-day midnight contract and
Outlook's exclusive end-date convention; real Graph qualification remains required.

References: [Graph event properties](https://learn.microsoft.com/en-us/graph/api/resources/event?view=graph-rest-1.0)
and [Outlook all-day appointment boundaries](https://learn.microsoft.com/en-us/office/client-developer/outlook/pia/how-to-create-an-appointment-that-is-an-all-day-event).

The source read expands recurrence through Graph `calendarView`, from 30 days ago
to 90 days ahead. Every page must succeed before atomic publication and absence
reconciliation. Paging is mailbox/calendar-bound, capped at 20 pages/2,000 source
events and 4 MB per response. Failed, malformed or partial reads preserve the last
successful mirror and its timestamp. A two-minute lease fences overlapping runs;
all triggers share a five-minute attempt cooldown. The existing Vercel scheduler
calls the protected integration route every 15 minutes. Staff may request a bounded
refresh. The UI polls only saved Portal data and marks a success older than
30 minutes as overdue. No source call occurs on ordinary page navigation.

Staff are recognized by an explicitly configured set of exact invitation emails,
not the old salesperson roster. A person named in a title remains an assignment
hint. Customer emails come from invitees or exact authored `Email`, `Email to
search up in info` and `Email to search info` fields, excluding staff/mailbox
addresses and quoted reply chains. For explicit/provisional visits only, a standalone
email in the first authored nonempty field also corroborates customer identity;
later unlabelled signature emails do not. Address extraction accepts labelled and bare
street lines after inline media; missing extraction is labelled "Address not
captured", not a claim that Outlook has no address. Raw bodies and attachments
are not persisted. Private/personal/confidential events are withheld, including
previously visible records whose sensitivity changes.

Automatic project linking requires an exact customer email plus the street
address of exactly one unarchived project. Normalization preserves unit separators,
number and word boundaries and expands only final street abbreviations. Names,
suburbs and email alone never establish a link. Automatic linking requires a
leading street/unit number; other addresses remain available for a manual link.
Staff can choose a project, leave
a visit unlinked, restore automatic matching, or classify a candidate. These local
choices have optimistic revision checks and an append-only review trail and survive
later source updates. Outlook retains its original booking. Staff can separately
correct attending staff, address, visit purpose, booking status and known timing
in the Portal, with a basis and specific outstanding questions. Review drafts
survive source revisions and require acknowledgement before saving against the
new revision. Linked contact phone numbers are visible without editing details.

`correctionContract` owns the strict commands, `reviewedVisit` applies saved facts
at the authenticated API boundary, and `calendarModel` drives every consumer's
effective dates, filters and counts. `VisitDetailsEditor` composes the common
fields, project link and secondary source comparison. Agreed appointment times,
access windows and intentionally unknown historical dates remain distinct. A past
booking never becomes recorded attendance merely because its time has passed.
Material source conflicts reopen a specific review warning and withhold the entry
from upcoming summaries until reconciled; metadata changes, equivalent formatting
and Outlook catching up to the verified value do not reopen settled questions.
Source restoration, revision conflicts and failed saves preserve recovery paths.
`useVisitSave` owns the editor's bounded command and recovery state. POST waits
stop after 20 seconds; aborting that wait does not prove the server rolled back.
The draft and historical record UUID remain stable, Cancel becomes available,
and another write requires a successful fresh read plus explicit revision
acknowledgement. Global and project reads reconcile project moves and retained
history. An absent historical create retries only its original UUID/revision0;
the database's idempotency/revision fence also covers a later first commit.
A confirmed save followed by a failed, separately bounded refresh is labelled
saved, not failed or unknown. Late responses never silently close or rebase a
retained draft. No automatic command retry or shared API-client policy changes.

Private `site_visit_staff_identities` binds verified recognized Outlook addresses
to the existing roster keys for the configured source binding. Operators seed only
corroborated allowlisted staff identities; customer names and guessed addresses
never establish a mapping. Forward005 enriches saved projections without editing
the original payload, so imported full names and manual short names share one
chooser/filter identity. Source catch-up compares these identities rather than
display labels. Unmapped addresses remain distinct, and the mapping has no staff
or service-role write surface. Canonical labels come from the existing roster;
source comparison preserves Outlook's supplied name.

`ProjectVisitHistory` keeps past linked bookings and separately recorded historical
visits accessible, including on closed projects. Recording an original visit does
not reattribute a later measurement booking. Historical records support edits and
audited withdrawal/restoration, with no fabricated date or staff invitation.
Unknown historical dates do not create a review question; a future date-only
booking still needs its time resolved. Missing address/staff and explicitly
unanswered questions remain actionable. No blanket review dismissal exists.

Project Overview composes `ProjectNextVisit` and its extracted history/editor;
Dashboard composes `TodayVisits`. Neither rewrites command-centre domain facts.
The existing specialist action now opens the project-filtered Outlook agenda.
Separate legacy Portal bookings, manual completion facts, customer notification,
analytics and stage transitions keep their existing owners. An Outlook calendar
entry creates none of those facts.

Forward migration `20261020010004_site_visit_corrections.sql` is additive to the
enabled mirror. It preserves the original source projection and importer contract,
stores corrections/history separately and audits their revisions. Schema rollout
precedes the new code and must retain existing enabled control and saved reviews.

Activation requires the migration, disabled-control binding, exact Microsoft
grant and production federation, then a real-source first-read qualification.
Synthetic staging proves API/UI recovery, not live Graph extraction. See
`environment-auth-supabase.md`, `staff-api-auth-contracts.md` and
`supabase-schema-map.md` for the environment/security contracts. Disable the
source environment flag to stop pulls; disable the database control to withhold
the mirror. Preserve records for recovery rather than rolling back schema.

Focused checks: `vitest run test/outlook-site-visits-db.test.ts
apps/portal/lib/siteVisits apps/portal/app/api/staff/v1/outlook-site-visits
apps/portal/components/site-visits`. Database tests execute the actual migration
in disposable PostgreSQL-compatible storage. Hosted migration rehearsal must also
run transactionally with rollback before installation. Browser checks use only
labelled synthetic staging records until live-source access is qualified.

CI verification (2026-09-15): the Gantt-to-Board test now waits for the resolved
query notification before asserting the returned Board, and ScheduleClient test
roots unmount even after assertion failures. This fixes a timing-dependent stale
loading assertion and downstream observer contamination. All 40 focused tests
pass. The ScheduleClient test owner remains Schedule; splitting its Board/cache
fixtures is deferred to a dedicated test-maintenance change.

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

The local Praxis specialist-workload reader uses `scheduled_jobs` and
`schedule_crews` directly through a sanitized reporting view. It does not read
legacy task mirrors, change saved dates, infer installation capacity or derive
eligible unscheduled jobs from pipeline stages. Current work, period completions
and historical date inconsistencies remain distinct. Reporting activation and
the exact bounded contract are owned by `environment-auth-supabase.md`.

Schedule has two normal staff views:

- Board: crew lanes, unscheduled jobs, drag/drop assignment and reorder.
- Gantt: timeline by crew with bars, range controls, and collision/conflict visibility.

The older `view=site-visits` route remains directly addressable as a compatibility
workflow, outside the Schedule tabs. Project work actions now link to the separate
Outlook agenda: **Arrange the site visit** at `Contacted` and **View site visits**
at `Site Visit`. The old booking editor retains its tentative/confirmed contract,
explicit confirmation compare-and-swap, immutable `confirmed_at` and idempotent
qualified-lead analytics. It does not send customer email. Staff may still record
the separate bounded manual `SITE_VISIT_COMPLETED` confirmation; that fact removes
the specialist candidate but does not create work, mutate Schedule or advance stage.

## Authored dates and conflict resolution

A deliberate start-date edit or Gantt move fixes that start. Flexible queue work makes room around fixed intervals; Board order does not itself create a collision. Only overlapping working-day intervals create conflicts. Reading Board or Gantt preserves saved dates and gaps, including overdue work. Passing time does not extend started jobs or move followers: staff explicitly marks completion or updates remaining days. Recorded actual dates remain unchanged on reads. Gantt derives client-update presentation without writing flags.

The Gantt range includes four complete weeks before the current Monday and twelve weeks forward (112 calendar days). It initially scrolls around today and preserves the user's position on refresh. Hidden weekends do not change the target weekday of an inverse drag.

Conflicts appear in a collapsible review panel naming both jobs. Staff can change either date, change crew, or keep the exact overlap. Acceptance is stored in `scheduled_jobs.accepted_overlaps` using crew, job IDs and both date intervals; a changed interval produces a new issue. Flexible work without a client commitment reflows without a redundant confirmation. Gantt moves and resizes save on release; only affected client commitments require a review.

Apply `20260908000001_schedule_guarded_commands.sql` before deploying these APIs, then verify the Schedule readiness endpoint. On 2026-09-08 the exact migration was applied and verified on staging and production; migrated staging passed authenticated Board reorder, Gantt dates across reload, Unpin, and two-session concurrent-write rejection. See `docs/environment-auth-supabase.md` for deployment evidence. Browser recovery records retain intent, not a server commit receipt; an ambiguous request requires review against refreshed saved data. Matching application CI, promotion and production readiness postflight remain release gates.

The release also requires `20260908000002_schedule_browser_write_boundary.sql`. It revokes direct browser DML on jobs, queue items and downtime, all browser Schedule V2 RPC execution, crew deletion, and edits to server-owned crew revisions/anchors. Existing crew metadata fields remain writable under their existing RLS and revision trigger. Both migrations are applied on staging and production. Real staging staff requests verified direct table/RPC/revision denial while the authenticated staff API continued to save correctly.

`20260908000003_schedule_cascade_write_boundary.sql` also rejects browser-role writes inside the revision trigger, covering foreign-key cascades from parent projects that table grants alone cannot stop. It is applied on staging and production; a rollback-wrapped staging staff deletion of a synthetic parent project raised the expected permission error and preserved its scheduled job.

## V2 Write Model

Schedule mutations go through staff API routes and the service-role-only `schedule_v2_guarded_command` wrapper around the existing Schedule V2 RPC commands. The API captures each involved crew revision before reading calculation rows; the wrapper locks those crews in ID order, checks their revisions, and rejects a stale or out-of-scope write atomically with HTTP 409. Row triggers increment crew revisions for job, queue and downtime writes; crew planning settings and calendar changes also invalidate earlier calculations. The guarded command retains an authored `queue_anchor_date`, clears it when a queue becomes empty, and keeps leading/downtime-only queues stable across refreshes. New assignments are never backdated into an old empty queue. Cross-crew moves guard both crews. Important command areas include:

The forward correction `20260916000001_schedule_optional_command_payloads.sql` preserves SQL NULL for JSON-null optional `p_move` and `p_finish_early` arguments inside the guarded wrapper. Without it, a first assignment fails with `p_move must be an object`, and ordinary completion can fail similarly. The database contract sends serialized null and omitted payloads through the wrapper for empty/populated lanes, existing-job repair, cross-crew moves and completion, including non-null finish-early buffers and malformed-payload rejection. It retains revision checks and browser write denial; no UI or business-date rule changes.

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

The directly addressable Site Visits compatibility view follows the same truth boundary: its modal acquires a synchronous whole-form lock for book/save/confirm/complete/reschedule/unschedule actions, freezes fields and close controls while pending, and treats a failed post-command reload as stale reconciliation after a completed command. Orphan cleanup and salesperson assignment use exact action locks. See `docs/portal-action-recovery-audit.md`.

The V2 client previews a mutation with `force: false`. It asks for confirmation
only when the server reports that other scheduled jobs will move, and the
dialog identifies those projects and their before/after dates. After approval,
the client immediately previews again and sends `force: true` only when the
affected job identities and dates are unchanged. Cancellation or a changed
second preview restores the exact pre-change client state and refreshes the
authoritative snapshot.

Gantt and non-placement Schedule changes use one owner-aware lifecycle. Mounted
Board placement changes additionally use a resource-scoped optimistic command
controller:

- Board assign, reorder, cross-crew move, and unschedule intent is applied
  immediately. Commands for disjoint crews may persist concurrently; commands
  sharing a project or source/destination crew queue in intent order.
- Keep a confirmed local base separate from the visible optimistic layer. Merge
  every validated response into that base, then replay all newer intent in
  sequence so an older or out-of-order response cannot rewind a later drop.
- A definitive Board rejection removes only that command and rebases later
  intent over confirmed truth. A commit-ambiguous Board command retains its
  placement through two bounded reads; an unverifiable result blocks only its
  project and affected lane resources while unrelated crews remain movable.
- A separately mounted Schedule client remains read-only while another in-process owner is saving and reconciles after that owner settles. Owner-scoped browser records retain queued Board placement and sent command intent across a reload. The collapsible recovery panel shows unconfirmed/rejected requests for review; it never blindly replays an ambiguous create or destructive command.
- Acquire that mutation owner and cancel active Board/Gantt reads before
  persistence starts. Board optimism is already visible before a queued command
  starts; Gantt and non-placement commands retain their checkpoint lifecycle.
- Capture the complete affected local Schedule state for commands outside the
  Board placement controller and roll it back on rejection or cancellation.
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
- Keep failed/stale state visible until a successful save or explicit refresh
  reconciles the server snapshot. Board placement recovery is card/lane scoped;
  Gantt and other Schedule recovery may remain page scoped. Ambiguous Gantt timing keeps the requested preview visible until an authoritative read settles it; the UI distinguishes an unconfirmed preview from an accepted save.
- Treat network failures, HTTP 408/5xx responses, and malformed success
  responses as commit-ambiguous. Board retains and verifies its latest visual
  placement; other mutations refresh authoritative state rather than claiming
  failure. HTTP 501 is the narrow exception because these routes return it only
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
drag targeting is pointer-owned, keeps a quiet source placeholder at the same
size, and lifts a visual copy of the complete card without changing its dimensions
or content. A strong insertion line with a compact "Place here" marker identifies
the exact gap without shifting surrounding cards. A label above the floating card
names the destination crew and one-based queue position, remaining readable when
the card covers the gap. The live region also names the exact queue position.
Six pixels of midpoint tolerance prevent tiny pointer reversals from alternating
adjacent slots. Release remeasures current geometry using the same tolerance and commits that valid
destination, falling back to the last visible valid cue only when end-event
collision data disappears. The zero-based Schedule V2 command position is
derived by the pure `scheduleBoardOrder.ts` owner after removing the moving
card from its source lane. The floating copy lands over the accepted card in
160 ms while that card is hidden, then hands visibility back without a fade.
Reduced-motion preferences remove landing and keyboard-overlay animation.
Keyboard coordinates use the current key delta rather than a potentially stale
translated rectangle, and the source keeps focus throughout the gesture.
Same-position/unscheduled drops, hidden crews, and
cross-crew downtime moves are rejected before a command. Mounted Board
placement gestures remain available while earlier placements persist:
disjoint crew resources run concurrently and overlapping lane/project work
queues and rebases. Non-placement Board actions retain their existing guarded
lifecycle while placement commands are pending. Routine checking, saving,
refreshing, saved, and verified state is deliberately silent on Board: the
optimistic card position is the interaction feedback. A definitive rejection
restores the checkpoint once and adds one concise Retry notice to the affected
card. A commit-ambiguous response keeps the card in its intended position while
two bounded authoritative reads absorb a late server commit; matching server
truth stays silent, different server truth is applied once with Retry, and an
unavailable verification read keeps the optimistic position with one Refresh
notice and disables only the affected project/lane placement resources. These
rules do not create browser Schedule truth: only validated
command responses and authoritative snapshots settle persistence.
`useScheduleBoardDragController.ts` owns gesture geometry and scroll behavior;
`scheduleBoardPlacementIntent.ts` matches an exact lane/position against a V2
snapshot, `scheduleBoardCommandController.ts` owns resource scheduling and
ordered placement replay, and `useScheduleBoardMutationNotice.ts` owns only
exceptional per-project inline notices. Gantt
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
server-owned next-available date. Gantt retains its route-level
saved/saving/refreshing/failed/stale indicator. Board omits routine persistence
status and suppresses duplicate page-level mutation alerts when its affected
card owns the actionable failure or stale notice. Cold-load, access, and
general read-health failures remain page-owned.

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
weeks forward plus four weeks of history/112 days. Needs attention is a presentation filter over existing facts
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
the queue expanded. Releasing a pointer drag or resize invokes the existing
command immediately, without a routine confirmation modal. The live drag
preview shows the requested timing and "Release to save". Crew calendars,
holidays, closures and affected-job dates remain server-calculated. Only a
server response identifying affected client commitments opens the existing
review, re-preview and confirmation flow. Stale gestures are cancelled before
dispatch; uncertain-save recovery and database revision guards still apply.

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

The legacy fallback follows the same URL/prop authority instead of treating its
first view as a permanent local default. Site Visit modal, popover, hover, and
assignment state close when the active week, staff owner, or project scope
changes so controls cannot retain a record from the previous scope.

These changes retain the shared non-blocking portal progress bar and mark only
the selected view button busy. They must not replace the usable Schedule
surface with the full-page loading overlay; full-page loading remains a
cold-route/auth boundary only. The separate dormant Site Visits route keeps
normal App Router navigation.

Warm navigation from another portal page now renders the truthful shared
Schedule frame immediately and preloads the exact Board or Gantt query selected
by the destination URL. The frame releases when the Schedule route commits;
the existing mounted Board/Gantt behavior above still owns same-page view
changes, cached snapshots, mutations, and refresh truth.

Use:

```bash
npm run schedule:bundle-budget
npm run test:portal:performance
```

## Verification

Current local gate signal from 2026-08-01:

```bash
npm run test:portal:schedule
npm run schedule:bundle-budget
npx playwright test playwright/portal.schedule-board-confidence-fixture.spec.ts --project=portal-fixture --workers=1
npx playwright test playwright/portal.schedule-board-confidence-fixture.spec.ts --project=portal-chromium --workers=1
```

The focused Schedule gate currently passes 55 files and 420 tests, including
atomic Gantt adjustment, confirmed-preview continuity, stale-response
rejection, strict affected-job confirmation/cancellation,
cross-instance mutation ownership, malformed-response rejection, optimistic
rollback/reconciliation, cache authority, nine-crew Board rendering,
crew-filter persistence/fail-open recovery, hidden-lane exclusion,
pointer-owned drop geometry, fresh release remeasurement, exhaustive insertion
positions and cross-crew ordering, rapid same-lane queuing, disjoint-crew
concurrency, out-of-order response replay, proportional
auto-scroll, blocked uncommittable gestures, grouped actions, silent normal
Board persistence, resource-scoped action-required recovery, exact snapshot placement
matching, Board control semantics, shared job
identity/search presentation, Gantt save-on-release and affected-commitment review,
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
unscheduled jobs, and an optional 108-bar large schedule. Use
`?view=board|gantt&scale=standard|large` for deterministic
responsive and performance evidence without creating or mutating shared
Schedule records. Board drops and Gantt move/resize releases update only
in-memory sample rows and reflow them through the shared scheduling engine.
Unpin also updates the sample row and returns the job to flexible queue placement.
Bars derive from those rows, so switching views retains the requested dates;
refresh resets the sample. Other project/customer commands remain inert.
Sample dates are sequential working days per crew. The browser gate verifies
forward/inverse bar movement and exact duration extension, including a stored
end on a hidden weekend, without any API/RPC call. Board
additionally accepts `&state=failed|stale|slow` to render exceptional Retry and
Refresh notices or silent background persistence without a command; normal
drops stay silent. Run
`playwright/portal.schedule-board-confidence-fixture.spec.ts` with the
`portal-fixture` project for the six-width/200%-zoom, beginning/middle/end and
cross-crew order, held-pointer drag, grouped-action, focus-return, no-write,
silent-success, and action-required state matrix.
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
- Keep one same-lane save slow, make another reorder immediately, and confirm
  the latest order never rewinds while the second command waits its turn.
- Keep two disjoint crew saves slow, resolve them in reverse order, and confirm
  both placements stay visible and persist independently.
- Force one lane into unverifiable recovery and confirm only its project/lane
  is blocked while a different crew still accepts placement changes.
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


The development-only Board diagnostics use the same pending/error ownership as
the actual Board. Its real empty pending model has no diagnostic counts; the
disclosure shows Reading or Unavailable until verified diagnostics exist, then
retains the original genuine counts. It neither invents zero diagnostics nor
dereferences missing nested debug fields while the initial read is pending.
