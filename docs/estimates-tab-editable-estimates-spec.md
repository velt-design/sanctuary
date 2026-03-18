# Editable Estimates + Estimates Tab Refresh Spec

Date: 2026-03-18
Status: Implementation ready

## Goal

Allow staff to edit an estimate after it has been generated, but lock that estimate once it has been sent with a quote. At the same time, clean up the estimate version UI and add the calculator plan and section drawing to the project Estimates tab.

## Scope

In scope:

- project detail Estimates tab refresh
- in-place editing for unlocked estimates
- server-side lock enforcement for estimate edits
- estimate version chip cleanup
- read-only plan and section drawing on the Estimates tab

Out of scope:

- automatic syncing of estimate edits into existing draft quotes
- quote tab redesign
- quote locking changes
- database schema changes unless implementation discovers a hard blocker
- job pack redesign

## Repo-specific findings

These decisions are based on the code that exists today.

### 1. Estimates are persisted as versioned rows

- Estimates are saved in `public.estimates`.
- Each estimate row already stores inputs, outputs, warnings, summary data, and an estimate version.
- New estimate versions are created by adding another row, not by mutating a version counter on the same row.

Relevant files:

- `apps/portal/lib/repo/estimatesRepo.ts`
- `apps/portal/app/api/projects/[projectId]/estimates/route.ts`
- `apps/portal/lib/estimates/server.ts`

### 2. The calculator already supports estimate duplication

- The calculator already accepts `fromEstimateId`.
- That flow duplicates an existing estimate into a calculator draft and then generates a new estimate row.
- That behavior should remain the "create new version" path.

Relevant file:

- `apps/portal/app/staff/calculator/CalculatorGridClient.tsx`

### 3. The estimate detail API already exists, but it only patches notes

- `GET /api/estimates/[estimateId]` returns the selected estimate detail.
- `PATCH /api/estimates/[estimateId]` currently supports internal notes only.
- This route is the natural place to add server-side estimate update validation and lock enforcement.

Relevant file:

- `apps/portal/app/api/estimates/[estimateId]/route.ts`

### 4. Quotes already define the right lock boundary

- Quote versions reference their source estimate through `source_estimate_version_id`.
- Quote versions are `DRAFT`, `SENT`, `ACCEPTED`, or `DECLINED`.
- Draft quotes remain editable.
- Sent and later states are already treated as locked quote states.

Relevant files:

- `apps/portal/lib/quotes/serverCore.ts`
- `apps/portal/lib/quotes/serverEmail.ts`
- `apps/portal/lib/quotes/types.ts`
- `apps/portal/components/projects/ProjectPage/tabs/QuotesTab.tsx`

### 5. The calculator drawing already exists

- The calculator already builds module plan and section models.
- The calculator already renders those models in `ModuleViewsCard`.
- The Estimates tab can reuse those builders and rendering components instead of building a second drawing system.

Relevant files:

- `apps/portal/app/staff/calculator/moduleViews.ts`
- `apps/portal/app/staff/calculator/ModuleViewsCard.tsx`

## Locked product decisions

### 1. Editing an unlocked estimate updates the same estimate row

- Editing an estimate does not create a new estimate version.
- The existing `+` button and calculator generate flow remain the explicit way to create a new version.
- "Edit estimate" means "update the currently selected estimate in place".

### 2. The duplicate flow remains separate

- `fromEstimateId` remains the existing "start from this estimate and create a new version later" flow.
- Add a separate calculator edit mode for in-place edits to an existing estimate.
- Do not overload `fromEstimateId` with two different meanings.

### 3. The estimate lock is quote-scoped

- An estimate is editable while it only has draft quotes, or no related quotes at all.
- An estimate becomes locked when any related quote version sourced from that estimate is sent or moves beyond draft.
- The primary lock rule is:
  - lock if a related quote version has status `SENT`
  - lock if a related quote version has status `ACCEPTED`
  - lock if a related quote version has status `DECLINED`
- As a defensive fallback for inconsistent historical data, treat a related quote as locking if a send log exists for it even if its status was not updated.

### 4. Draft quotes do not lock the estimate

- Related draft quotes do not block estimate editing.
- Editing an estimate does not auto-update those draft quotes in V1.
- The user must consciously accept that draft quotes will remain stale after the estimate save.

### 5. Internal notes are not part of the quote lock

