# Running Jobs

Running Jobs is the portal replacement for the active install spreadsheet.

## Ownership

- Page route: `/staff/projects/running-jobs`.
- Redirect route: `/staff/running-jobs`.
- Client adapter: `apps/portal/app/staff/projects/running-jobs/useRunningJobsSpreadsheetAdapter.tsx`.
- Server/domain helpers: `apps/portal/lib/runningJobs`.
- Staff APIs: `apps/portal/app/api/staff/v1/running-jobs`.
- Specialist-fact command: `project_running_job_fact_command`.
- Legacy import script: `scripts/import-running-jobs-legacy.ts`.
- Phase 1 schema migration: `supabase/migrations/20260315_000001_running_job_list_phase1.sql`.
- Legacy import schema migration: `supabase/migrations/20260316_000001_running_job_legacy_import.sql`.
- Schema ownership map: `docs/supabase-schema-map.md`.

## Data Sources

Every live project row combines three source types:

- Manual running-job metadata from `project_running_job_meta`.
- Schedule-owned install state.
- Estimate-derived project/spec fields.

Keep these ownership boundaries explicit. Do not write estimate-derived fields from the spreadsheet.

Materials- and roofing-ordered truth for every live project is stored as timestamp/actor fields on `project_running_job_meta`. Install completion is derived only from Schedule status plus actual finish. Running Jobs does not read `project_task_checks`.

Unmatched rows from a historical spreadsheet import are a separate, read-only display source. Their preserved cell values do not become live project metadata, Schedule state, or specialist facts.

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

Use the domain write helpers in `apps/portal/lib/runningJobs/writeOps.ts`. Schedule-owned writes route through schedule-safe APIs/helpers rather than ad hoc table edits.

All live-project materials/roofing edits use the versioned `project_running_job_fact_command` RPC and its audit trail. Job-complete toggles invoke the Schedule owner for every live project. After Schedule confirms completion, the existing server-owned pre-V2 lifecycle action still advances a `SCHEDULED` project to `COMPLETED` and runs its completion automation; V2 uses its own state/reconciliation path. Neither branch writes a generic `job_complete` task. `project_task_checks` is neither a Running Jobs read source nor a write path.

## Legacy Import

Legacy spreadsheet import is handled by:

```bash
npm run running-jobs:legacy-import -- path/to/workbook.xlsx
```

The import script requires Supabase URL and service-role env. Treat imported legacy rows as transitional data and keep matching logic in `apps/portal/lib/runningJobs/legacy.ts`.
The script uses the portal-owned pipeline definition for stage normalization; the old root `lib/types` compatibility copies are retired.

Only unmatched rows from the active import batch are rendered as historical `source: "legacy"` rows. They remain distinct from live project rows and cannot supply or overwrite `project_running_job_meta`, Schedule completion, or a live specialist command.

## Spreadsheet Behavior

Running Jobs shares the spreadsheet shell with Drafting Queue. It should keep:

- The shared searchable staff header when rendered as a standalone route; embedded spreadsheet surfaces remain headerless.
- Frozen first column.
- Stable widths and zoom behavior.
- Optimistic edits with conflict handling.
- Clear distinction between manual, schedule, and estimate fields.

## Verification

```bash
npm run test:portal -- apps/portal/lib/runningJobs
npm run test:portal -- apps/portal/app/staff/projects/running-jobs
rg -n "project_task_checks" apps/portal/lib/runningJobs apps/portal/app/api/staff/v1/running-jobs --glob "!*.test.*"
npm run test:portal
```

The focused source scan should return no runtime matches.

Manual checks:

- Load `/staff/projects/running-jobs`.
- Edit manual text/date/checkbox/status fields.
- Confirm materials and roofing edits persist for both marked and unmarked live projects through the same versioned specialist-fact command.
- Edit supported schedule-owned fields and confirm schedule state remains consistent.
- Confirm completion follows Schedule status/actual finish and creates no task-check row.
- Confirm historical imported rows remain separate and read-only.
- Confirm estimate-derived fields are read-only.
- Refresh and confirm persisted values remain.
