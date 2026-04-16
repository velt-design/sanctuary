# Schedule Performance And Reliability Plan

Goal: make the schedule pages fast to load, reliable under production data volume, and predictable for staff using Board, Gantt, and Site Visits.

This is a recommendations and task backlog document only. It does not prescribe exact code changes.

## 1. Board Bug: Dragging An Unscheduled Job Fails And Rolls Back

Observed issue: on the Board page, dragging a job from Unscheduled into a crew lane sometimes unschedules/rolls back, shows "Failed to schedule job.", and moves the job back to the Unscheduled column.

Likely current behavior:
- The client applies an optimistic schedule update before the server confirms the assignment.
- The assignment request runs through `assignJob`.
- If the request fails or the mutation response cannot be applied cleanly, the schedule refreshes and the optimistic move disappears.
- The user sees the job return to Unscheduled, which feels like the drag itself unscheduled the job.

Potential causes to validate:
- The client is passing an invalid or stale `job_id`, `crew_id`, or position to the assign endpoint.
- The unscheduled job seed is stale versus the server schedule state, so the client tries to assign a job the server no longer considers assignable.
- The collision target is wrong, so the job is assigned to the wrong crew or position and the backend rejects the request.
- The server returns `requires_confirmation` or another non-`ok` result, but the client path treats that as failure instead of showing a clear recovery flow.
- The API error is hidden behind the generic "Failed to schedule job." toast, so the real failure condition is not visible.
- The mutation response is valid but lacks enough returned schedule data for the client to apply it, causing a refresh that restores the server state.
- Concurrent queued schedule mutations make the client state ahead of the server response, so a later refresh appears to undo the user action.

Tasks:
1. Add client-side instrumentation around every Board assign attempt: active id, target lane, over id, computed position, project uuid, crew uuid, and whether the item came from Unscheduled.
2. Add server-side request logging for failed schedule assignment calls, including validation failure reason, status code, and RPC error code/message.
3. Replace the generic assignment failure toast with a diagnosable error message in development and a clearer user message in production.
4. Confirm whether the failing assignment is a client target selection problem or a backend validation/RPC problem.
5. Confirm the assign request uses the project/job uuid the schedule v2 API expects, not the schedule item id or app-prefixed id.
6. Confirm the computed position is valid after filtering out completed jobs, hidden jobs, downtime, and collapsed lanes.
7. Confirm optimistic assignment removes the item from only the correct unscheduled source list.
8. Confirm the server response for assignment includes enough crew schedule data to reconcile the optimistic state without a full board reload.
9. If `requires_confirmation` is still possible, choose a production behavior: either force only when safe, show a confirmation flow, or fail with an explicit explanation.
10. Add a regression test for assigning an unscheduled job into an empty crew lane.
11. Add a regression test for assigning an unscheduled job into the middle of a populated crew lane.
12. Add a regression test for assignment when a prior schedule mutation is still queued.
13. Add a regression test for assignment after the page has been open long enough for the board query to refresh.
14. Add a Playwright smoke test that drags an unscheduled job into a crew lane and verifies it remains scheduled after refresh.
15. Add a recovery path so failed optimistic assignment restores the previous local state without doing an expensive full board refresh when the error is local/validation-only.

## 2. Board Bug: Dragged Jobs Jump To The Current Job

Observed issue: on the Board page, dragging and dropping some jobs sometimes makes them jump to the current job, which is frustrating.

Known likely cause:
- In `ScheduleClient.tsx`, the Board uses dnd-kit with `collisionDetection={closestCenter}`.
- That means the drop target is whichever droppable/card center is closest to the dragged card's center.
- In a scrollable lane, that can resolve to a nearby visible card rather than the spot the user intended.
- If the current job is nearby, visually prominent, or sticky in the visible area, the drag can resolve over that job.
- The drop handler then treats `overId` as the target insertion point and inserts the dragged item at the index of that card.
- Result: the job appears to jump to the current job even though the user dragged lower or elsewhere in the lane.

Second contributing issue:
- The component manually scrolls lanes during drag while dnd-kit's default auto-scroll is also enabled.
- Two scroll systems can make scrolling and hit-testing noisy, especially near lane edges.

Recommendations:
1. Use pointer-based collision for the board: prefer `pointerWithin` or a custom collision strategy, with `closestCenter` only as a fallback.
2. Resolve an explicit insertion index from the pointer position relative to the target card midpoint, instead of treating `overId` as "insert before this card" every time.
3. Restrict collisions to the lane currently under the pointer, so cards in other lanes or stale scroll positions cannot win.
4. Use only one auto-scroll system. Either keep dnd-kit auto-scroll and remove manual lane scroll, or disable dnd-kit auto-scroll and own the behavior fully.
5. Re-measure droppables during scroll-heavy drags, or force droppable measuring more often for this board.
6. Add a regression test with a lane containing an in-progress current job and many lower jobs, then drag a job into the lower half of that lane and assert the reorder/assign request uses the intended position.
7. Treat the backend reorder/assign flow as secondary until proven otherwise; the wrong target is most likely being chosen in the client before the request is made.

