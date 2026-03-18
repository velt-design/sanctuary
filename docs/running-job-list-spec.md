# Running Job List Spec

## Goal

Build a spreadsheet-style running job list inside the portal that replaces the operational Excel sheet for active install jobs.

This page is an operations tool, not a project-detail variant. It should support:

- Fast scanning across all live running jobs
- Inline editing per cell
- Spreadsheet keyboard navigation
- Optimistic save with conflict detection
- Year grouping to match the current workbook mental model

## Route and Scope

### Route

- Portal page: `/staff/running-jobs`
- Add a dedicated sidebar item, not a tab inside project detail

Reason:

- The sheet is cross-project operational work
- It overlaps schedule, deposit, completion, ordering, and notes
- It needs its own spreadsheet interaction model that would be awkward inside the existing project page

### V1 scope

- Columns `A-S` only
- Year separators
- Excel-style sheet chrome with separate column-letter and row-number bands
- Sticky sheet chrome
- Frozen column `A` only
- Row numbers tied to canonical project order
- Sheet zoom controls with per-browser persistence
- Filler rows and columns for spreadsheet canvas continuity
- Single-cell edit
- Keyboard nav
- Optimistic updates
- Conflict indicator

### Explicitly out of scope for V1

- Bulk paste
- The extra Excel columns visible to the right of `S`
- A generic formula engine
- Legacy Excel data import
- Virtualization

If row count becomes a problem later, add virtualization after the interaction model is stable.

## Repo-specific findings

These matter because the running-job list cannot be designed as if the repo is greenfield.

### 1. Deposit/payment fields are half-scaffolded already

The portal already references:

- [`apps/portal/lib/types/project.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/lib/types/project.ts)
- [`apps/portal/app/staff/projects/[projectId]/ProjectDetailClient.tsx`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/app/staff/projects/[projectId]/ProjectDetailClient.tsx)

But `projectsRepo` is not reading or writing those fields yet:

- [`apps/portal/lib/repo/projectsRepo.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/lib/repo/projectsRepo.ts)

So this work should finish an existing path, not create a second one.

### 2. Sales reps do not have spreadsheet-friendly short labels

Current config only has `id` and `name`:

- [`apps/portal/src/config/salesPeople.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/src/config/salesPeople.ts)

The sheet uses compact codes in the cell. Add `shortLabel` or `initials`.

### 3. Crews also lack compact display codes

`schedule_crews` has name/color/sort order, but no short code. The sheet uses compact crew labels. Add `short_code text null` to `schedule_crews`.

### 4. `days_remaining` validation does not match the proposed sheet rule

The current API allows `0`:

- [`apps/portal/app/api/staff/v1/schedule/job/set-days-remaining/route.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/app/api/staff/v1/schedule/job/set-days-remaining/route.ts)

Your sheet spec says min `1`. Tighten the running-job rule and then align the schedule route.

### 5. The Excel `Estimated start date` column is currently overloaded

The screenshots show text like `On hold`, `March 2026`, `Engineers PS1`, `Council Consent`.

For the portal, do not keep that overload in column `H`.

Decision:

- `H` is a strict date cell only
- Non-date readiness states move to `Notes`
- If you need a first-class hold/readiness field later, add a separate column later

## Canonical ownership

The running-job list should not invent new sources for scheduling state.

### Existing sources to keep authoritative

- Contact identity and phone: `contacts`
- Site address and pipeline stage: `projects`
- Site visit rep: `site_visit_events`
- Assignment/start/duration/completion: `scheduled_jobs`
- Manual ordered flags: `project_task_checks`
- Derived product metadata: latest non-archived `estimates`

### New source to add

- `project_running_job_meta`

Use it only for:

- Manual lights status
- Notes

Do not copy schedule state into this table.

## Required schema changes

### 1. `projects`

Add:

- `deposit_paid_date date`
- `final_payment_date date`
- `deposit_amount_cents integer`

### 2. `project_running_job_meta`

Create:

```sql
create table if not exists public.project_running_job_meta (
  project_id uuid primary key references public.projects(id) on delete cascade,
  lights_status text null check (lights_status in ('No','Yes','TBC')),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_running_job_meta_notes_len check (notes is null or char_length(notes) <= 1000)
);
```

