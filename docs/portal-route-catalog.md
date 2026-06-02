# Portal Route Catalog

Status: Active.

Purpose: give agents one source of truth for portal routes, required access, owner docs, data needs, and browser-smoke status.

Executable source: `playwright/support/portalRouteCatalog.ts`.

## How To Use

- Add or update route metadata in `playwright/support/portalRouteCatalog.ts`.
- Keep this doc aligned when route categories, smoke policy, or ownership changes.
- Browser smoke specs should consume catalog subsets such as `agentAccessSmokeRoutes` and `agentScenarioSmokeRoutes`; do not create new hardcoded route lists.
- Dynamic project, estimate, quote, and workbench routes are backed by explicit local/staging scenarios before they run in browser smoke.

## Smoke Statuses

| Status | Meaning |
| --- | --- |
| `agent-access` | Runs with the default staff portal-agent account. |
| `scenario-required` | Needs seeded IDs or known scenario data before it can run reliably. |
| `admin-only` | Requires admin credentials or admin storage state. |
| `fixture-only` | Runs only in a gated fixture/debug environment. |
| `catalog-only` | Known route, not yet part of a browser smoke lane. |

## Debug Export Statuses

| Status | Meaning |
| --- | --- |
| `exported` | The route exposes the shared gated page debug export contract. |
| `planned` | The route should expose the contract after a safe seeded scenario or owner-specific payload is added. |
| `not-applicable` | The route is simple enough that route smoke and browser evidence are sufficient for now. |

## Current Catalog

| Id | Route Pattern | Category | Role | Data Need | Smoke Status | Debug Export | Owner Doc |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `dashboard` | `/dashboard` | core | staff | none | agent-access | not-applicable | `docs/platform-workflow.md` |
| `projects-index` | `/staff/projects` | project | staff | visible_project | agent-access | not-applicable | `docs/projects-contacts-estimates-calculator.md` |
| `contacts-index` | `/staff/contacts` | project | staff | none | agent-access | not-applicable | `docs/projects-contacts-estimates-calculator.md` |
| `schedule` | `/staff/schedule` | schedule | staff | none | agent-access | planned | `docs/schedule.md` |
| `project-detail` | `/staff/projects/:projectId` | project | staff | project_id | scenario-required | exported | `docs/projects-contacts-estimates-calculator.md` |
| `estimate-detail` | `/staff/projects/:projectId/estimate/:estimateId` | commercial | staff | estimate_id | scenario-required | exported | `docs/projects-contacts-estimates-calculator.md` |
| `quote-detail` | `/staff/projects/:projectId/quotes/:quoteId` | commercial | staff | quote_id | scenario-required | exported | `docs/quotes-invoices-job-packs.md` |
| `design-workbench` | `/staff/projects/:projectId/design-workbench` | workbench | staff | project_id | scenario-required | exported | `docs/design-workbench-architecture.md` |
| `design-list` | `/staff/projects/design-packages` | project | staff | scenario_required | catalog-only | planned | `docs/design-list.md` |
| `running-jobs` | `/staff/projects/running-jobs` | project | staff | scenario_required | catalog-only | planned | `docs/running-jobs.md` |
| `calculator` | `/staff/calculator` | commercial | staff | none | catalog-only | planned | `docs/projects-contacts-estimates-calculator.md` |
| `admin-home` | `/admin` | admin | admin | admin_role | admin-only | planned | `docs/environment-auth-supabase.md` |
| `pricebook` | `/pricebook` | admin | admin | admin_role | admin-only | planned | `docs/costing-and-geometry.md` |
| `admin-cost-materials` | `/admin/costs/materials` | admin | admin | admin_role | admin-only | planned | `docs/costing-and-geometry.md` |
| `admin-cost-actions` | `/admin/costs/actions` | admin | admin | admin_role | admin-only | planned | `docs/costing-and-geometry.md` |
| `admin-cost-overheads` | `/admin/costs/overheads` | admin | admin | admin_role | admin-only | planned | `docs/costing-and-geometry.md` |
| `admin-imports` | `/admin/imports` | admin | admin | admin_role | admin-only | planned | `docs/supabase-schema-map.md` |
| `qa-design-workbench-fixture` | `/qa/design-workbench-fixture?fixture=:fixtureSlug` | diagnostic | fixture | fixture_flag | fixture-only | exported | `docs/design-workbench-architecture.md` |

## Current Smoke Lane

`npm run portal:agent-access` currently opens:

- `/dashboard`
- `/staff/projects`
- `/staff/contacts`
- `/staff/schedule`

The project list also requires at least one visible project for the staff test account. PR-Agent.3 adds seeded scenario data for project detail, estimate, quote, and workbench route smoke. Design List, Running Jobs, and schedule scenario coverage remain planned until those domains have narrow, safe seeding contracts.

## Scenario Lane

`npm run portal:agent-scenarios` reads `playwright/.auth/portal-scenarios.json` and opens the catalog entries exported as `agentScenarioSmokeRoutes`:

- `project-detail` through `project-with-estimate`
- `estimate-detail` through `project-with-estimate`
- `quote-detail` through `quote-ready`
- `design-workbench` through `workbench-multi-object`

Seed those records explicitly with:

```bash
PORTAL_TEST_SCENARIO_TARGET=local npm run portal:scenarios:ensure
PORTAL_TEST_SCENARIO_TARGET=staging npm run portal:scenarios:ensure
PORTAL_TEST_PROVISION_TARGET=local PORTAL_TEST_SCENARIO_TARGET=local npm run portal:agent-scenarios:provision
```

Scenario provisioning requires `PORTAL_TEST_EMAIL`, `PORTAL_TEST_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. It refuses missing targets and `production`. Routine browser gates only read the saved state file; they do not mutate data.

## Page Debug Exports

The first shared debug-export lane is gated to local/staging/debug runs. When enabled, project detail, redirected estimate detail, quote detail, and design workbench routes expose a JSON payload via `data-portal-debug-export="true"`. The payload follows `PortalPageDebugExport` and includes route, selected IDs, scenario labels where available, server/client state summaries, and diagnostics.

Schedule, Design List, Running Jobs, calculator, and admin pages are cataloged as `planned`; they should add owner-approved payloads after their seeded scenarios or admin storage states exist.