Tasks:
1. Log the collision result during Board drags: active id, over id, over lane id, pointer coordinates, active rect, and nearest lane.
2. Build a small test fixture with one current in-progress job near the top and at least 20 later jobs in the same lane.
3. Reproduce the jump with the current collision strategy and record the over target that wins.
4. Decide whether the board should support insert-before, insert-after, or explicit drop zones between cards.
5. Add insertion affordances in the UX so the user can see the exact destination before dropping.
6. Make lane hit-testing independent from card hit-testing: first choose lane, then choose insertion index within that lane.
7. Ignore cards outside the active lane once a lane has been chosen.
8. Ignore stale `overId` values when the pointer has left the lane bounds.
9. Ensure empty lane and lower-lane drop behavior use the same insertion-index calculation.
10. Decide whether current/in-progress jobs should be immovable, sticky, or visually normal; avoid sticky behavior if it interferes with collision targets.
11. Add test coverage for dragging near the top edge, middle, lower half, and bottom edge of a long lane.
12. Add test coverage for dragging while horizontal board scroll changes.
13. Add test coverage for dragging while vertical lane scroll changes.
14. Add test coverage for mobile or narrow viewport drag behavior if schedule board is expected to work there.

## 3. Page Weight: One Large Client Entrypoint

Issue:
- Board, Gantt, Site Visits, action modals, diagnostics, drag/drop behavior, schedule mutations, legacy fallback, and local recompute logic all flow through one large client component.
- Even when the requested view is Site Visits, the route still enters the same schedule client shell.
- Top-level imports include dnd-kit, schedule repos, Supabase browser utilities, Gantt helpers, schedule recompute helpers, and legacy fallback dependencies.

Tasks:
1. Split the schedule route into a thin shared shell plus separate view clients: Board, Gantt, and Site Visits.
2. Make Board load only Board-specific dependencies.
3. Make Gantt load only Gantt-specific dependencies.
4. Make Site Visits bypass Board and Gantt code entirely.
5. Keep action modals lazy-loaded, but split modal groups if some are Board-only or Gantt-only.
6. Keep diagnostics lazy-loaded and ensure diagnostics code is not in the initial Board/Gantt bundle.
7. Move schedule drag/drop helpers into a Board-only module.
8. Move Gantt axis and bar drag helpers into a Gantt-only module.
9. Move legacy fallback code into a legacy-only dynamic path.
10. Move shared pure schedule formatting helpers into small modules with no browser-only dependencies.
11. Confirm the route no longer imports dnd-kit when loading Site Visits.
12. Confirm the route no longer imports Gantt axis code when loading Board.
13. Confirm the route no longer imports Board drag/drop code when loading Gantt.
14. Run a bundle analyzer or Next build trace before and after the split.
15. Set a route-level budget for first-load JS for each schedule view.

## 4. Duplicate First Load: Server Seed Plus Immediate Client Refetch

Issue:
- Board/Gantt currently receive a server seed.
- React Query is also given the seed as `initialData`.
- Without an appropriate freshness window, React Query can immediately refetch the same board endpoint on mount.
- That duplicates expensive server work and adds avoidable network time.

Tasks:
1. Confirm in the browser network panel whether `/api/staff/v1/schedule/board` fires immediately after the initial server-rendered page loads.
2. Add timing markers for server seed generation versus client board refetch.
3. Decide the freshness contract for schedule data after first render, for example 30 to 60 seconds unless a mutation occurs.
4. Use a query hydration strategy that treats the server seed as fresh at load time.
5. Avoid refetch-on-mount when a fresh server seed exists.
6. Keep manual refresh and mutation invalidation behavior intact.
7. Ensure stale schedule data does not persist after an assignment, reorder, unassign, or status change.
8. Add a regression test that the board endpoint is not called twice on initial Board load.
9. Add a regression test that a mutation still updates or invalidates the query correctly.
10. Add a metric for duplicate schedule fetch count per page load.

## 5. Data Weight: Unscheduled Jobs Pull Too Much Estimate Data

Issue:
- The board snapshot builds unscheduled jobs by loading projects and estimates.
- The estimate query selects the full `outputs` JSON for all estimates.
- The final schedule payload only needs project id, project name, status, latest estimate id, and duration days.
- Estimate `outputs` can be large and expensive to move, parse, and derive duration from.