Add `set_updated_at()` trigger and RLS policy matching the other portal tables.

### 3. `project_task_checks`

Add `roofing_ordered` to the shared task definition union and validation in:

- [`apps/portal/lib/projects/pipelineDefinition.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/lib/projects/pipelineDefinition.ts)
- [`apps/portal/app/api/projects/[projectId]/tasks/route.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/app/api/projects/[projectId]/tasks/route.ts)

Put it under the `scheduled` stage with `order_materials`.

### 4. `schedule_crews`

Add:

- `short_code text null`

Use this for column `J` display and select options.

### 5. Sales config

Extend:

```ts
type SalesPerson = {
  id: string;
  name: string;
  shortLabel: string;
};
```

Use `shortLabel` for column `D`.

### 6. Current short-label roster

Use the following display codes wherever these people appear in the sales or crew lists:

- Alistair -> `AW`
- Jayden -> `JW`
- Jesse -> `JI`
- Jordan -> `JB`
- Steve -> `SC`
- Bruce -> `BB`
- David -> `DH`

If a person exists in both a sales config and a crew config, reuse the same short label.

### 7. Permissions

V1 permission rule:

- any authenticated staff user can edit any editable running-job-list cell

Field-level restrictions can be added later if finance or contact governance becomes tighter.

## Read model

## Recommendation

Do not build this from direct UI Supabase calls and do not use a SQL-only view as the primary implementation.

Use:

- One server API for the page read model
- TypeScript derivation helpers for estimate-based fields

Reason:

- Latest estimate JSON derivation is easier and safer in TS than in SQL
- The page needs multiple underlying tables anyway
- The portal already prefers API routes + React Query

### API

- `GET /api/staff/v1/running-jobs`

Response shape:

```ts
type RunningJobsResponse = {
  generatedAt: string;
  lookups: {
    crews: Array<{ id: string; name: string; shortCode: string | null; color: string | null; active: boolean }>;
    salesPeople: Array<{ id: string; name: string; shortLabel: string }>;
  };
  groups: Array<{
    year: number;
    rows: RunningJobRow[];
  }>;
};
```

Each row should include:

- Visible cell values
- Hidden IDs needed for writes
- `rowVersion`
- Underlying state needed for edit rules

```ts
type RunningJobRow = {
  projectId: string;
  contactId: string | null;
  siteVisitEventId: string | null;
  scheduledJobId: string | null;
  latestEstimateId: string | null;
  stage: 'SENT' | 'DEPOSIT' | 'SCHEDULED' | 'COMPLETED' | 'PAID' | string;
  sortDate: string | null;
  rowVersion: string;
  cells: {
    client_name: string;
    phone_number: string;
    site_address: string;
    site_visit_rep: string | null;
    deposit_paid_date: string | null;
    materials_ordered: boolean;
    pergola_type: string;
    estimated_start_date: string | null;
    final_payment_date: string | null;
    job_assigned_to: string | null;
    job_completed: boolean;
    lights_status: 'No' | 'Yes' | 'TBC';
    blinds_status: 'No' | 'Yes' | 'TBC';
    install_days: number | null;
    size_text: string;
    colour_text: string;
    roofing_text: string;
    roofing_ordered: boolean;
    running_notes: string;
  };
  derived: {
    pergola_type: string | null;
    lights_status: 'No' | 'Yes' | 'TBC';
    blinds_status: 'No' | 'Yes' | 'TBC';
    size_text: string | null;
    colour_text: string | null;
    roofing_text: string | null;
  };
};
```

### Inclusion rules

Include rows where:

- `projects.archived_at is null`
- and (`projects.pipeline_stage in ('SENT','DEPOSIT','SCHEDULED','COMPLETED','PAID')` or a `scheduled_jobs` row exists)

### Ordering rules

- Group by year from `estimated_start_date`
- Fallback year from `projects.created_at`
- Sort within year by `estimated_start_date nulls last`, then client name

## Derivation rules

Use the latest non-archived estimate with the same selection logic already used in schedule V2:

- [`apps/portal/lib/scheduling/scheduleV2Server.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/lib/scheduling/scheduleV2Server.ts)

### Latest estimate selection

- Prefer non-archived estimates
- Highest `version`
- Tie-break by newest `created_at`

### Client name

Read order:

1. `contacts.name`
2. latest estimate snapshot contact name
3. latest quote version `customer_name`
4. project name as last-resort display fallback

Write target:

- `contacts.name`

Important:

- this updates the shared contact, not only this project row

### Pergola type

Create a shared helper that maps calculator inputs to ops-friendly labels.

Suggested logic:

- If `jobType === 'commercial'`, prefix `Commercial`
- `gable` + `houseConnectionType === 'none'` => `Freestanding Gable`
- `pitched` + `invertedEnabled` => `Inverted Pitched`
- `gable` => `Pitched Pergola` only if that is what ops expects from current workbook labels, otherwise `Gable Pergola`
- `hip` => `Hipped Pergola`
- `hip_corner` => `Hipped Corner Pergola`

If this label logic is still fuzzy, keep it in one helper so ops can iterate on the wording without touching the page.

### Lights

V1 rule:

- `Lights` is manual-only
- store it in `project_running_job_meta.lights_status`
- default to `TBC` if unset

Future rule once calculator support exists:

- `manual value if present`
- else `derived from latest estimate`
- else `TBC`

Do not auto-overwrite an existing manual value when estimate support lands.

### Blinds

Derived status:

1. `Yes` if latest estimate has at least one meaningful blind item
2. `No` if a latest estimate exists and no meaningful blind item exists
3. `TBC` if there is no usable estimate

Reuse the same normalization rules already used by quote mapping instead of writing a second blind detector.

V1 edit rule:

- read-only on the running-job list

### Size

Derive from the first active module:

- Standard: `{length}x{projection}m`
- Hip corner: `A:{lengthA}x{spanA} B:{lengthB}x{spanB}m`

Display should be normalized without trailing zeros.

V1 edit rule:

- read-only on the running-job list

### Colour

Derive from module finish:

- If `powdercoatIsCustom`, show custom colour name
- Else if `extrusionColour === 'Mill'` and `powdercoatStandardColour` exists, show powdercoat colour
- Else show `extrusionColour`

V1 edit rule:

- read-only on the running-job list

### Roofing

Use estimate outputs, not free text, when possible.

Preferred derivation:

1. Build a short summary from grouped acrylic/roofing order lines in the same family already used by job pack output
2. Fallback to module roof material label

Current related source:

- [`apps/portal/lib/outputs/jobPack.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/lib/outputs/jobPack.ts)

V1 edit rule:

- read-only on the running-job list

## Write model

## Recommendation

Use one dedicated single-cell mutation endpoint for the running-job list.

Do not make the page directly orchestrate half a dozen unrelated APIs on its own.

### API

- `POST /api/staff/v1/running-jobs/cell`

Request:

```ts
type RunningJobCellMutationRequest = {
  projectId: string;
  rowVersion: string;
  key:
    | 'client_name'
    | 'phone_number'
    | 'site_address'
    | 'site_visit_rep'
    | 'deposit_paid_date'
    | 'materials_ordered'
    | 'estimated_start_date'
    | 'final_payment_date'
    | 'job_assigned_to'
    | 'job_completed'
    | 'lights_status'
    | 'install_days'
    | 'roofing_ordered'
    | 'running_notes';
  value: unknown;
};
```

Response:

```ts
type RunningJobCellMutationResponse = {
  ok: true;
  updatedRow: RunningJobRow;
};
```

### Row version rule

Each write must include `rowVersion`.

`rowVersion` should be a server-generated hash of the row’s current source timestamps and task state, for example:

- `projects.updated_at`
- `contacts.updated_at`
- `site_visit_events.updated_at`
- `scheduled_jobs.updated_at`
- `project_running_job_meta.updated_at`
- the completed state for `order_materials`, `roofing_ordered`, `job_complete`

On mismatch:

- Return `409`
- Include the fresh row payload

That gives you the conflict indicator required by the sheet UX.

## Per-column write behavior

### Safe direct writes

- `client_name` -> `contacts.name`
- `phone_number` -> `contacts.phone`
- `site_address` -> `projects.site_address`
- `deposit_paid_date` -> `projects.deposit_paid_date`
- `final_payment_date` -> `projects.final_payment_date`
- `lights_status` -> `project_running_job_meta.lights_status`
- `running_notes` -> `project_running_job_meta.notes`

