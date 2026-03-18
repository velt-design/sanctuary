# Design Packages Spec

## Goal

Build a spreadsheet-style page inside the portal that replaces the operational Excel design list.

User-facing naming for the page is:

- `Design List`

Internal spec naming, internal module naming, and the initial route remain design-packages-aligned for implementation continuity.

This page is a cross-project operations tool. It should support:

- Fast scanning across current design work
- Explicit design requests tied to a specific estimate snapshot
- Inline editing for lightweight notes/status fields
- One visible row per project
- Revision history without losing which estimate each request came from

## Core Workflow

The old idea of creating design work from a stage transition is no longer the primary workflow.

The new rule is:

- design work is requested explicitly from an estimate
- every design request references a concrete `estimate_id`
- revisions are new design requests tied to later estimates
- the sheet flattens request history down to one visible project row

There are two request entry points:

1. Calculator estimate generation
2. Project estimates tab

## Route and Scope

### Route

- Portal page: `/staff/projects/design-packages`
- Sidebar label: `Design List`
- Page header title: `Design List`

Add a dedicated sidebar item under Projects, next to Running Jobs.

### V1 scope

- Spreadsheet-style page chrome matching the running-jobs interaction model
- One row per project
- Active design request per project
- Grouping by priority tier
- Inline notes/status editing
- Explicit request creation from estimate generation
- Explicit request creation from selected estimate in project detail
- Request history stored in a dedicated child table

### Explicitly out of scope for V1

- Bulk paste
- Multi-row selection
- Full audit/history browser inside the sheet
- Automatic designer assignment logic
- Automatic quote generation when design completes

## Repo-specific findings

These matter because the spec should fit the repo that exists, not an imagined greenfield app.

### 1. Current design ticket creation is stage-driven and project-level

Current `generate_cost_plan` flow:

- moves project stage from `SITE_VISIT` to `QUOTING`
- asks for a manual tier
- creates or updates a single `design_package_tickets` row

Relevant files:

- [`apps/portal/app/api/staff/v1/projects/[projectId]/action/generate_cost_plan/route.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/app/api/staff/v1/projects/[projectId]/action/generate_cost_plan/route.ts)
- [`apps/portal/lib/automation/AutomationRunner.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/lib/automation/AutomationRunner.ts)
- [`supabase/automation_phase_a.sql`](/Users/velt_mac/Documents/Projects/my-site/supabase/automation_phase_a.sql)

That is not sufficient for estimate-backed revisions because `design_package_tickets` enforces one row per project.

### 2. Estimates already give us the right immutable anchor

Estimate generation already creates an immutable snapshot and returns a persisted estimate record.

Relevant file:

- [`apps/portal/app/staff/calculator/CalculatorGridClient.tsx`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/app/staff/calculator/CalculatorGridClient.tsx)

This is the right place to optionally request design work immediately after estimate creation succeeds.

### 3. The estimates UI already has a natural request point

The current estimates UI already has quote actions tied to the selected estimate.

Relevant file:

- [`apps/portal/components/projects/ProjectPage/tabs/EstimatesTab.tsx`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/components/projects/ProjectPage/tabs/EstimatesTab.tsx)

This is the correct place to add `Request Design`.

### 4. Estimate totals already exist for tier derivation

Estimate totals are already available in estimate outputs.

Relevant files:

- [`apps/portal/lib/repo/quotesRepo.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/lib/repo/quotesRepo.ts)
- [`apps/portal/lib/types/quote.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/lib/types/quote.ts)

For design-request priority, use the selected estimate total inc GST, not a later quote total.

## Product decisions

### 1. Design requests are estimate-backed

Every new design request must reference:

- `project_id`
- `estimate_id`
- request version number

This applies to:

- initial request (`v1`)
- revision requests (`v2`, `v3`, etc.)

### 2. Stage change and design request are decoupled

Moving a project to `QUOTING` is no longer the thing that creates design work.

Instead:

- `generate_cost_plan` remains a stage/workflow action
- design request creation becomes explicit and estimate-backed

Locked decision:

- when the new estimate-backed flow ships, `generate_cost_plan` stops creating or updating design tickets
- remove the design-ticket creation side effect from `ui.action.generate_cost_plan`
- remove the manual tier prompt from that action

### 3. Use a child record as the canonical source

Create a new child table for design requests and revisions.

This becomes the canonical source for:

- which estimate was designed
- which revision is active
- historical request sequence per project
- priority at the time of request

### 4. `design_package_tickets` becomes legacy

Current project-level `design_package_tickets` should no longer be the canonical source for new work.

Locked decision:

- migration/backfill
- temporary read compatibility only while UI consumers are moved over
- never for new request creation after the new flow ships

## Canonical ownership

### Existing sources to keep authoritative

- Contact identity: `contacts`
- Project identity, address, pipeline stage: `projects`
- Site visit status/date: `site_visit_events`
- Estimate snapshot and pricing: `estimates`
- Quote sent state: `quotes` plus quote send logs

### New canonical source to add

- `design_package_requests`

Use it for:

- request versioning
- selected estimate reference
- request status
- priority tier snapshot
- request notes / designer notes
- due date
- designer assignment

Do not overload `tasks` as the primary source of design-request history.

Tasks can still be emitted for personal work queues later if useful, but the design list should not depend on task rows to reconstruct request history.

## Required schema changes

### 1. Create `design_package_requests`

Create a versioned child table:

```sql
create table if not exists public.design_package_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  estimate_id uuid null references public.estimates(id) on delete set null,
  request_version integer not null check (request_version > 0),
  status text not null default 'OPEN'
    check (status in ('OPEN','IN_PROGRESS','DONE','CANCELLED','BLOCKED')),
  priority_tier text not null
    check (priority_tier in ('TIER_1','TIER_2','TIER_3','TIER_4','UNPRICED')),
  price_total_inc_gst_cents integer null check (price_total_inc_gst_cents is null or price_total_inc_gst_cents >= 0),
  request_source text not null
    check (request_source in ('calculator_generate','estimates_tab','legacy_backfill')),
  request_note text null,
  designer_note text null,
  assigned_designer uuid null,
  due_at timestamptz null,
  requested_at timestamptz not null default now(),
  started_at timestamptz null,
  completed_at timestamptz null,
  cancelled_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint design_package_requests_unique_version unique (project_id, request_version),
  constraint design_package_requests_estimate_required_nonlegacy
    check (
      request_source = 'legacy_backfill'
      or estimate_id is not null
    )
);

create unique index if not exists design_package_requests_one_active_per_project
  on public.design_package_requests (project_id)
  where status in ('OPEN', 'IN_PROGRESS', 'BLOCKED');
```

Also add:

- index on `(project_id, requested_at desc)`
- index on `(status, priority_tier, due_at)`
- index on `(estimate_id)`
- `set_updated_at()` trigger
- RLS matching other portal tables

### 2. Recommended practical schema

The production-ready version should look like this in behavior:

- unique `(project_id, request_version)`
- partial unique open-request index
- nullable `estimate_id` only for legacy backfill rows
- all newly created rows require `estimate_id`

### 3. Backfill from `design_package_tickets`

Backfill existing project-level tickets into `design_package_requests`:

- `request_version = 1`
- `request_source = 'legacy_backfill'`
- `estimate_id = null`
- `priority_tier = existing tier`
- `status = existing status`
- `designer_note = existing notes`
- `due_at = existing due_at`

This preserves history while acknowledging that older rows may not have an estimate reference.

### 4. Deprecate new writes to `design_package_tickets`

After migration:

- stop creating new `design_package_tickets` rows
- stop updating it as the canonical design state
- only derive compatibility reads from `design_package_requests` if an old consumer still depends on project-level design state

## Tier rules

Tier is computed from the selected estimate total inc GST at request time.