Tasks:
1. Measure payload size for the current project and estimate queries used by the board snapshot.
2. Measure how many estimates are loaded for a typical production schedule page.
3. Confirm whether `duration_days` or `crew_hours` is already cached on the estimates table for all relevant estimates.
4. Use cached duration fields for unscheduled jobs instead of deriving from full `outputs` where possible.
5. Create a schedule-specific server query or RPC that returns only schedule-ready unscheduled jobs.
6. Filter to scheduling-ready projects in the database, not after loading all projects in application code.
7. Pick the latest non-archived estimate per project in the database.
8. Return only `project_id`, `project_name`, `estimate_id`, `status`, and `duration_days` for unscheduled jobs.
9. Backfill missing `duration_days` for existing estimates if needed.
10. Add a fallback for estimates missing cached duration without loading every estimate output.
11. Add an index that supports latest-estimate-per-project lookup.
12. Add an index that supports filtering scheduling-ready projects.
13. Add a payload budget for the board endpoint.
14. Add a regression test that the board snapshot does not select full estimate `outputs`.
15. Add a data-volume test with hundreds or thousands of estimates.

## 6. Server Work: Board Snapshot Does Too Much On GET

Issue:
- The board endpoint loads schedule context, recomputes every crew, evaluates drift status, builds unscheduled jobs, computes conflicts, and maps everything into a snapshot.
- A read request can also evaluate patches that affect job drift/client update state.
- Expensive work on GET makes the page sensitive to data growth.

Tasks:
1. Break the board endpoint timing into phases: auth, schedule context load, recompute, drift evaluation, unscheduled job query, response mapping.
2. Log phase timings in development and optionally in production telemetry.
3. Move drift/client update mutation work out of the GET path.
4. Make drift evaluation read-only for page load, or run it in a scheduled background job.
5. Cache calendar/holiday data server-side with an appropriate TTL.
6. Avoid recomputing crews that are not visible or active unless needed.
7. Consider returning persisted forecast fields directly when no schedule mutations have occurred since last recompute.
8. Add a schedule snapshot materialization strategy if recompute becomes too expensive at production scale.
9. Add server timing headers for schedule endpoints.
10. Set a production target for board endpoint response time.
11. Add alerting when board endpoint duration exceeds the target.
12. Add load tests for large crew/job counts.

## 7. Gantt Data Path Is Redundant

Issue:
- `view=gantt` still loads the board seed.
- Gantt then calls a Gantt endpoint.
- The Gantt endpoint recomputes schedule data, but the client appears to use only part of the response for holiday blocks.

Tasks:
1. Confirm exactly which fields from the Gantt endpoint are used by the client.
2. If only holidays/closures are used, replace the Gantt fetch with a tiny calendar-range endpoint.
3. If Gantt needs schedule items, give Gantt a dedicated initial seed and skip the board seed.
4. Avoid loading unscheduled jobs on Gantt initial load unless the Gantt UI actually needs them.
5. Avoid loading Board-only action state for Gantt.
6. Add a route behavior test for `/staff/schedule?view=gantt` to ensure it does not fetch Board data unnecessarily.
7. Add a payload budget for the Gantt endpoint.
8. Add a performance test for Gantt with a long date range and many jobs.

## 8. Site Visits Should Not Pay For Board/Gantt

Issue:
- The server page skips the schedule seed for Site Visits, but the client still loads through the general schedule client.
- That means Site Visits can still pay some cost for the shared schedule shell and its imports.

Tasks:
1. Create a Site Visits entrypoint that does not import Board/Gantt logic.
2. Keep the schedule tabs shared through a small navigation component.
3. Confirm `/staff/schedule?view=site-visits` does not include dnd-kit in the client bundle.
4. Confirm `/staff/schedule?view=site-visits` does not initialize schedule board state.
5. Confirm Site Visits does not subscribe to schedule board React Query keys.
6. Add a route-level performance budget for Site Visits.
7. Add a regression test that Site Visits does not call `/api/staff/v1/schedule/board`.

## 9. Legacy Schedule Fallback Adds Weight And Risk

Issue:
- The client still contains legacy schedule fallback logic.
- The legacy path can call direct Supabase browser repos and load all projects and estimates.
- If legacy is rarely used, it should not live in the common path.

Tasks:
1. Decide whether legacy schedule mode is still required in production.
2. If required, move it behind an explicit lazy-loaded fallback boundary.
3. If not required, remove it after confirming migrations are always present in production.
4. Keep a clear "schema not ready" admin-only recovery path.
5. Remove direct client calls that select all estimates from the common schedule page bundle.
6. Add tests for the schema-not-ready fallback if it remains.
7. Add production telemetry to show whether legacy fallback is ever activated.

## 10. CSS Weight And View Coupling

Issue:
- The schedule CSS module is large and shared across the whole schedule route.
- Board, Gantt, Site Visits, diagnostics, and modals appear to share one CSS payload.

