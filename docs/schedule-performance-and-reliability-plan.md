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
