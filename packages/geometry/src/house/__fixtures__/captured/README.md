# Captured roof-failure fixtures

This directory holds JSON fixtures captured from the live workbench
when a designer hits a roof QA failure and clicks **Save bug report**
in the right-rail validation panel
([`RoofValidationPanel.tsx`](../../../../../apps/portal/components/drawings/rail/RoofValidationPanel.tsx)).

Each file is a `RoofFailureRepro` payload
([`exportRoofFailureRepro.ts`](../../../../../apps/portal/lib/drawings/exportRoofFailureRepro.ts))
— schema-versioned, geometry-only, no customer-identifying data.

## Why fixtures live here

Two reasons:

1. **Regression coverage.** PR-HR4's `orthogonalRoofCoverage.matrix.test.ts`
   loads every `.json` file in this directory and exercises the full
   roof pipeline against it. Any case that previously failed and now
   passes turns green automatically.
2. **Engineer-readable repros.** A designer-shared JSON file in this
   shape is enough for an engineer to write a focused failing test —
   no need to back-derive the geometry from a screenshot.

## Adding a fixture

1. Designer hits the failing shape in the workbench, clicks
   "Save bug report" in the right-rail validation panel.
2. Drop the downloaded `roof-failure_*.json` into this directory
   unchanged.
3. Filename convention is preserved from the export (stage + code +
   timestamp); rename only if you need to disambiguate near-duplicates.
4. If the failure is already covered by an existing fixture (same
   `failingStage.id` + `validationCode` + similar footprint), prefer
   adding a comment to the existing fixture's accompanying note over
   duplicating.

## Relationship to the existing captured-repro workflow

This is the **designer-facing** path; the engineer-facing path is in
[`docs/workbench-captured-repro-workflow.md`](../../../../../docs/workbench-captured-repro-workflow.md)
+ [`apps/portal/lib/drawings/sanctuaryWorkbenchCapturedFixtures.ts`](../../../../../apps/portal/lib/drawings/sanctuaryWorkbenchCapturedFixtures.ts).

The two complement each other:

| | Designer path (this dir) | Engineer path |
|---|---|---|
| Trigger | "Save bug report" button | Dev server + debug env flag |
| Scope | Single failing house, geometry only | Whole project, all houses/pergolas |
| Schema | `RoofFailureRepro` (PR-HR1) | `PortalPageDebugExport` |
| Consumer | Geometry property-based matrix (PR-HR4) | Captured-fixtures Playwright lane |

Use the designer path for one-shape regressions. Use the engineer
path when a bug only reproduces in a specific multi-house /
multi-pergola scene.