Tasks:
1. Split schedule CSS into shared, Board, Gantt, Site Visits, and modal CSS modules.
2. Keep only shared layout/tabs styles in the common shell.
3. Remove dead selectors after the client split.
4. Confirm Site Visits no longer loads Board/Gantt-specific CSS.
5. Confirm Board no longer loads Gantt-only CSS.
6. Confirm Gantt no longer loads Board-only CSS.
7. Add a CSS size budget for each view.

## 11. Query And Cache Behavior

Tasks:
1. Define the canonical schedule query keys for Board, Gantt, calendar range, and Site Visits.
2. Define stale times per view.
3. Define refetch-on-window-focus behavior per view.
4. Disable redundant refetches after server-seeded initial load.
5. Keep mutation-driven invalidation precise by crew when possible.
6. Avoid invalidating the full board when only one crew schedule changed.
7. Avoid invalidating Site Visits after Board-only mutations unless required.
8. Avoid invalidating Gantt calendar data after Board-only reorder mutations.
9. Persist a small last-known-good schedule snapshot only if it improves perceived load without showing stale data as fresh.
10. Add a visible "showing cached data" indicator if stale cached data is displayed after a failed refresh.

## 12. API Shape And Payload Contracts

Tasks:
1. Document the exact payload shape needed for Board initial render.
2. Document the exact payload shape needed for Board mutation responses.
3. Document the exact payload shape needed for Gantt initial render.
4. Document the exact payload shape needed for Site Visits.
5. Stop returning fields not used by the client.
6. Stop returning nested objects when ids and compact summaries are enough.
7. Use compressed transport in production and confirm response compression is active.
8. Add endpoint payload size logging in development.
9. Add endpoint payload size sampling in production telemetry.
10. Add contract tests to prevent full estimate outputs from leaking into schedule endpoints.
11. Add contract tests for mutation responses so optimistic state can be reconciled without a full reload.

## 13. Client Rendering And Interaction Responsiveness

Tasks:
1. Profile the Board render with a production-sized schedule.
2. Measure time spent building maps, lane items, issue lists, and derived Gantt rows.
3. Memoize expensive derived structures only where the dependencies are stable and clear.
4. Virtualize long unscheduled lists if the count can grow high.
5. Virtualize long crew lanes if production lanes can contain many jobs.
6. Avoid recomputing the full board model during every drag move.
7. Avoid setting React state on every drag move unless it changes visible behavior.
8. Keep drag hover state local and minimal.
9. Avoid creating large arrays/maps in render paths when a mutation touches only one crew.
10. Measure input delay during drag on a production-sized board.
11. Add a target for drag frame responsiveness.

## 14. Mutation Flow And Optimistic Updates

Tasks:
1. Define optimistic update rules for assign, unassign, reorder, move between crews, downtime create/update/delete, pin, unpin, mark in progress, and mark done.
2. Define rollback behavior for each mutation.
3. Ensure rollback restores the previous local state without forcing a full refetch when possible.
4. Ensure server-confirmed responses replace only affected crews.
5. Handle concurrent queued mutations explicitly.
6. Prevent a full board refresh from overwriting newer optimistic state.
7. Add mutation ids or client operation ids if needed to reconcile responses safely.
8. Display a clear sync state while a mutation is pending.
9. Prevent duplicate drag drops while the same job is already being assigned.
10. Add tests for mutation failure rollback.
11. Add tests for rapid consecutive reorders.
12. Add tests for moving a job between crews while a previous mutation is in flight.

## 15. Observability And Production Diagnostics

Tasks:
1. Add server timing for all schedule endpoints.
2. Add client timing for route start, first content, hydrated, first schedule visible, and fully interactive.
3. Add event logging for failed schedule assignments.
4. Add event logging for failed reorders.
5. Add event logging for drop target mismatches or invalid drop targets.
6. Add payload size logging for schedule endpoints.
7. Add bundle size tracking for schedule view chunks.
8. Add alerts for repeated schedule mutation failures.
9. Add alerts for board endpoint latency spikes.
10. Add a lightweight diagnostics panel that can show recent failed mutation details for staff/admin troubleshooting.

## 16. Database And Indexing

Tasks:
1. Review indexes for `schedule_crews`, `crew_schedule_items`, `scheduled_jobs`, `crew_downtimes`, `projects`, and `estimates`.
2. Add or confirm an index for schedule items by crew and position.
3. Add or confirm an index for scheduled jobs by crew.
4. Add or confirm an index for scheduled jobs by project/job id.
5. Add or confirm an index for scheduling-ready projects.
6. Add or confirm an index for latest non-archived estimates by project.
7. Confirm holiday and closure queries are small or indexed by date/region.
8. Use query plans to verify the unscheduled-job query scales with production data.
9. Backfill cached duration fields where missing.
10. Add data integrity checks for jobs that appear both scheduled and unscheduled.