These are editable by any staff user in V1.

### Manual task writes

- `materials_ordered` -> `project_task_checks(task_key='order_materials')`
- `roofing_ordered` -> `project_task_checks(task_key='roofing_ordered')`

### Site visit write

- `site_visit_rep` -> `site_visit_events.assigned_sales_owner_id`

This needs the row payload to include `siteVisitEventId`.

If a project does not yet have a `site_visit_events` row:

- editing `D` should create one in an unscheduled state, then assign the salesperson

### Schedule-owned writes

These should reuse schedule logic, not bypass it.

- `estimated_start_date`
- `job_assigned_to`
- `install_days`
- `job_completed`

Use the existing schedule mutation behavior as the source of truth:

- [`apps/portal/lib/repo/scheduleV2Repo.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/lib/repo/scheduleV2Repo.ts)
- [`apps/portal/app/api/staff/v1/schedule/job/assign/route.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/app/api/staff/v1/schedule/job/assign/route.ts)
- [`apps/portal/app/api/staff/v1/schedule/job/set-duration/route.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/app/api/staff/v1/schedule/job/set-duration/route.ts)
- [`apps/portal/app/api/staff/v1/schedule/job/set-days-remaining/route.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/app/api/staff/v1/schedule/job/set-days-remaining/route.ts)
- [`apps/portal/app/api/staff/v1/schedule/job/mark-in-progress/route.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/app/api/staff/v1/schedule/job/mark-in-progress/route.ts)
- [`apps/portal/app/api/staff/v1/schedule/job/mark-done/route.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/app/api/staff/v1/schedule/job/mark-done/route.ts)

If a project does not yet have schedule state:

- editing `J` should create the schedule row by assigning the job to a crew
- editing `H` requires a crew first
- editing `N` is disabled until a schedule row exists
- editing `K` is disabled until a schedule row exists

### Read-only quote-derived columns

These should be visible on the page but not editable in V1:

- `pergola_type`
- `blinds_status`
- `size_text`
- `colour_text`
- `roofing_text`

Reason:

- they come from the latest estimate
- changing them on this page would create a second source of truth for quote scope
- if these are wrong, the estimate should be corrected and the running-job row should refresh automatically

## Stage side effects

Keep these explicit.

### Forward-only automation rule

The running-job list can auto-advance stage as operational data becomes more complete:

- `SENT -> DEPOSIT`
- `DEPOSIT -> SCHEDULED`
- `SCHEDULED -> COMPLETED`
- `COMPLETED -> PAID`

V1 should not auto-roll stage backward when a user later clears a value or unticks a box.

If rollback is needed, keep it explicit and outside this page’s normal inline-edit flow.

### Deposit paid date (`E`)

If value becomes non-null and stage is `SENT`:

- set `projects.deposit_paid_date`
- call the same transition used by the existing deposit action route

Existing route:

- [`apps/portal/app/api/staff/v1/projects/[projectId]/action/mark_deposit_received/route.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/app/api/staff/v1/projects/[projectId]/action/mark_deposit_received/route.ts)

### Final payment date (`I`)

If value becomes non-null and stage is `COMPLETED`:

- set `projects.final_payment_date`
- call the existing mark-paid transition

Existing route:

- [`apps/portal/app/api/staff/v1/projects/[projectId]/action/mark_paid/route.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/app/api/staff/v1/projects/[projectId]/action/mark_paid/route.ts)

### Crew/date scheduling (`H` and `J`)

Recommended rule:

- Do not auto-transition on crew assignment alone
- If the project is `DEPOSIT` and the row ends up with both a crew and an estimated start date, auto-transition to `SCHEDULED`

Use the same transition as:

- [`apps/portal/app/api/staff/v1/projects/[projectId]/action/confirm_schedule/route.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/app/api/staff/v1/projects/[projectId]/action/confirm_schedule/route.ts)

This avoids schedule state existing while the pipeline still says `DEPOSIT`.

### Completed (`K`)

Recommended rule:

- `Y` calls schedule `mark-done`
- also upsert `project_task_checks(task_key='job_complete')` for backward compatibility with existing task UI
- if project stage is `SCHEDULED`, auto-transition to `COMPLETED`

Existing route:

- [`apps/portal/app/api/staff/v1/projects/[projectId]/action/mark_completed/route.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/app/api/staff/v1/projects/[projectId]/action/mark_completed/route.ts)

