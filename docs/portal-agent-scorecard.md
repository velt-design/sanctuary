# Portal Agent Scorecard

Status: Advisory dashboard.

Use this scorecard before choosing the next portal agent PR or when you want a quick read on agent readiness. It is read-only: it does not open browsers, provision users, seed scenarios, or mutate Supabase data.

## Command

```bash
npm run portal:agent-scorecard
```

For automation or future PR comments:

```bash
npm run portal:agent-scorecard -- --json
```

To prevent the established portal-agent baseline from going backwards:

```bash
npm run portal:agent-scorecard:strict
```

The strict command is also read-only. It fails only when route catalog coverage, scenario coverage, exported debug-route coverage, seeded scenarios, or shared browser evidence adoption drops below the current documented baseline. Repo-health metrics remain advisory.

## What It Measures

The scorecard reports from existing executable sources:

- Route catalog coverage from `playwright/support/portalRouteCatalog.ts`.
- Scenario coverage from `playwright/support/portalScenarioRegistry.ts`.
- Debug-export coverage from route catalog metadata.
- Browser evidence adoption for the current agent browser specs.
- Repo health headline metrics from `npm run repo:health`.

It intentionally avoids screenshots, auth state, cookies, storage state, passwords, service-role keys, browser traces, and seeded record contents.

## How To Read It

Route catalog:

- `agent-access` routes should be stable staff pages that run without seeded data.
- `scenario-required` routes need `npm run portal:scenarios:ensure` before browser coverage is useful.
- `fixture-only` routes are gated QA/debug surfaces.
- `admin-only` routes require separate admin credentials or later admin scenarios.
- `catalog-only` routes are known pages without reliable browser smoke yet.

Scenarios:

- `seeded` means local/staging provisioning exists.
- `planned` means the route is understood, but the domain does not yet have a safe write contract.

Debug exports:

- `exported` pages expose a gated structured payload.
- `planned` pages still rely on ordinary browser evidence.
- `not-applicable` pages are simple enough that a page-level payload is not useful yet.

Browser evidence lane:

- All listed specs should use `playwright/support/portalBrowserEvidence.ts`.
- Workbench fixture specs should also use `playwright/support/workbenchEvidence.ts`.

Repo health:

- This mirrors the current headline from `npm run repo:health`.
- Treat the recommended lane as advisory. It helps choose between route/scenario/debug work and general maintainability pressure.

## Choosing The Next Lane

Use these rough rules:

- If agent access or scenario smoke is low, add route/scenario coverage before more strict gates.
- If debug-export coverage is low on complex pages, add debug payloads before bug fixes.
- If evidence adoption is incomplete, migrate specs before adding more Playwright tests.
- If critical files are rising, prefer decomposition in the next touched area.
- If workbench bugs are screenshot-only, capture a debug fixture before changing geometry or render policy.

## Guardrail

`npm run portal:agent-scorecard` remains advisory. `npm run portal:agent-scorecard:strict` is the narrow ratchet: it blocks only portal-agent readiness regression and does not enforce broad legacy cleanup, repo-health pressure, or workbench runtime reliability.