## 17. Testing Plan

Tasks:
1. Unit test insertion-index calculation for Board drag/drop.
2. Unit test lane selection from pointer coordinates.
3. Unit test unscheduled-to-lane assignment position calculation.
4. Unit test same-lane reorder position calculation.
5. Unit test cross-lane move position calculation.
6. Unit test empty-lane drop behavior.
7. Unit test long-lane drop behavior near the top, middle, and bottom.
8. Unit test mutation rollback behavior.
9. Integration test board endpoint payload shape.
10. Integration test board endpoint does not return full estimate outputs.
11. Integration test board endpoint performance with seeded large data.
12. Playwright test initial Board load does not double-fetch board data.
13. Playwright test dragging unscheduled job into lane persists after refresh.
14. Playwright test dragging within a lane with a current job does not jump to the current job.
15. Playwright test Gantt route does not fetch Board-only data once separated.
16. Playwright test Site Visits route does not fetch Board data.
17. Add a manual QA checklist for schedule drag/drop after the collision fix.
18. Add a manual QA checklist for production-scale schedule load.

## 18. Performance Budgets

Initial targets to refine after measurement:
- Board first useful schedule render: under 2 seconds on a typical production connection.
- Board endpoint server time: under 500 ms for normal production data, with a clear alert threshold above 1 second.
- Gantt first useful render: under 2 seconds after direct navigation.
- Site Visits first useful render: should not be materially slower than other light portal list pages.
- No duplicate `/api/staff/v1/schedule/board` request on initial Board load.
- No full estimate `outputs` payload in schedule endpoints.
- Drag/drop should remain responsive with at least 5 crews and 100 visible jobs.

## 19. Suggested Work Order

1. Instrument failed assignment and drag target selection.
2. Reproduce and fix the unscheduled assignment rollback.
3. Reproduce and fix the current-job jump by changing collision/insertion strategy.
4. Add regression tests for both Board bugs.
5. Stop duplicate server seed plus client board refetch.
6. Replace all-estimate-output loading with a compact unscheduled-job query.
7. Split Site Visits from the Board/Gantt schedule client.
8. Split Board and Gantt client modules.
9. Remove or isolate legacy fallback.
10. Split CSS by schedule view.
11. Add endpoint and route performance budgets to CI or release checks.
12. Add production telemetry for latency, payload, failed mutations, and duplicate fetches.

## 20. Definition Of Done

The schedule pages can be considered production-grade when:
- Assigning an unscheduled job to a crew succeeds consistently or fails with a clear actionable reason.
- Dragging jobs in long lanes does not jump to the current job or another unintended target.
- Board, Gantt, and Site Visits load only the data and JS needed for that view.
- Initial Board load does not perform duplicate board fetches.
- Schedule endpoints do not load or return full estimate outputs.
- Gantt does not recompute or fetch Board data unless it directly needs it.
- Site Visits does not pay the Board/Gantt bundle or data cost.
- Production telemetry can identify whether slowness is caused by server query time, payload size, hydration, client render, or drag/drop interaction.
- Regression tests cover the two known Board bugs and the main performance safeguards.

## 21. Post-Isolation Review And Updated Plan

This section captures the current state after the schedule client split work and reframes the next tasks around what was learned during implementation.

### 21.1 Completed Since The Original Plan

Completed or partially completed:
- Site Visits now has a separate schedule entrypoint and the page skips the Board/Gantt server seed for `view=site-visits`.
- Board drag/drop code has moved behind the Board view boundary.
- Gantt axis code is behind the Gantt view boundary.
- The shared Board/Gantt client no longer statically imports dnd-kit.
- The main `ScheduleClient` is now V2-first for normal Board/Gantt loads.
- Legacy schedule repo imports have been removed from the normal `ScheduleClient` path.
- `listAllEstimates`, legacy schedule item loading, legacy schedule mutations, legacy confirm/unlock behavior, and legacy orphan cleanup have moved behind a lazy legacy fallback client boundary.
- Server schema-not-ready and client schema-not-ready recovery still route to a legacy fallback instead of becoming a hard failure.
- Import-guard tests now assert that legacy repos and `listAllEstimates` stay out of `ScheduleClient`.
- A focused legacy fallback test now verifies that the fallback loads installers, projects, estimates, and schedule items and can render the Board path.
- Shared Board model types have started moving into schedule-local modules so Board does not type-import from the main client.
- Focused schedule tests and focused lint pass for the changed schedule files.

### 21.2 Important Findings