- Quote locking applies to estimate content and pricing snapshot fields.
- Internal notes remain editable after quote send.
- Existing internal notes behavior should continue to work from the Estimates tab.

### 6. Estimate version labels use capital `V`

- Estimate version labels should render as `V1`, `V2`, `V3`, not `v1`, `v2`, `v3`.
- Remove the estimate chip status dot entirely.
- Apply the capital `V` consistently anywhere the app renders an estimate version label, including:
  - estimate version chips
  - selected estimate header labels
  - quote provenance strings that reference an estimate version

### 7. The project-page layout change applies to general mode

- The visible project detail page currently runs in general mode.
- The requested layout refresh applies to the general Estimates tab.
- If focus mode is enabled later, it should inherit the same edit and lock behavior, but it does not need the same layout treatment in V1.

## User experience

### 1. Estimates tab actions

For the selected estimate:

- show `Edit estimate` when the estimate is unlocked
- disable or replace `Edit estimate` with a read-only lock message when the estimate is locked
- keep `Open Job Pack`
- keep `Request Design`
- keep `Create quote`

### 2. Lock messaging

When locked, show a clear message in the selected estimate card.

Preferred format:

- `Locked after Q-0026 V16 was sent on 18 March 2026.`

Fallback format:

- `Locked after quote sent.`

### 3. Draft quote warning

If the estimate has one or more related draft quotes, show a confirmation before saving.

Required message:

- `This estimate has draft quotes. Saving will not update those drafts automatically. Continue?`

If available, include count:

- `This estimate has 2 draft quotes. Saving will not update those drafts automatically. Continue?`

### 4. Estimates tab layout

Desktop general layout:

- header area for selected estimate title, metadata, and actions
- two-column content area underneath
- left column:
  - module summary lines
  - related quote list
  - quote actions
- right column:
  - total card
  - drawing card
- breakdown remains below the top two-column area
- warnings and internal notes remain below as separate cards

Mobile layout:

- selected estimate header and actions
- module summary
- total
- drawing
- related quotes
- quote actions
- breakdown
- warnings
- internal notes

### 5. Drawing panel behavior

- Add a read-only drawing card to the Estimates tab.
- Include a `Plan | Section` toggle.
- Default to `Section` when the user first opens the estimate.
- Preserve the selected drawing view while the user stays on the page.
- If the estimate contains multiple modules, include an `M1`, `M2`, `M3` selector.
- Render one module at a time.
- Show `Not to scale`.
- Hide calculator-specific debugging and geometry diagnostics from this surface.
- Use clean presentation by default.

## Technical design

### No schema migration by default

V1 should use the current schema:

- `estimates`
- `quote_versions`
- `quote_send_logs`

No new table or column is required for the primary implementation.

### New edit-mode URL contract

Use a dedicated calculator query param for in-place editing:

- `/staff/calculator?projectId={projectId}&editEstimateId={estimateId}`

Existing duplication path stays as:

- `/staff/calculator?projectId={projectId}&fromEstimateId={estimateId}`

Precedence rule:

- if `editEstimateId` is present, calculator runs in edit mode
- if `editEstimateId` is absent and `fromEstimateId` is present, calculator runs in duplicate/new-version mode

### Estimate editability type

Extend estimate detail with an explicit editability block.

Suggested shape:

```ts
type EstimateEditability = {
  isLocked: boolean;
  lockReason: 'quote_sent' | null;
  lockedAt: string | null;
  lockedByQuoteVersionId: string | null;
  lockedByQuoteRef: string | null;
  lockedByQuoteVersionNumber: number | null;
  hasDraftQuotes: boolean;
  draftQuoteCount: number;
};
```

Add to `EstimateDetail`:

```ts
type EstimateDetail = EstimateMeta & {
  calculatorSnapshot: Record<string, unknown> | null;
  internalNotes?: string | null;
  editability: EstimateEditability;
};
```

### Server-side editability helper

Create a shared server-only helper that:

- accepts an estimate id
- finds related quote versions by `source_estimate_version_id`
- determines whether any non-draft quote exists
- determines whether any send log exists for those quote versions
- counts related draft quotes
- returns the normalized `EstimateEditability` object

This helper should be used by:

- `GET /api/estimates/[estimateId]`
- `PATCH /api/estimates/[estimateId]`
- any future estimate update server action

### Estimate detail API changes

#### GET /api/estimates/[estimateId]

Keep the current route and extend the response.

Response shape:

```json
{
  "estimate": {
    "id": "est_x",
    "projectId": "proj_x",
    "createdAt": "2026-03-10T02:05:00.000Z",
    "status": "draft",
    "summary": {},
    "createdBy": "user@example.com",
    "versionLabel": "V3",
    "calculatorSnapshot": {},
    "internalNotes": "note",
    "editability": {
      "isLocked": false,
      "lockReason": null,
      "lockedAt": null,
      "lockedByQuoteVersionId": null,
      "lockedByQuoteRef": null,
      "lockedByQuoteVersionNumber": null,
      "hasDraftQuotes": true,
      "draftQuoteCount": 1
    }
  }
}
```

#### PATCH /api/estimates/[estimateId]

Keep backward compatibility for notes-only updates and add estimate-content updates.

Supported request forms:

1. Notes-only patch

```json
{
  "internal_notes": "new note"
}
```

2. Estimate-content update

```json
{
  "estimate_update": {
    "inputs": {},
    "derived": {},
    "projectSnapshot": {},
    "snapshot": {},
    "outputs": {},
    "configVersions": {}
  },
  "acknowledgeDraftQuoteStaleness": true
}
```

Rules:

- `estimate_update` is required for calculator save.
- `acknowledgeDraftQuoteStaleness` is required when `draftQuoteCount > 0`.
- The server ignores any attempt to change immutable row identity fields such as:
  - `id`
  - `project_id`
  - `created_at`
  - `created_by`
  - estimate version number

The server recomputes and persists:

- `summary_json`
- legacy summary columns such as materials, install, totals, and duration fields
- `warnings`
- `costing_manifest`
- `costing_rules`
- `updated_at`

The server preserves:

- estimate row id
- project id
- created timestamp
- created by
- estimate version number already stored on the estimate

#### PATCH error behavior

- `400` invalid payload
- `404` estimate not found
- `409` estimate is locked because a related quote has already been sent
- `409` draft quote acknowledgement required before saving

### Shared persistence helper

Extract shared estimate-persistence logic so create and update use the same derivation rules.

The helper should:

- accept estimate snapshot inputs and outputs
- compute summary fields
- build database payload fragments
- preserve the current estimate version on update
- avoid duplicating the same summary logic in multiple routes

This helper should be reusable from:

- `apps/portal/app/api/projects/[projectId]/estimates/route.ts`
- `apps/portal/app/api/estimates/[estimateId]/route.ts`

### Calculator behavior

#### Load behavior

In edit mode:

- load the selected estimate by `editEstimateId`
- hydrate calculator values from that estimate's inputs
- migrate legacy V1 inputs to V2 if needed
- set calculator UI into explicit edit mode

In duplicate mode:

- keep the current `fromEstimateId` behavior unchanged

#### Session draft storage

Edit mode and duplicate mode must not share the same session storage key.

Use a session key that distinguishes:

- project id
- edit estimate id
- duplicate source estimate id

This prevents an edit draft from overwriting a duplicate draft and vice versa.

#### Calculator actions

In edit mode:

- primary action label becomes `Save estimate`
- success toast becomes `Estimate saved (Vn).`
- success redirect goes back to:
  - `/staff/projects/{projectId}?tab=estimates&estimateId={estimateId}`

In create mode:

- keep existing `Generate estimate`
- keep existing new-version behavior

#### Save flow

Edit-mode save should:

1. run the same calculate and validation requirements as estimate generation
2. build the same estimate payload shape now used for create
3. call `PATCH /api/estimates/[estimateId]`
4. if draft quotes exist, require an explicit user confirmation
5. if the estimate became locked while the user was editing, return a lock error and do not save
6. on success, add project activity for estimate update

### Estimates tab behavior

#### Selected estimate header

Show:

- `Estimate Vn`
- current draft pill if still applicable
- created timestamp
- `Edit estimate` action when unlocked
- lock message when locked
- `Open Job Pack`

#### Version chips

Change:

- `v1`, `v2`, `v3` to `V1`, `V2`, `V3`
- remove the green and grey dot entirely

Keep:

- selected chip styling
- `+` create button

#### Related quotes section

Keep the current quote list and actions, but:

- keep `Request Design` between `View all quotes` and `Create quote`
- use the estimate editability data to control the estimate edit button, not quote actions

### Drawing integration design

#### Data source

Build drawings from `EstimateDetail.calculatorSnapshot` only.

Do not:

- rerun pricing on the Estimates tab
- fetch new calculator outputs
- persist any drawing-specific data

#### Input normalization

Support both:

- current V2 calculator inputs
- legacy V1 calculator inputs migrated to V2 before drawing

#### Module mapping

Extract the module-selection logic already present in calculator code into a shared helper that:

- normalizes pergolas
- builds a stable ordered module route list
- maps each input module to the matching output module result when available

#### Rendering approach

Reuse the existing calculator drawing stack.

Recommended approach:

- extend `ModuleViewsCard` with presentation props so the Estimates tab can:
  - hide detail-mode controls
  - hide source and geometry status badges
  - default to clean mode
  - remain read-only

Alternative acceptable approach:

- extract the SVG renderers into a smaller shared view component and wrap them with a new `EstimateDrawingCard`

#### Empty states

If the selected estimate cannot produce a drawing:

- show a non-error empty state inside the drawing card
- keep the rest of the estimate page functional

Suggested message:

- `No plan or section drawing is available for this estimate.`

### Project activity

When an estimate is edited successfully, add a project activity event.

Suggested message:

- `Estimate V3 updated`

Recommended metadata:

- estimate id
- version label
- whether draft quote acknowledgement was required

## Acceptance criteria

- Unlocked estimates expose an `Edit estimate` action.
- Edit mode opens calculator with the selected estimate loaded into the form.
- Saving in edit mode updates the same estimate row rather than creating a new version.
- Draft quotes do not lock an estimate, but saving requires explicit acknowledgement that they will remain stale.
- Sent, accepted, and declined related quotes lock the estimate.
- Locked estimates cannot be saved even if a user still has the calculator edit page open.
- Internal notes remain editable after quote send.
- Estimate version chips no longer show dots and render as `Vn`.
- Estimate version labels elsewhere also render with capital `V`.
- The project Estimates tab displays a working `Plan | Section` drawing card for the selected estimate.
- Multi-module estimates allow switching the active module drawing.
- The Estimates tab layout matches the requested desktop split and mobile stacking.
- Existing job pack, request design, create quote, breakdown, warnings, and notes behavior continue to work.

## Testing

### Unit and helper tests

- estimate version label formatter returns `V1`, `V2`, `V3`
- estimate editability helper:
  - no related quotes -> unlocked
  - draft quotes only -> unlocked with draft quote count
  - sent quote -> locked
  - accepted quote -> locked
  - declined quote -> locked
  - stale status with send log -> locked
- drawing helper:
  - V2 snapshot produces module routes
  - legacy V1 snapshot migrates and produces module routes
  - missing output module still falls back to input-based geometry

### API tests

- notes-only PATCH still works
- content PATCH succeeds for unlocked estimates
- content PATCH preserves estimate version number
- content PATCH returns `409` for locked estimates
- content PATCH returns `409` when draft quote acknowledgement is required but missing

### Manual QA

1. Generate estimate `V1`.
2. Open project Estimates tab and confirm chip shows `V1` with no dot.
3. Edit estimate, save, and confirm the same estimate remains selected as `V1`.
4. Create a draft quote from that estimate.
5. Edit the estimate again and confirm the stale-draft warning appears.
6. Confirm the draft quote did not auto-update after save.
7. Send the related quote.
8. Return to Estimates tab and confirm the estimate is locked with the correct message.
9. Try to save from an already-open calculator edit screen and confirm the save is rejected.
10. Confirm the drawing card shows plan and section views and module switching where relevant.

## Relevant current files

- `apps/portal/components/projects/ProjectPage/tabs/EstimatesTab.tsx`
- `apps/portal/components/projects/ProjectPage/tabs/EstimatesTab.module.css`
- `apps/portal/components/projects/ProjectPage/tabs/_components/EstimateVersionTabs.tsx`
- `apps/portal/app/staff/calculator/CalculatorGridClient.tsx`
- `apps/portal/app/staff/calculator/ModuleViewsCard.tsx`
- `apps/portal/app/staff/calculator/moduleViews.ts`
- `apps/portal/app/api/estimates/[estimateId]/route.ts`
- `apps/portal/app/api/projects/[projectId]/estimates/route.ts`
- `apps/portal/lib/estimates/types.ts`
- `apps/portal/lib/estimates/server.ts`
- `apps/portal/lib/quotes/serverCore.ts`
- `apps/portal/lib/quotes/serverEmail.ts`