On uncheck:

- call schedule `mark-in-progress`
- clear `job_complete` manual task
- do not auto-rollback pipeline stage in V1

Reason:

- rollback semantics are more sensitive
- current rollback route is admin-oriented

## UI architecture

### Files

Suggested file layout:

- `apps/portal/app/staff/running-jobs/page.tsx`
- `apps/portal/app/staff/running-jobs/RunningJobsClient.tsx`
- `apps/portal/app/staff/projects/running-jobs/useRunningJobsSpreadsheetAdapter.tsx`
- `apps/portal/components/spreadsheet/SpreadsheetPageTemplate.tsx`
- `apps/portal/components/spreadsheet/useSpreadsheetShell.ts`
- `apps/portal/components/spreadsheet/spreadsheet.module.css`
- `apps/portal/lib/runningJobs/types.ts`
- `apps/portal/lib/runningJobs/columns.ts`
- `apps/portal/lib/runningJobs/derive.ts`
- `apps/portal/lib/runningJobs/writeOps.ts`
- `apps/portal/lib/queries/runningJobs.ts`
- `apps/portal/app/api/staff/v1/running-jobs/route.ts`
- `apps/portal/app/api/staff/v1/running-jobs/cell/route.ts`

### Column config

Define one shared `RUNNING_JOB_COLUMNS` array with:

- key
- header
- width
- cell type
- parse function
- validate function
- text alignment
- whether it is frozen

This prevents the UI and API from drifting on validation.

### Page composition

Use a single page with two vertical zones:

1. Toolbar
2. Main running-job grid

Toolbar should include:

- quick search
- year filter
- crew filter
- stage filter
- toggle for overdue only
- toggle for show completed
- sheet zoom controls

The main grid is the operational surface. Jobs that include blinds remain in the main list.

### Cell presentation

Use three clear visual treatments:

- editable ops cells: normal contrast, hover affordance
- schedule-owned cells: normal contrast plus schedule iconography/status hints
- quote-derived read-only cells: muted background plus small `Estimate` source pill

That gives operators a fast visual distinction between "safe to edit here" and "change upstream in estimate".

### Grid implementation

Use a purpose-built grid, not a generic data table abstraction.

Reason:

- Separate row-number and column-letter bands
- Frozen columns
- Spreadsheet keyboard rules
- Active-cell editing
- Optimistic cell state

### No virtualization in V1

Use a normal scroll container with:

- sticky column-letter band
- sticky row-number band
- sticky field-label header row
- sticky left offset for `A`

The interaction model is more important than premature scaling.

### Sheet chrome and numbering

- Remove the extra in-card title and descriptive copy from the page
- Add a dedicated top band for column letters
- Add a dedicated left band for row numbers
- Keep the field-label header in its own row below the letter band
- Keep a blank top-left corner cell where the two bands intersect
- Row numbers apply only to real rendered data rows
- Row numbers apply to live project rows and future visible legacy rows
- Year divider rows do not receive row numbers
- Filler rows do not receive row numbers
- Row numbering starts at `1`
- Row numbering reflects canonical full-sheet order before filtering
- Filtering does not renumber rows, so hidden rows create visible gaps

### Zoom and filler canvas

- Persist sheet zoom per browser
- Provide `-` and `+` controls
- Provide a zoom slider
- Provide preset zoom values: `50%`, `75%`, `100%`, `125%`, `150%`, `200%`
- Provide `Fit visible columns`
- Do not ship `Fit selection`
- Implement sheet zoom through shared sizing variables, not CSS transform scaling
- Treat trackpad pinch as progressive enhancement over the sheet area only
- Do not globally disable browser page zoom on this page
- When zooming out, render presentation-only filler rows and columns so the sheet still looks like a grid rather than blank page space
- Filler rows and columns are not selectable and have no backing data

## Interaction rules

### Navigation

- Click opens editable non-boolean cells; read-only and checkbox cells still select
- `Enter` or typing starts edit from the active cell
- `Tab` / `Shift+Tab` moves horizontally
- Arrow keys move selection
- `Escape` cancels edit