Use:

- `estimate.outputs.totals.cost_inc_gst`

Store both:

- `price_total_inc_gst_cents`
- `priority_tier`

Do not recompute tier later from a newer quote or estimate. The request should retain the priority it had when it was requested.

### Thresholds

- `$0` to `< $12,000` => `TIER_4`
- `$12,000` to `< $24,000` => `TIER_3`
- `$24,000` to `< $48,000` => `TIER_2`
- `$48,000+` => `TIER_1`
- missing total => `UNPRICED`

## Request creation rules

### Initial request

If a project has no existing design requests:

- create `request_version = 1`

### Revision request

If a project has only terminal requests:

- create the next version number
- example: existing `v1 DONE` -> create `v2 OPEN`

### Open-request guardrail

If a project already has a request in:

- `OPEN`
- `IN_PROGRESS`
- `BLOCKED`

then do not create another request.

Return a conflict response and show the existing active request in the UI.

Reason:

- keeps the sheet at one active request per project
- avoids parallel v2/v3 confusion
- makes designer accountability clear

### Same-estimate repeat requests

Allow requesting a revision from the same estimate only via explicit confirmation in the request modal.

Reason:

- sometimes the user may want another design pass without generating a fresh estimate
- but this should be intentional, not accidental

## Permissions

V1 permission rule:

- any authenticated staff user can create a design request from an estimate
- any authenticated staff user can update V1 sheet-editable fields
- any authenticated staff user can mark a request in progress or done

Field-level restrictions can be added later if needed.

## Workflow entry points

## 1. Calculator estimate generation

### UI

Inside the existing generate-estimate confirmation modal, add a checkbox:

- `Request design package after generating this estimate`

Do not place the checkbox outside the modal.

Reason:

- the modal already contains the relevant confirmation affordances
- the estimate does not exist until generation succeeds
- it avoids a stray global toggle in the calculator surface

### Default behavior

- default unchecked
- do not persist across sessions

### Modal preview

When checked, show a compact preview:

- `This will create Design Request v1` or `v2`
- computed tier
- total inc GST
- selected project name

### Submit behavior

On success:

1. create the estimate
2. if checkbox is checked, create a design request using the returned `estimate.id`
3. redirect to the project estimates tab with the new estimate selected
4. show toast confirming both actions

If request creation fails after estimate succeeds:

- keep the estimate
- show a clear error that the estimate was created but the design request was not
- offer the user the estimates tab path to retry

## 2. Project estimates tab

### UI

Add a `Request Design` button in the estimate detail actions between:

- `View all quotes`
- `Create quote`

Relevant file:

- [`apps/portal/components/projects/ProjectPage/tabs/EstimatesTab.tsx`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/components/projects/ProjectPage/tabs/EstimatesTab.tsx)

### Modal

Clicking `Request Design` opens a modal for the currently selected estimate.

Modal contents:

- estimate version label
- estimate created date
- total inc GST
- computed tier
- active request version that will be created
- optional request note
- warning if the selected estimate matches a prior completed request

### Action label

If no prior requests exist:

- label remains `Request Design`

If prior terminal requests exist:

- modal subtitle should state this will create `Design Request v2`, `v3`, etc.

If an open request exists:

- disable creation
- show the active request state and linked estimate

### Legacy project detail parity

Locked decision:

- during rollout, add the same `Request Design` action to the older project detail estimates table as well
- the request modal behavior and validation must match the newer estimates tab

Relevant file:

- [`apps/portal/app/staff/projects/[projectId]/ProjectDetailClient.tsx`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/app/staff/projects/[projectId]/ProjectDetailClient.tsx)

## Read model

## Recommendation

Do not build the sheet straight from raw UI Supabase calls and do not read directly from `design_package_requests` in the client.

Use:

- one server API for the read model
- explicit server actions or API routes for mutations

Reason:

- the page flattens project + request + estimate + quote + site visit state
- active-request selection logic belongs on the server
- request creation must enforce per-project sequencing