Findings from the isolation work:
- Legacy fallback was not just a data loader. It also owned legacy mutations, V1 snapshot cache hydration, confirm/unlock actions, orphan cleanup, quick edit behavior, and parts of Board interaction handling.
- Isolating legacy behind a lazy boundary was safer than trying to delete it immediately, because production schema readiness has not been explicitly retired.
- The highest-risk bundle dependency was not pure model logic; it was the static repo/runtime imports that pulled direct browser repo helpers and all-estimate loading into the normal path.
- The normal client still contains some legacy-aware pure model branches. These are lower risk than repo imports, but they keep `ScheduleClient` harder to reason about.
- The copied fallback exposed a hook-order issue around the previous isomorphic layout effect pattern. This confirms that rarely-used fallback paths need direct tests rather than relying on normal Board tests.
- Architectural import guards are valuable here. They catch regressions where a future change accidentally reintroduces `listAllEstimates`, `scheduleRepo`, dnd-kit, or Board/Gantt-only modules into a shared path.
- The schedule route has two distinct performance problems: JavaScript/module weight and data/query weight. The legacy isolation improves module weight for normal loads, but does not solve the all-estimate payload problem inside the fallback or the board endpoint payload problem.
- Gantt still appears coupled to the Board seed. Even with dynamic view modules, route-level data loading still needs to be split if Gantt should avoid Board-only data.

### 21.3 Current Architecture Snapshot

Current intended shape:
- `/staff/schedule?view=site-visits` uses the Site Visits entrypoint and should not initialize Board/Gantt schedule state.
- `/staff/schedule?view=board` and `/staff/schedule?view=gantt` enter `ScheduleClient`.
- `ScheduleClient` owns V2 seed hydration, V2 board query state, V2 mutations, diagnostics, tabs, dynamic Board view, dynamic Gantt view, and schema-not-ready fallback selection.
- `ScheduleBoardView` owns Board UI and drag/drop dependencies.
- `ScheduleGanttView` owns Gantt UI and Gantt axis dependencies.
- `ScheduleLegacyFallbackClient` owns legacy-only repo loading and legacy mutations.
- Shared schedule-local type modules are beginning to separate pure contracts from runtime clients.

Current remaining coupling:
- `ScheduleClient` still contains a large amount of shared model and mutation code.
- `ScheduleLegacyFallbackClient` was copied from the mixed client and still contains V2-only code paths that are dead or nearly dead when running as legacy.
- Board and Gantt still share the main V2 client state and payload.
- Schedule CSS is still shared broadly.
- Server seed behavior still appears Board-shaped even for Gantt.

## 22. Updated Execution Plan

The updated plan is split into phases. Each phase should leave the app in a working state with focused tests.

### Phase 1: Finish The Client Boundary Cleanup

Goal: make the current splits clean enough that future performance work does not fight the old component shape.

Tasks:
1. Move `buildScheduleBoardModel` and related pure formatting/model helpers into a schedule-local model module.
2. Split the model builder into explicit V2 and legacy entrypoints, even if they share internal helpers.
3. Keep V2 model helpers free of `Estimate` output parsing.
4. Keep legacy model helpers allowed to use estimates, but only inside the legacy fallback path.
5. Remove any unused legacy branches from `ScheduleClient`.
6. Remove any unused V2 branches from `ScheduleLegacyFallbackClient`.
7. Make `ScheduleLegacyFallbackClient` a true legacy-only component instead of a copied mixed client.
8. Move V1 snapshot cache handling fully into the fallback module.
9. Move legacy orphan cleanup helpers into the fallback module or a fallback-only helper file.
10. Move legacy confirm/unlock/quick-edit helpers into the fallback module or fallback-only helper files.
11. Add a guard test that `ScheduleLegacyFallbackClient` does not import V2 mutation repo functions unless there is a documented reason.
12. Add a guard test that `ScheduleBoardView` does not import `ScheduleClient`.
13. Add a guard test that `ScheduleGanttView` does not import `ScheduleClient`.
14. Confirm focused lint and tests after each extraction.

Acceptance criteria:
- `ScheduleClient` imports no legacy repo modules and contains no legacy mutation code.
- `ScheduleLegacyFallbackClient` imports no V2 mutation modules unless explicitly justified.
- Board/Gantt view files do not import the main client at runtime or for types.
- Pure shared helpers live in schedule-local modules with clear dependency direction.

### Phase 2: Make Route Data Match The Requested View

Goal: stop loading Board-shaped data for views that do not need it.

