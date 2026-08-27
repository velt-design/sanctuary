# Workbench Captured Repro Workflow

Use this workflow for design workbench solver or render bugs that are visible in screenshots but not yet reproducible from checked-in fixtures.

## Rule

Do not change the house roof solver, project render pipeline, Plan paint policy, or 3D fallback policy from screenshot evidence alone. Capture the exact live workbench state first, bake it into the captured fixture lane, then fix the first failing stage reported by that fixture.

## Capture

1. Start the portal with debug exports enabled outside production:

```bash
PORTAL_PAGE_DEBUG_EXPORTS=1 ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES=1 npm run dev:portal
```

2. Open the broken staff design workbench state.
3. Use the gated debug copy affordance to copy the page debug payload.
4. Confirm the payload includes `diagnostics.workbenchDebugFixture`.
5. Save the copied payload outside the repo first if it contains local-only investigation notes. Do not commit raw screenshots or guessed fixtures.

## Validate

The Playwright helper `readWorkbenchCapturedReproPayload(page)` accepts either:

- the shared `PortalPageDebugExport` with `diagnostics.workbenchDebugFixture`; or
- the raw QA fixture script with `data-workbench-debug-export="true"`.

It rejects payloads missing:

- `snapshot`;
- `objectFirst`;
- `selectedState`;
- `renderDiagnostics.houseGeometryInputsById`;
- `renderDiagnostics.projectHouseProjectionHealth`;
- `renderDiagnostics.projectPergolaRenderHealth`;
- `renderDiagnostics.projectPreviewSource`.

Workbench fixture browser runs attach `workbench-captured-repro-payload.json` as evidence when a valid payload is present.

For the current multi-house roof failure lane, run the stricter verifier before baking a fixture:

```bash
npm run workbench:capture:verify
```

Set `WORKBENCH_CAPTURE_URL` when the broken state lives somewhere other than the default staff workbench route. The verifier intentionally rejects healthy one-house payloads, missing object-first state, multi-house payloads without per-house diagnostics, and multi-house payloads where every house reports a healthy roof/render stage. If it rejects the page, do not change solver behavior or bake a multi-house captured fixture from that state.

## Bake

Paste only exact copied live payloads into `apps/portal/lib/drawings/sanctuaryWorkbenchCapturedFixtures.ts` through `buildCapturedSanctuaryGeometryWorkbenchFixture`; store large payload constants in focused captured-fixture modules.

Keep `CAPTURED_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES` limited to exact copied payloads. Captured slugs are allowed only when backed by copied debug JSON; do not add screenshot-approximated payloads.

## Fix

The next bug-fix PR should start with a failing fixture assertion that names:

- the failing `houseFormId` or `pergolaId`;
- `failureStage`;
- `diagnosticCode`;
- roof QA/topology diagnostics when relevant;
- Plan body counts;
- 3D body counts.

Fix only the first failing stage:

- `invalid_footprint` or `missing_geometry_input`: object-first footprint/raw-house input conversion.
- `missing_roof_model` or QA/topology failure: geometry package roof pipeline.
- `missing_plan_body`: top-projection generation/classification.
- `missing_3d_body`: house scene/body generation.

Do not hide diagnostic fallbacks or change render styling unless the captured diagnostics prove render policy is the first failing stage.

## Verify

Run the support and fixture lanes:

```bash
npx vitest run apps/portal/lib/drawings/state apps/portal/lib/drawings/views/plan test/playwright-support
npx playwright test playwright/portal.workbench-fixture.spec.ts --project=portal-fixture --reporter=line
```

Then run the normal changed-lane gates from `docs/testing-and-qa.md`.