### Checkboxes

- Render as `Y` or blank
- `Enter`, `Space`, or double click toggles

### Select cells

- `D`: sales rep short label
- `J`: crew short code
- `L`: enum chips `No`, `Yes`, `TBC`

### Long text notes

- Inline single-line preview
- Expand editor on click, enter, direct type, or double click

### Row click behavior

- Clicking the client name opens project detail in a new tab or with modifier key
- Plain row/cell click should stay in-grid

## Colors

Use deterministic classes, not arbitrary manual coloring.

### Cell-level

- Overdue `estimated_start_date` on non-complete jobs: red tint
- `TBC`: amber tint
- `materials_ordered`, `roofing_ordered`, `job_completed` checked: green tint
- missing required enum (`L/M`) before save: red outline

### Row-level

- `DEPOSIT` with no crew/date: neutral brown tint
- `in_progress` job: yellow tint
- `COMPLETED`: blue tint
- `PAID`: stronger blue tint

Do not replicate every historical Excel color quirk if the rule is not derivable from data.

## Query caching and optimistic updates

Add a dedicated React Query key:

- `qk.runningJobs.list(host)`

Pattern should match existing query usage:

- [`apps/portal/lib/queries/projects.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/lib/queries/projects.ts)
- [`apps/portal/lib/queries/schedule.ts`](/Users/velt_mac/Documents/Projects/my-site/apps/portal/lib/queries/schedule.ts)

Optimistic behavior:

- update the target cell immediately
- mark cell as saving
- on success, replace row from server payload
- on conflict, restore current server row and show conflict marker

Because there is no bulk paste in V1, keep optimistic state strictly per-cell.

## Delivery plan

### Phase 1: schema and shared helpers

- add project payment columns
- add `project_running_job_meta`
- add `roofing_ordered`
- add crew short code
- add sales `shortLabel`
- create derivation helpers

### Phase 2: read-only page

- build `GET /api/staff/v1/running-jobs`
- build row grouping and frozen grid
- show derived values and year separators

### Phase 3: single-cell edits

- add mutation endpoint
- implement columns with direct table writes first: `A-F`, `I`, `L`, `R-S`
- wire optimistic updates and conflict state

### Phase 4: schedule-owned cells

- wire `H`, `J`, `K`, `N`
- surface schedule confirmation prompts
- add stage side effects

### Phase 5: polish

- add toolbar filters
- keyboard refinements
- color rules
- project link affordances

### Phase 6: legacy sheet import

- import the old Excel running-job list once
- store imported rows separately from live operational tables
- dedupe imported rows against live projects
- render remaining legacy rows inline, greyed, and read-only
- use `running_job_legacy_import_batches` and `running_job_legacy_rows`
- preserve a raw `A:S` snapshot plus a normalized display projection per imported row
- keep only one active import batch at a time
- default import workflow is:
  - place workbook in `tmp/running-jobs-legacy/`
  - run `npm run running-jobs:legacy-import` for a dry run
  - apply the migration
  - run `npm run running-jobs:legacy-import -- --apply`
- live running-job rows always win; matched legacy rows are suppressed, not merged into live records

## Testing

### Unit tests

- latest estimate selection
- derivation helpers for `G`, `M`, `O`, `P`, `Q`
- row inclusion and sorting
- cell parsing and validation

### Route tests

- read route returns expected rows
- mutation route updates correct source table
- stage side effects fire correctly
- rowVersion conflict returns `409`

### Manual QA

- assign crew then set date
- mark complete on early-finish job
- conflict from two tabs
- freeze columns under horizontal scroll
- confirm quote-derived cells are visibly read-only
- confirm shared contact edits update all linked project views

## Final recommendations

### Keep

- `scheduled_jobs` as the canonical schedule source
- estimate-derived quote fields as read-only in V1
- a dedicated page and dedicated read/write API

### Add before UI polish

- `schedule_crews.short_code`
- sales rep short labels
- conflict token support

### Do not do

- Do not store duplicated schedule values in `project_running_job_meta`
- Do not make quote-derived fields editable in V1
- Do not keep free-text pseudo-dates in column `H`
- Do not try to force this into the existing Projects index table