### API

- `GET /api/staff/v1/design-packages`

Response shape:

```ts
type DesignPackagesResponse = {
  generatedAt: string;
  rows: DesignPackageRow[];
  lookups: {
    designers: Array<{
      id: string;
      label: string;
    }>;
  };
};
```

### Active request selection

For each project:

- choose the latest request in `OPEN`, `IN_PROGRESS`, or `BLOCKED`
- if no active request exists, choose the latest request overall only when history visibility is enabled

Default page behavior:

- show active requests only

### Row shape

```ts
type DesignPackageRow = {
  projectId: string;
  activeRequestId: string;
  activeEstimateId: string | null;
  requestVersion: number;
  requestStatus: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED' | 'BLOCKED';
  priorityTier: 'TIER_1' | 'TIER_2' | 'TIER_3' | 'TIER_4' | 'UNPRICED';
  priceTotalIncGstCents: number | null;
  requestedAt: string;
  dueAt: string | null;
  rowVersion: string;
  cells: {
    date: string | null;
    quote_name: string;
    design_ready: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED' | 'CANCELLED';
    priority: string;
    sent: string | null;
    visited: string | null;
    notes: string;
  };
  state: {
    estimateVersionLabel: string | null;
    latestMatchingQuoteId: string | null;
    latestMatchingQuoteSentAt: string | null;
    latestSiteVisitCompletedAt: string | null;
    hasOpenRequest: boolean;
  };
};
```

### Important sent-state rule

`Sent` should not be project-global.

Use the latest quote whose `sourceEstimateId` matches the active request `estimate_id`.

This is locked for V1 because project-wide quote sent state becomes ambiguous once revisions exist.

## Page behavior

### Row grain

- one visible row per project

### Grouping

- group rows by `priority_tier`

Recommended order:

1. `TIER_1`
2. `TIER_2`
3. `TIER_3`
4. `TIER_4`
5. `UNPRICED`

### Sorting inside group

Sort by:

1. overdue due date first
2. request status urgency
3. requested date ascending
4. quote/project name

### Visible columns

Use the spreadsheet columns the team already understands:

- `Date`
- `Quote name`
- `Design Ready`
- `Priority`
- `Sent`
- `Visited`
- `Notes`

### Request version visibility

Do not add a full extra column for request version in V1.

Instead:

- show a compact badge inside `Quote name`
- example: `v2 • Est v5`

Reason:

- keeps the sheet close to the current Excel mental model
- still makes revisions explicit

## Mutations

### Create request

- `POST /api/staff/v1/design-packages/request`

Body:

```ts
{
  projectId: string;
  estimateId: string;
  requestNote?: string;
  source: 'calculator_generate' | 'estimates_tab';
}
```

Behavior:

- validate project and estimate ownership
- compute next request version
- compute tier from selected estimate
- enforce no active request conflict
- insert request
- return created request plus refreshed row payload

### Mark request done

- `POST /api/staff/v1/design-packages/[requestId]/action/mark_done`

Behavior:

- set status `DONE`
- set `completed_at`
- refresh row payload

### Set request in progress

- `POST /api/staff/v1/design-packages/[requestId]/action/start`

Behavior:

- set status `IN_PROGRESS`
- set `started_at` if empty

### Update notes

- `POST /api/staff/v1/design-packages/cell`

Editable in V1:

- `notes`
- `design_ready`

### Optional later actions

Out of scope for first cut, but good follow-ons:

- block request
- cancel request
- reassign designer

## Running Jobs UI parity

This section is locked and overrides any earlier conflicting UI guidance in this document.

The backend and automation for `Design List` are different from `Running Jobs`, but the page shell must be visually and behaviorally the same spreadsheet viewer.

### Core requirement

The `Design List` page must reuse the running-jobs spreadsheet experience, not just the idea of a data grid.

That means parity with:

- [`apps/portal/app/staff/projects/running-jobs/RunningJobsClient.tsx`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/app/staff/projects/running-jobs/RunningJobsClient.tsx)
- [`apps/portal/app/staff/projects/running-jobs/useRunningJobsSpreadsheetAdapter.tsx`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/app/staff/projects/running-jobs/useRunningJobsSpreadsheetAdapter.tsx)
- [`apps/portal/components/spreadsheet/SpreadsheetPageTemplate.tsx`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/components/spreadsheet/SpreadsheetPageTemplate.tsx)
- [`apps/portal/components/spreadsheet/useSpreadsheetShell.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/components/spreadsheet/useSpreadsheetShell.ts)
- [`apps/portal/components/spreadsheet/spreadsheet.module.css`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/components/spreadsheet/spreadsheet.module.css)
- [`apps/portal/lib/runningJobs/columns.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/lib/runningJobs/columns.ts)
- [`apps/portal/lib/runningJobs/group.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/lib/runningJobs/group.ts)
- [`apps/portal/lib/runningJobs/editing.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/lib/runningJobs/editing.ts)

### Explicitly required parity

- full-height spreadsheet canvas
- sticky column-letter band
- sticky row-number band
- frozen leading columns where needed
- filler rows and filler columns so the sheet still looks continuous when sparse
- same keyboard navigation model
- same active-cell focus behavior
- same zoom controls and zoom persistence behavior
- same top toolbar structure and placement
- same viewport-locked shell treatment as Running Jobs

### Explicitly not acceptable

- stacked cards by tier
- bespoke list/table layout
- standalone row action buttons as the primary editing affordance
- a different zoom pattern or a separate design-list-specific control layout

## UI architecture

### Page implementation direction

`Design List` should be implemented as a design-specific adapter over the running-jobs spreadsheet shell.

The correct approach is:

- reuse the running-jobs viewer shell and interaction model
- swap in design-list columns, grouping, filters, and mutations
- keep the read model and write logic design-specific

Do not build a second custom page layout and do not try to genericize both pages into one abstract framework before parity is achieved.

### Files

Primary design-list files:

- `apps/portal/app/staff/projects/design-packages/page.tsx`
- `apps/portal/app/staff/projects/design-packages/DesignPackagesClient.tsx`
- `apps/portal/app/staff/projects/design-packages/useDesignListSpreadsheetAdapter.tsx`
- `apps/portal/components/spreadsheet/SpreadsheetPageTemplate.tsx`
- `apps/portal/components/spreadsheet/useSpreadsheetShell.ts`
- `apps/portal/components/spreadsheet/spreadsheet.module.css`
- `apps/portal/lib/designPackages/types.ts`
- `apps/portal/lib/designPackages/columns.ts`
- `apps/portal/lib/designPackages/group.ts`
- `apps/portal/lib/designPackages/editing.ts`
- `apps/portal/lib/designPackages/server.ts`
- `apps/portal/lib/designPackages/writeOps.ts`
- `apps/portal/lib/queries/designPackages.ts`
- `apps/portal/app/api/staff/v1/design-packages/route.ts`
- `apps/portal/app/api/staff/v1/design-packages/cell/route.ts`
- `apps/portal/app/api/staff/v1/design-packages/request/route.ts`
- `apps/portal/app/api/staff/v1/design-packages/[requestId]/action/mark_done/route.ts`

Supporting parity targets from Running Jobs:

- `apps/portal/app/staff/projects/running-jobs/RunningJobsClient.tsx`
- `apps/portal/app/staff/projects/running-jobs/useRunningJobsSpreadsheetAdapter.tsx`
- `apps/portal/components/spreadsheet/SpreadsheetPageTemplate.tsx`
- `apps/portal/components/spreadsheet/useSpreadsheetShell.ts`
- `apps/portal/components/spreadsheet/spreadsheet.module.css`
- `apps/portal/lib/runningJobs/columns.ts`
- `apps/portal/lib/runningJobs/group.ts`
- `apps/portal/lib/runningJobs/editing.ts`
- `apps/portal/components/layout/PortalShell.tsx`