Tasks:
1. Inventory the exact data fields Board uses from the V2 snapshot.
2. Inventory the exact data fields Gantt uses from the V2 snapshot.
3. Inventory the exact data fields Site Visits uses.
4. Decide whether Gantt needs unscheduled jobs at all.
5. Decide whether Gantt needs Board action state on direct navigation.
6. Create a Gantt-specific server seed or endpoint if the inventory shows Gantt does not need the full Board snapshot.
7. Update the schedule page so `view=gantt` loads the Gantt seed, not the Board seed, when safe.
8. Keep Board direct navigation using the Board seed.
9. Keep Site Visits skipping schedule Board/Gantt seed entirely.
10. Add route tests for `view=board`, `view=gantt`, and `view=site-visits` seed selection.
11. Add a test that Gantt direct navigation does not request unscheduled jobs if they are not used.
12. Add a test that Gantt direct navigation does not call the old Gantt recompute endpoint if the Board seed already provides the required calendar data, or replace it with a small calendar endpoint.

Acceptance criteria:
- Board loads Board data.
- Gantt loads only Gantt-required data.
- Site Visits loads no Board/Gantt schedule data.
- Route tests lock the behavior.

### Phase 3: Fix Board Drag Targeting And Assignment Reliability

Goal: remove the two most visible Board reliability issues.

Tasks:
1. Add development instrumentation for every assign and reorder attempt.
2. Log active id, active type, source lane, target lane, over id, insertion index, pointer position, and computed backend position.
3. Log the normalized backend ids sent to `assignJob` and reorder calls.
4. Improve error formatting so backend validation failures are visible in development and actionable in production.
5. Confirm whether failed unscheduled assignment is caused by target selection, stale unscheduled data, bad id mapping, invalid position, backend RPC failure, or response reconciliation.
6. Add tests for assigning an unscheduled job to an empty lane.
7. Add tests for assigning an unscheduled job to the end of a populated lane.
8. Add tests for assigning an unscheduled job into the middle of a lane.
9. Add tests for failed assignment rollback without full refresh when possible.
10. Move Board insertion-index calculation into a pure helper.
11. Choose lane-first hit testing: first resolve the lane under the pointer, then resolve insertion index inside that lane.
12. Avoid allowing a nearby current/in-progress job to win collision when the pointer is lower in the lane.
13. Disable one of the competing scroll systems if both manual and dnd-kit autoscroll are active.
14. Add tests for long-lane dragging near top, middle, lower half, and bottom.
15. Add a Playwright smoke test for dragging an unscheduled job into a lane and confirming it persists after refresh.

Acceptance criteria:
- Drag destination is predictable in long lanes.
- Assign failures explain the actual failure class.
- Optimistic rollback is deterministic.
- Regression tests cover the known jump and rollback issues.

### Phase 4: Reduce Board Data Payload

Goal: stop schedule reads from loading full estimate outputs when only duration and IDs are needed.

Tasks:
1. Measure current Board endpoint payload size with production-like data.
2. Measure current server time for schedule context load, recompute, unscheduled-job assembly, and response mapping.
3. Confirm whether estimates have cached duration fields that can be trusted.
4. Backfill missing cached duration fields if needed.
5. Add or update database columns/indexes needed for schedule-ready latest-estimate lookup.
6. Build a compact unscheduled-job query or RPC.
7. Return only project id, project name, project status, estimate id, and duration days for unscheduled jobs.
8. Filter scheduling-ready projects in the database.
9. Select the latest non-archived estimate per project in the database.
10. Avoid selecting estimate `outputs` in the Board endpoint.
11. Add a fallback path for rare estimates missing cached duration that does not load every estimate output.
12. Add contract tests proving schedule endpoints do not return full estimate outputs.
13. Add data-volume tests with hundreds or thousands of estimates.
14. Add payload size logging in development.
15. Add optional production sampling for payload size and server timing.

Acceptance criteria:
- Normal Board snapshot does not select or return full estimate outputs.
- Unscheduled jobs are compact and database-filtered.
- Payload size has a clear budget and test coverage.

### Phase 5: Simplify Board GET Work

Goal: make page-load reads cheap and predictable.

Tasks:
1. Split Board endpoint timing into explicit phases.
2. Identify which phases mutate or evaluate mutable drift/client-update state.
3. Move mutation-like drift/client-update work out of the GET path.
4. Make GET read-only unless there is a deliberately documented exception.
5. Cache calendar/holiday data with a clear TTL.
6. Avoid recomputing inactive or invisible crews unless required by the response contract.
7. Consider returning persisted forecast fields when no mutation has invalidated them.
8. Investigate materialized schedule snapshots if recompute remains expensive.
9. Add server timing headers for schedule endpoints.
10. Add alerts or logs for Board endpoint responses over the target threshold.

Acceptance criteria:
- Board GET can be reasoned about as a read path.
- Slow phases are visible in logs.
- Endpoint time stays within budget for production-like data.

### Phase 6: Split CSS And Remaining View Weight

Goal: make each schedule view pay only for its own UI.

