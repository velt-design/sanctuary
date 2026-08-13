# Running Jobs

Running Jobs is the portal replacement for the active install spreadsheet.

## Ownership

- Page route: `/staff/projects/running-jobs`.
- Redirect route: `/staff/running-jobs`.
- Client adapter: `apps/portal/app/staff/projects/running-jobs/useRunningJobsSpreadsheetAdapter.tsx`.
- Server/domain helpers: `apps/portal/lib/runningJobs`.
- Staff APIs: `apps/portal/app/api/staff/v1/running-jobs`.
- V2 specialist-fact command: `project_running_job_fact_command`.
- Legacy import script: `scripts/import-running-jobs-legacy.ts`.
- Phase 1 schema migration: `supabase/migrations/20260315_000001_running_job_list_phase1.sql`.
- Legacy import schema migration: `supabase/migrations/20260316_000001_running_job_legacy_import.sql`.
- Schema ownership map: `docs/supabase-schema-map.md`.

## Data Sources

Running Jobs combines three source types:

- Manual running-job metadata.
- Schedule-owned install state.
- Estimate-derived project/spec fields.

Keep these ownership boundaries explicit. Do not write estimate-derived fields from the spreadsheet.

Materials- and roofing-ordered truth is stored as timestamp/actor fields on `project_running_job_meta`; install completion is derived only from Schedule V2 status plus actual finish. The portfolio rollout migration backfills existing materials/roofing facts into `project_running_job_meta`, and the legacy project-task fallback is retired.

## Columns

Column config lives in `apps/portal/lib/runningJobs/columns.ts`.

Manual editable fields include client details, site visit rep, deposit/final payment dates, materials ordered, lights status, roofing ordered, and notes.

Schedule-owned editable fields include estimated start, crew, completed, install days, and days/state that are backed by schedule APIs.

Estimate-derived read-only fields include pergola type, blinds, size, colour, and roofing.

## Write Behavior

Read route:

```text
GET /api/staff/v1/running-jobs
```

The read model may span hundreds of projects. Related-table lookups use `fetchRowsByIdChunks()` from `apps/portal/lib/list/listLimits.ts`; do not replace those bounded filters with one inventory-wide PostgREST `.in(...)` URL.

Cell write route:

```text
POST /api/staff/v1/running-jobs/cell
```

Use the domain write helpers in `apps/portal/lib/runningJobs/writeOps.ts`. Schedule-owned writes should route through schedule-safe APIs/helpers rather than ad hoc table edits.

Materials/roofing edits use the versioned Running Jobs RPC and audit trail for every live project. A job-complete toggle invokes the Schedule owner and does not write a generic `job_complete` task; Schedule remains the authoritative completion source. The portfolio rollout migration performs the one-time materials/roofing facts backfill into Running Jobs metadata.

Deposit paid and Final paid dates are compatibility projections. Staff record, correct, allocate, reverse, mark paid, or void commercial records from the project Invoices tab. Entering a Running Jobs date may request the matching operational transition only after the command verifies the whole invoice/payment ledger; the typed value cannot create payment truth or bypass it. Project completion and paid-state commands verify current accepted value, the net payment ledger, and whole open invoices.

## Legacy Import

Legacy spreadsheet import is handled by:

```bash
npm run running-jobs:legacy-import -- path/to/workbook.xlsx
```

The import script requires Supabase URL and service-role env. Treat imported legacy rows as transitional data and keep matching logic in `apps/portal/lib/runningJobs/legacy.ts`.
The script uses the portal-owned pipeline definition for stage normalization; the old root `lib/types` compatibility copies are retired.

## Spreadsheet Behavior

Running Jobs shares the spreadsheet shell with Drafting Queue. It should keep:

- A truthful Running Jobs frame immediately on warm portal navigation, with
  the exact route chunk preloaded only from intent and the route-owned
  current-user list query settling behind that frame.
- The shared searchable staff header when rendered as a standalone route; embedded spreadsheet surfaces remain headerless.
- Frozen first column.
- Stable widths and zoom behavior.
- Optimistic edits with conflict handling.
- Clear distinction between manual, schedule, and estimate fields.

## Verification

```bash
npm run test:portal -- apps/portal/lib/runningJobs
npm run test:portal -- apps/portal/app/staff/projects/running-jobs
npm run test:portal
```

Manual checks:

- Load `/staff/projects/running-jobs`.
- Edit manual text/date/checkbox/status fields.
- Edit supported schedule-owned fields and confirm schedule state remains consistent.
- Confirm estimate-derived fields are read-only.
- Refresh and confirm persisted values remain.
