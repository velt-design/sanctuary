# Portal Route Catalog

Status: Active.

Purpose: give agents one source of truth for portal routes, required access, owner docs, data needs, and browser-smoke status.

Executable source: `playwright/support/portalRouteCatalog.ts`.

## How To Use

- Add or update route metadata in `playwright/support/portalRouteCatalog.ts`.
- Keep this doc aligned when route categories, smoke policy, or ownership changes.
- Browser smoke specs should consume catalog subsets such as `agentAccessSmokeRoutes` and `agentScenarioSmokeRoutes`; do not create new hardcoded route lists.
- Dynamic project, estimate, quote, workbench, and calculator routes are backed by explicit local/staging scenarios before they run in browser smoke.

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
| `ui-foundation` | `/staff/ui-foundation` | core | staff | none | agent-access | not-applicable | `docs/ui-foundation.md` |
| `email-previews` | `/staff/email-previews` | core | staff | none | catalog-only | not-applicable | `docs/automation-email-audit.md` |
| `design-booklets` | `/staff/design-booklets` | core | staff | none | catalog-only | not-applicable | `docs/design-booklets.md` |
| `qa-email-preview-workbench-fixture` | `/qa/email-preview-workbench-fixture` | diagnostic | fixture | fixture_flag | fixture-only | not-applicable | `docs/automation-email-audit.md` |
| `qa-design-booklet-workbench-fixture` | `/qa/design-booklet-workbench-fixture` | diagnostic | fixture | fixture_flag | fixture-only | not-applicable | `docs/design-booklets.md` |
| `projects-index` | `/staff/projects` | project | staff | visible_project | agent-access | not-applicable | `docs/projects-contacts-estimates-calculator.md` |
| `contacts-index` | `/staff/contacts` | project | staff | none | agent-access | not-applicable | `docs/projects-contacts-estimates-calculator.md` |
| `schedule` | `/staff/schedule` | schedule | staff | none | agent-access | planned | `docs/schedule.md` |
| `admin-costing` | `/admin/costing` | admin | admin | admin_role | admin-only | planned | `docs/costing-and-geometry.md` |
| `project-detail` | `/staff/projects/:projectId` | project | staff | project_id | scenario-required | exported | `docs/projects-contacts-estimates-calculator.md` |
| `estimate-detail` | `/staff/projects/:projectId/estimate/:estimateId` | commercial | staff | estimate_id | scenario-required | exported | `docs/projects-contacts-estimates-calculator.md` |
| `quote-detail` | `/staff/projects/:projectId/quotes/:quoteId` | commercial | staff | quote_id | scenario-required | exported | `docs/quotes-invoices-job-packs.md` |
| `design-workbench` | `/staff/projects/:projectId/design-workbench` | workbench | staff | project_id | scenario-required | exported | `docs/design-workbench-architecture.md` |
| `design-list` | `/staff/projects/design-packages` | project | staff | scenario_required | catalog-only | planned | `docs/design-list.md` |
| `running-jobs` | `/staff/projects/running-jobs` | project | staff | scenario_required | catalog-only | planned | `docs/running-jobs.md` |
| `calculator` | `/staff/calculator?projectId=:projectId&editEstimateId=:estimateId` | commercial | staff | estimate_id | scenario-required | planned | `docs/projects-contacts-estimates-calculator.md` |
| `qa-ui-foundation-fixture` | `/qa/ui-foundation-fixture` | diagnostic | fixture | fixture_flag | fixture-only | not-applicable | `docs/ui-foundation.md` |
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
- `/staff/ui-foundation`
- `/staff/projects`
- `/staff/contacts`
- `/staff/schedule`

The project list also requires at least one visible project for the staff test account. Seeded scenario data covers project detail, estimate, quote, workbench, and calculator route smoke. Design List, Running Jobs, and schedule scenario coverage remain planned until those domains have narrow, safe seeding contracts.

## Scenario Lane

`npm run portal:agent-scenarios` reads `playwright/.auth/portal-scenarios.json` and opens the catalog entries exported as `agentScenarioSmokeRoutes`:

- `project-detail` through `project-with-estimate`
- `estimate-detail` through `project-with-estimate`
- `quote-detail` through `quote-ready`
- `design-workbench` through `workbench-multi-object`
- `calculator` through `project-with-estimate`

Seed those records explicitly with:

```bash
PORTAL_TEST_SCENARIO_TARGET=local npm run portal:scenarios:ensure
PORTAL_TEST_SCENARIO_TARGET=staging npm run portal:scenarios:ensure
PORTAL_TEST_PROVISION_TARGET=local PORTAL_TEST_SCENARIO_TARGET=local npm run portal:agent-scenarios:provision
```

Scenario provisioning requires `PORTAL_TEST_EMAIL`, `PORTAL_TEST_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. It refuses missing targets and `production`. Routine browser gates only read the saved state file; they do not mutate data.

## Page Debug Exports

The first shared debug-export lane is gated to local/staging/debug runs. When enabled, project detail, redirected estimate detail, quote detail, and design workbench routes expose a JSON payload via `data-portal-debug-export="true"`. The payload follows `PortalPageDebugExport` and includes route, selected IDs, scenario labels where available, server/client state summaries, and diagnostics.

Schedule, Design List, Running Jobs, calculator, and admin pages still have `planned` debug exports. Calculator route and interaction smoke now run from seeded V2 inputs without waiting for that optional diagnostic payload.

The calculator's post-save quote action targets `/staff/projects/:projectId?tab=quotes&createFromEstimateId=:estimateId`. It is an explicit user-selected handoff to the existing quote workflow, not a separate catalog route or an automatic save side effect.
