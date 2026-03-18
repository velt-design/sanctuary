# Editable Estimates + Estimates Tab Refresh Implementation Plan

Date: 2026-03-18
Depends on:

- `docs/estimates-tab-editable-estimates-spec.md`

## Objective

Ship editable unlocked estimates, quote-based estimate locking, cleaned-up estimate version chips, and the read-only plan and section drawing on the project Estimates tab.

## Delivery strategy

Implement in this order:

1. shared server contracts and helpers
2. estimate API changes and tests
3. calculator edit mode
4. estimates tab UI refresh
5. drawing integration
6. regression testing and polish

This order keeps the lock logic and persistence rules stable before the UI starts depending on them.

## Phase 1: shared contracts and helpers

Goal:

- create the shared building blocks for editability, version formatting, and estimate payload persistence

Work:

- add `EstimateEditability` to estimate types
- add a shared server helper to resolve estimate editability from related quote versions and send logs
- update shared estimate version label formatting from lowercase `v` to capital `V`
- extract shared estimate persistence helpers so create and update use the same summary and payload rules

Primary files:

- `apps/portal/lib/estimates/types.ts`
- `apps/portal/lib/estimates/server.ts`
- new helper file, likely `apps/portal/lib/estimates/editability.ts`
- new helper file, likely `apps/portal/lib/estimates/persistence.ts`

Notes:

- keep this phase free of UI changes
- no schema migration should be required
- preserve backward compatibility for any existing consumer of estimate list and detail data

Exit criteria:

- shared helper can answer locked vs unlocked for any estimate id
- version labels resolve as `Vn`
- create and update can share one payload-building path

## Phase 2: estimate API changes

Goal:

- expose editability to the client and support in-place estimate content updates with server-side validation

Work:

- extend `GET /api/estimates/[estimateId]` to return `editability`
- extend `PATCH /api/estimates/[estimateId]` to support `estimate_update`
- preserve notes-only patch behavior
- enforce server-side quote lock checks
- enforce draft-quote acknowledgement when needed
- preserve estimate version number and immutable row identity fields on update
- reuse shared persistence helper from Phase 1

Primary files:

- `apps/portal/app/api/estimates/[estimateId]/route.ts`
- `apps/portal/app/api/projects/[projectId]/estimates/route.ts`
- supporting test files if present for route or helper coverage

Notes:

- this is the phase that makes the edit flow safe
- the calculator should not save directly through the browser repo until this route is ready

Exit criteria:

- detail route returns `editability`
- unlocked estimate content update succeeds
- locked estimate content update returns `409`
- stale-draft acknowledgement missing returns `409`
- notes-only patch still works

## Phase 3: calculator edit mode

Goal:

- allow the calculator to edit an existing unlocked estimate in place

Work:

- add `editEstimateId` query-param support
- keep `fromEstimateId` behavior unchanged for duplicate/new-version flow
- make edit mode take precedence if both params are present
- load estimate inputs into calculator for edit mode
- keep legacy input migration support
- split session-storage keys so edit and duplicate drafts do not collide
- switch the primary calculator action to `Save estimate` in edit mode
- call the updated estimate PATCH route instead of creating a new estimate row
- add draft-quote confirmation before save when required
- on success, redirect back to the selected project estimate
- add an `estimate_updated` project activity event

Primary files:

- `apps/portal/app/staff/calculator/CalculatorGridClient.tsx`
- `apps/portal/lib/repo/estimatesRepo.ts`
- `apps/portal/lib/repo/projectsRepo.ts` if activity helpers need a new event type

Notes:

- prefer adding a dedicated client wrapper for estimate edit saves instead of reusing the old browser-only update path without lock validation
- edit mode should fail safely if the estimate becomes locked while the user is already on the calculator page

Exit criteria:

- calculator loads existing estimate into form in edit mode
- save updates the same estimate row
- duplicate flow still creates a new estimate version
- edit save respects lock and stale-draft validation

## Phase 4: estimates tab UI refresh

Goal:

- update the project Estimates tab to expose edit state and match the requested layout

