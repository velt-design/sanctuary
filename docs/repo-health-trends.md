# Repo Health Trends

Status: Advisory dashboard.

Audience: agents and maintainers.

Purpose: track whether cleanup pressure is trending better or worse over time. These numbers are visibility signals, not enforcement thresholds.

## Read First

- Use this dashboard before cleanup, readiness, or architecture-health work.
- Run `npm run repo:health` for the current snapshot.
- Run `npm run repo:health:update` only when you intentionally want to record a dated snapshot, usually after a cleanup or readiness pass.
- Do not wire snapshot updates into lint, tests, or routine CI; the dashboard is manual and advisory.
- The command output compares headline metrics against the previous dated snapshot and the first dated baseline row.
- Direction labels are advisory: `better` means the debt count went down, `flat` means unchanged, `worse` means it went up, and `new` means there is no comparison row.

## Metrics

- Dead-code delete candidates: delete-candidate count from `npm run dead-code:report`.
- Dead-code legacy retirement: legacy-retirement count from `npm run dead-code:report`.
- Critical files: critical count from `npm run files:report`.
- Warning files: warning count from `npm run files:report`.
- Root compat files: legacy-compatible count from `npm run root:compat`.
- Browser-direct Supabase: legacy-direct count from `npm run browser:supabase`.

## Interpretation

The headline output recommends a next cleanup lane from the worst movement among the headline metrics:

- Dead-code delete candidates -> dead-code cleanup.
- Critical files -> large-file decomposition.
- Root compat files -> root compatibility retirement.
- Browser-direct Supabase -> browser data-access migration.

If no headline metric is worse than the available comparison snapshots, choose the current highest-priority cleanup lane manually.

## Trend

| Date | Dead-code delete candidates | Dead-code legacy retirement | Critical files | Warning files | Root compat files | Browser-direct Supabase |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-05-03 | 619 | 211 | 30 | 43 | 134 | 7 |

## Usage

- Run `npm run repo:health` to print the current advisory snapshot.
- Run `npm run repo:health:update` to record or replace today's row.
- Snapshot updates are manual by design; do not treat them as a required lint or test step.
- Use the slope to choose cleanup lanes; do not treat a single number as proof that code is safe to delete.

## Automated Drift Warning

A weekly read-only check at `.github/workflows/repo-health-drift.yml` runs `npm run repo:health` against the live tree and the most recent dated snapshot above. If any headline metric reports `worse`, the workflow fails with a "drift advisory" so cumulative incremental changes between manual snapshots become visible. The workflow never updates the snapshot table — it only reads it. Cron is Monday 09:00 UTC; manual runs are available via `workflow_dispatch`.

To clear a drift advisory: pick the recommended cleanup lane, do the work, then run `npm run repo:health:update` locally to record the new dated baseline.