Tasks:
1. Inventory selectors in the shared schedule CSS module.
2. Split common layout/tabs styles from Board, Gantt, Site Visits, diagnostics, and modal styles.
3. Move Board-only selectors into a Board CSS module.
4. Move Gantt-only selectors into a Gantt CSS module.
5. Move Site Visits selectors into a Site Visits CSS module.
6. Move modal-only selectors into a modal CSS module if useful.
7. Remove dead selectors after component splits.
8. Run visual checks for Board, Gantt, Site Visits, and legacy fallback.
9. Add CSS size tracking or at least a manual build-size note.

Acceptance criteria:
- Site Visits does not load Board/Gantt CSS.
- Board does not load Gantt-only CSS.
- Gantt does not load Board-only CSS.
- Legacy fallback still renders acceptably.

### Phase 7: Observability And Operational Readiness

Goal: know what happens in production before staff report it manually.

Tasks:
1. Add client timing for route start, first schedule visible, hydrated, and interactive.
2. Add server timing for Board, Gantt, and calendar endpoints.
3. Add event logging for failed assign, reorder, unassign, downtime, pin, and status mutations.
4. Add event logging when schema-not-ready fallback activates.
5. Include reason: server schema not ready, client schema not ready, legacy load failed, cached fallback used.
6. Add payload size sampling for schedule endpoints.
7. Add bundle/chunk size tracking for schedule views.
8. Add duplicate-fetch detection for initial Board load.
9. Add a diagnostics panel section for recent schedule mutation failures.
10. Add a dashboard or log query for fallback activation count.

Acceptance criteria:
- Production can show whether slowness is caused by server time, payload size, hydration, render, or drag/drop interaction.
- Fallback usage is measurable.
- Mutation failures include enough context to debug without reproducing blindly.

### Phase 8: Decide The Future Of Legacy

Goal: either retire the fallback safely or keep it intentionally as a disaster-recovery path.

Tasks:
1. Add telemetry for every legacy fallback activation.
2. Run production for a defined observation window.
3. Confirm all production environments have the V2 schema.
4. Confirm staging and preview environments have a documented schema setup path.
5. Decide whether the legacy fallback is still needed after the observation window.
6. If kept, document exactly when it is expected to run and who should see it.
7. If kept, optimize the fallback enough that it is usable during recovery.
8. If removed, delete legacy repo browser loading from schedule entirely.
9. Remove fallback tests only after replacing them with schema readiness tests.
10. Update deployment runbooks with schema-not-ready recovery instructions.

Acceptance criteria:
- Legacy fallback is either intentionally retained with telemetry or removed with confidence.
- There is no ambiguous half-supported legacy path.

## 23. Updated Suggested Work Order

Recommended next order from the current state:
1. Finish client boundary cleanup by pruning V2 code from the legacy fallback and moving model helpers into schedule-local modules.
2. Add guard tests for dependency direction between `ScheduleClient`, Board, Gantt, and legacy fallback.
3. Split Gantt route data from Board route data.
4. Instrument Board assign/reorder failures and drag target selection.
5. Fix Board insertion-index and current-job jump behavior.
6. Add Board drag/drop regression tests and one Playwright persistence smoke test.
7. Replace Board unscheduled-job all-estimate loading with a compact query.
8. Make Board GET cheaper and read-only where possible.
9. Split schedule CSS by view.
10. Add production telemetry and performance budgets.
11. Observe schema-not-ready fallback usage in production.
12. Decide whether to retire legacy fallback.

## 24. Updated Near-Term Task: Clean The Fallback Split

The next best task is not another large feature. It should be a cleanup pass that finishes the split created by the legacy isolation.

Scope:
- Do not change route behavior.
- Do not change V2 payload shape.
- Do not change Board/Gantt UI behavior.
- Do not remove legacy fallback yet.
- Do not touch unrelated calculator or drawing work.

Tasks:
1. Move `buildScheduleBoardModel` out of `ScheduleClient`.
2. Create separate `buildScheduleBoardModelV2` and `buildScheduleBoardModelLegacy` functions or equivalent explicit branches.
3. Update `ScheduleClient` to call only the V2 model path.
4. Update `ScheduleLegacyFallbackClient` to call only the legacy model path.
5. Remove dead V2 query and mutation code from `ScheduleLegacyFallbackClient`.
6. Remove dead legacy no-op code from `ScheduleClient`.
7. Keep `ScheduleLegacyFallbackClientProps` stable.
8. Add import guards for the new model/helper modules.
9. Run the focused schedule test suite.
10. Run focused lint for changed schedule files.

Test plan:
- Existing schedule client tests.
- Existing Board view tests.
- Existing page route tests.
- Existing model tests, updated to target the new model module.
- Legacy fallback test.
- New import-guard tests for model/helper dependency direction.
