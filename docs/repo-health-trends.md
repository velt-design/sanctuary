# Repo Health Trends

Status: Advisory dashboard.

Audience: agents and maintainers.

Purpose: track whether cleanup pressure is trending better or worse over time. These numbers are visibility signals, not enforcement thresholds.

## Read First

- Use this dashboard before cleanup, readiness, or architecture-health work.
- Run `npm run repo:health` for the current snapshot.
- Run `npm run repo:health:update` only when you intentionally want to record a dated snapshot, usually after a cleanup or readiness pass.
- Do not wire snapshot updates into lint, tests, or routine CI; the dashboard is manual and advisory.

## Metrics

- Dead-code delete candidates: delete-candidate count from `npm run dead-code:report`.
- Dead-code legacy retirement: legacy-retirement count from `npm run dead-code:report`.
- Critical files: critical count from `npm run files:report`.
- Warning files: warning count from `npm run files:report`.
- Root compat files: legacy-compatible count from `npm run root:compat`.
- Browser-direct Supabase: legacy-direct count from `npm run browser:supabase`.

## Trend

| Date | Dead-code delete candidates | Dead-code legacy retirement | Critical files | Warning files | Root compat files | Browser-direct Supabase |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-05-03 | 567 | 111 | 30 | 43 | 134 | 7 |

## Usage

- Run `npm run repo:health` to print the current advisory snapshot.
- Run `npm run repo:health:update` to record or replace today's row.
- Snapshot updates are manual by design; do not treat them as a required lint or test step.
- Use the slope to choose cleanup lanes; do not treat a single number as proof that code is safe to delete.