Work:

- add `Edit estimate` action to the selected estimate header
- show lock message when editing is not allowed
- keep `Open Job Pack`
- keep `Request Design` and `Create quote`
- remove estimate chip dots
- update estimate version labels to capital `V`
- rework the top area into the requested two-column layout in general mode
- preserve mobile stacking order

Primary files:

- `apps/portal/components/projects/ProjectPage/tabs/EstimatesTab.tsx`
- `apps/portal/components/projects/ProjectPage/tabs/EstimatesTab.module.css`
- `apps/portal/components/projects/ProjectPage/tabs/_components/EstimateVersionTabs.tsx`

Notes:

- land this after Phase 2 so the UI can trust `editability` from the API
- keep quote actions and job-pack behavior unchanged

Exit criteria:

- selected estimate shows the correct edit or lock state
- version chips render as `Vn` with no dots
- layout matches the requested left-summary and right-total-plus-drawing structure

## Phase 5: drawing integration

Goal:

- show the calculator plan and section drawing on the Estimates tab without repricing

Work:

- extract or reuse module-selection logic from calculator code
- normalize estimate snapshot inputs to calculator V2 where needed
- map selected module input to matching output module result
- reuse `ModuleViewsCard` or extract a smaller shared drawing card
- hide calculator-specific diagnostics and detail toggles in this context
- default to `Section`
- add module selector when more than one module exists
- show empty state when geometry cannot be built

Primary files:

- `apps/portal/app/staff/calculator/moduleViews.ts`
- `apps/portal/app/staff/calculator/ModuleViewsCard.tsx`
- `apps/portal/components/projects/ProjectPage/tabs/EstimatesTab.tsx`
- potentially a new shared helper such as `apps/portal/lib/estimates/moduleDrawing.ts`

Notes:

- do not rerun costing from the Estimates tab
- build from saved snapshot only
- keep drawing read-only

Exit criteria:

- plan and section render from saved estimate data
- multi-module estimates can switch active module
- empty-state handling is graceful when geometry is unavailable

## Phase 6: regression testing and polish

Goal:

- verify the full workflow and guard against regressions

Work:

- run helper and API tests added in earlier phases
- regression test estimate generation
- regression test duplicate/new-version flow from estimate
- regression test quote creation from estimate
- regression test quote send and estimate lock
- regression test notes-only editing after quote send
- verify desktop and mobile layout for the Estimates tab

Suggested manual QA flow:

1. Generate estimate `V1`.
2. Confirm project Estimates tab shows `V1` and no status dot.
3. Edit estimate and save back to `V1`.
4. Create a draft quote from `V1`.
5. Edit estimate again and confirm stale-draft warning appears.
6. Confirm draft quote remains unchanged after save.
7. Send the quote.
8. Confirm estimate is now locked.
9. Confirm internal notes are still editable.
10. Confirm drawing toggles between plan and section.

Exit criteria:

- all major estimate, quote, and calculator flows pass
- no regression in creating a new estimate version
- no regression in quote creation or send

## Recommended sequencing for engineering

Recommended implementation sequence:

1. Phase 1
2. Phase 2
3. Phase 3
4. Phase 4 and Phase 5 in parallel if desired
5. Phase 6

Why:

- Phase 1 and Phase 2 establish the source of truth for editability and save validation.
- Phase 3 depends on that server behavior.
- Phase 4 and Phase 5 mostly affect the Estimates tab UI and can be developed after the API contract is stable.

## Risk areas to watch

- stale draft quotes causing user confusion after an estimate edit
- calculator edit mode accidentally creating a new estimate instead of updating the existing one
- preserving estimate version number during update
- legacy V1 estimate snapshots that need migration before drawing
- layout regressions on smaller screens

## Suggested definition of done

- implementation matches `docs/estimates-tab-editable-estimates-spec.md`
- helper and API coverage exists for lock and stale-draft logic
- manual QA confirms edit, lock, and drawing behavior end to end
- no schema migration was required, or any required migration has its own reviewed spec and rollout note