User-facing labels inside this area should use `Design List`, but file and route naming can remain `design-packages` for implementation continuity.

### Implementation note

The shared spreadsheet shell now lives under `apps/portal/components/spreadsheet/`; design-list-specific UI changes should usually land in the adapter hook or design-package domain files, not in a page-local layout.

The end state is:

- `Design List` opens into the same spreadsheet viewer shell as `Running Jobs`
- only the row data, columns, filters, grouping labels, and mutation handlers differ

## Spreadsheet shell mapping

### Toolbar

The toolbar must match the Running Jobs structure and order.

Use the same layout shape:

1. search field
2. dropdown filter 1
3. dropdown filter 2
4. dropdown filter 3
5. overdue checkbox
6. show completed checkbox
7. count pill
8. generated-at pill

Map the controls to design-list semantics as follows:

- Search: quote name, client name, project name, address, notes
- Filter 1: `All years` using `requested_at`
- Filter 2: `All designers` using `assigned_designer` with `Unassigned`
- Filter 3: `All statuses` using request status
- Overdue only: `due_at < today` and status not terminal
- Show completed: include `DONE` and `CANCELLED`

Do not replace these with tier-specific bespoke controls in the top bar.

### Grouping rows

Reuse the same group-row treatment as Running Jobs, but use tier groups instead of year groups.

Required order:

1. `TIER_1`
2. `TIER_2`
3. `TIER_3`
4. `TIER_4`
5. `UNPRICED`

### Columns

The visible spreadsheet columns should be:

- `Date`
- `Quote name`
- `Design Ready`
- `Priority`
- `Sent`
- `Visited`
- `Notes`

The sheet may contain hidden backing metadata such as `requestId`, `estimateId`, `requestVersion`, and row version, but those are not visible spreadsheet columns.

### Column behavior

- `Date`: read-only, sourced from `requested_at`
- `Quote name`: read-only, opens project detail on explicit navigation intent
- `Design Ready`: editable spreadsheet cell backed by request status transitions
- `Priority`: read-only derived from stored request tier
- `Sent`: read-only and estimate-scoped, not project-global
- `Visited`: read-only in V1 unless an explicit manual override requirement is added later
- `Notes`: editable spreadsheet cell backed by `designer_note`

### Design Ready interaction

`Design Ready` should not primarily be a standalone button-based workflow.

It should behave like a spreadsheet-editable state cell using the same editor model as Running Jobs:

- blank or open state
- in-progress state
- done state
- blocked state if needed

The exact visual treatment can differ by cell content, but the interaction style should remain spreadsheet-native.

### Notes interaction

`Notes` must use the same inline editing pattern as Running Jobs:

- one click opens editable cells
- editor still opens on enter, direct type, or double click
- optimistic save
- row-version conflict handling

## Zoom and viewport requirements

### Zoom

Reuse the running-jobs zoom model exactly:

- minus button
- slider
- plus button
- percent selector
- `Fit visible columns`

Parity requirement:

- same control order
- same location
- same persistence behavior
- same sheet sizing strategy

Do not substitute CSS transform page zoom or a design-list-specific footer.

### Viewport lock

`Design List` must be added to the same viewport-locked route handling used by Running Jobs in:

- [`apps/portal/components/layout/PortalShell.tsx`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/components/layout/PortalShell.tsx)

This is required so the page feels like the same full-screen worksheet instead of a normal scrolling content page.

## Mutation architecture for parity

### Read route

Keep:

- `GET /api/staff/v1/design-packages`

The response should support spreadsheet rendering, not card rendering.

Recommended response shape:

- flat rows plus design-list lookups and generated timestamp
- grouping can happen client-side using design-list group helpers, matching Running Jobs

### Cell mutation route

For sheet parity, the page should use a dedicated cell mutation route:

- `POST /api/staff/v1/design-packages/cell`

This route should own:

- `design_ready` changes
- `notes` changes

Reason:

- this keeps mutation behavior aligned with the running-jobs sheet pattern
- it centralizes normalization, validation, and row conflict handling
- it avoids bespoke button flows in the client

### Conflict behavior

Conflict handling should match Running Jobs:

- include `rowVersion` in editable mutations
- return `409` with the current row when stale
- show the same reload/replace-user-value pattern already established in Running Jobs

## Repo implementation notes

### Recommended frontend build order

1. Freeze the running-jobs shell parity requirements in this spec.
2. Extract or copy the spreadsheet shell pieces from Running Jobs into design-list-specific files.
3. Implement design-list columns and grouping adapters.
4. Implement `GET /api/staff/v1/design-packages` in the row shape needed by the spreadsheet shell.
5. Implement `POST /api/staff/v1/design-packages/cell`.
6. Wire request status and notes editing through the sheet.
7. Add zoom, viewport lock, and toolbar parity polish last only if not already inherited automatically.

### File targets

Minimum frontend files expected to change for parity work:

- [`apps/portal/app/staff/projects/design-packages/DesignPackagesClient.tsx`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/app/staff/projects/design-packages/DesignPackagesClient.tsx)
- [`apps/portal/app/staff/projects/design-packages/useDesignListSpreadsheetAdapter.tsx`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/app/staff/projects/design-packages/useDesignListSpreadsheetAdapter.tsx)
- [`apps/portal/components/spreadsheet/SpreadsheetPageTemplate.tsx`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/components/spreadsheet/SpreadsheetPageTemplate.tsx)
- [`apps/portal/components/spreadsheet/useSpreadsheetShell.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/components/spreadsheet/useSpreadsheetShell.ts)
- [`apps/portal/components/spreadsheet/spreadsheet.module.css`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/components/spreadsheet/spreadsheet.module.css)
- [`apps/portal/lib/designPackages/columns.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/lib/designPackages/columns.ts)
- [`apps/portal/lib/designPackages/group.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/lib/designPackages/group.ts)
- [`apps/portal/lib/designPackages/editing.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/lib/designPackages/editing.ts)
- [`apps/portal/app/api/staff/v1/design-packages/route.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/app/api/staff/v1/design-packages/route.ts)
- [`apps/portal/app/api/staff/v1/design-packages/cell/route.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/app/api/staff/v1/design-packages/cell/route.ts)
- [`apps/portal/components/layout/PortalShell.tsx`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/components/layout/PortalShell.tsx)

Reference files to follow closely:

- [`apps/portal/app/staff/projects/running-jobs/RunningJobsClient.tsx`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/app/staff/projects/running-jobs/RunningJobsClient.tsx)
- [`apps/portal/app/staff/projects/running-jobs/useRunningJobsSpreadsheetAdapter.tsx`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/app/staff/projects/running-jobs/useRunningJobsSpreadsheetAdapter.tsx)
- [`apps/portal/components/spreadsheet/SpreadsheetPageTemplate.tsx`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/components/spreadsheet/SpreadsheetPageTemplate.tsx)
- [`apps/portal/components/spreadsheet/useSpreadsheetShell.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/components/spreadsheet/useSpreadsheetShell.ts)
- [`apps/portal/components/spreadsheet/spreadsheet.module.css`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/components/spreadsheet/spreadsheet.module.css)
- [`apps/portal/lib/runningJobs/columns.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/lib/runningJobs/columns.ts)
- [`apps/portal/lib/runningJobs/group.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/lib/runningJobs/group.ts)
- [`apps/portal/lib/runningJobs/editing.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/lib/runningJobs/editing.ts)

## Colors

Use deterministic state-based classes consistent with the spreadsheet tone already established in Running Jobs:

- `TIER_1`: strongest priority tint
- `TIER_2`: medium-high priority tint
- `TIER_3`: medium tint
- `TIER_4`: low urgency tint
- overdue due date: red tint
- `IN_PROGRESS`: amber tint
- `DONE`: blue or green tint
- `BLOCKED`: muted red or brown tint

## Project page changes

### Calculator

Update the estimate generation modal in:

- [`apps/portal/app/staff/calculator/CalculatorGridClient.tsx`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/app/staff/calculator/CalculatorGridClient.tsx)

Changes:

- add request-design checkbox
- show tier preview when checked
- call request API after estimate creation succeeds

### Estimates tab

Update:

- [`apps/portal/components/projects/ProjectPage/tabs/EstimatesTab.tsx`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/components/projects/ProjectPage/tabs/EstimatesTab.tsx)

Changes:

- add `Request Design` button beside quote actions
- add request modal bound to selected estimate
- keep this action available to normal staff users

### Stage action cleanup

Update:

- [`apps/portal/app/api/staff/v1/projects/[projectId]/action/generate_cost_plan/route.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/app/api/staff/v1/projects/[projectId]/action/generate_cost_plan/route.ts)
- [`apps/portal/lib/automation/AutomationRunner.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/lib/automation/AutomationRunner.ts)

Changes:

- stop creating design tickets from `generate_cost_plan`
- stop asking the user for a manual tier there

## Delivery plan

### Phase 1: schema and migration

- create `design_package_requests`
- backfill from `design_package_tickets`
- add indexes and RLS

### Phase 2: request creation flow

- add request API
- wire calculator checkbox
- wire estimates-tab modal
- enforce active-request guardrail

### Phase 3: read-only design packages page

- build `GET /api/staff/v1/design-packages`
- replace the temporary custom layout with the running-jobs spreadsheet shell
- render tier group rows inside that shell
- match toolbar, zoom, row-number, and column-letter behavior to Running Jobs

### Phase 4: inline edits and request actions

- build `POST /api/staff/v1/design-packages/cell`
- notes editing
- design-ready state editing
- running-jobs-style conflict handling
- remove bespoke row button dependence from the main sheet interaction

### Phase 5: migration cleanup

- switch project detail consumers away from `design_package_tickets`
- remove automatic ticket creation from old automation path
- leave `design_package_tickets` as legacy/backfill data only

## Testing

### Unit tests

- tier derivation from estimate total
- next request version selection
- active request selection per project
- quote sent lookup by matching `sourceEstimateId`

### Route tests

- request creation from selected estimate
- conflict when active request already exists
- mark done action
- read route flattening

### Manual QA

- generate estimate with checkbox off
- generate estimate with checkbox on
- request design from existing estimate
- request `v2` after `v1 DONE`
- attempt request while `v1 OPEN`
- confirm `Design List` uses the same spreadsheet shell as `Running Jobs`
- confirm toolbar control count, order, and placement match `Running Jobs`
- confirm zoom controls and `Fit visible columns` behave the same as `Running Jobs`
- confirm design sheet row shows `vN • Est vM`
- confirm `Sent` only reflects quotes created from the active request estimate

## Final recommendations

### Keep

- estimates as the immutable design anchor
- the running-jobs sheet interaction model
- one visible project row in the design sheet

### Change

- stop using stage transition as the primary design-request trigger
- stop using one project-level ticket row as the canonical model
- move to explicit estimate-backed request creation with request history

### Locked implementation decisions

- UI label and page title are `Design List`
- route remains `/staff/projects/design-packages` for the initial implementation
- new request creation never writes to `design_package_tickets`
- `design_package_requests` is the canonical source for all new design work
- only one active request is allowed per project
- `Sent` is matched against the active request estimate, not the whole project
- both the new estimates tab and the older project detail estimates table get `Request Design` during rollout

### Locked UI copy

For the calculator checkbox, use:

- `Request design package after generating this estimate`

Do not use:

- `Create design package ticket`

Reason:

- it describes the real sequence
- it is clearer that the estimate must be created first
