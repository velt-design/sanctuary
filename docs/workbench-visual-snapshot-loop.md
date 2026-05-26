# Workbench Visual Snapshot Loop

**Owner**: AI-assisted dev workflow for `apps/portal/app/staff/projects/[projectId]/design-workbench/**` and related CSS modules.
**Established**: 2026-05-26 (PR-T5).

## Purpose

When iterating on workbench layout, density, tokens, or any other visual change, the loop below lets the agent **review the actual rendered result** instead of reasoning from mockups alone. Built after a series of T4 iterations made it clear that blind CSS iteration (mockup interpretation + user screenshots) was slow and error-prone.

## The loop

1. Edit CSS modules, tokens (`apps/portal/app/globals.css`), or workbench TSX.
2. Run:
   ```bash
   npx playwright test playwright/portal.workbench-snapshot.spec.ts \
     --project=portal-fixture --reporter=line
   ```
3. Read the resulting PNGs from `tmp/` via the Read tool:
   - `tmp/workbench-mono-pergola.png` — Plan Editor with Pergola 1 selected (right inspector populated)
   - `tmp/workbench-mono-house-form.png` — Plan Editor with House Form 1 selected
   - `tmp/workbench-mono-3d-empty.png` — 3D Review with nothing selected
4. Compare against `public/images/sanctuary_pergola_workbench.png` (the design target) or other reference image.
5. Iterate.

Each spec auto-spawns a Next dev server on port 3011 with `ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES=1`. No manual dev-server management; no auth setup required.

## What's load-bearing

### `/qa/design-workbench-fixture?fixture=<slug>` route

Public (no-auth) route under `apps/portal/app/qa/design-workbench-fixture/page.tsx`. Mounts `DesignWorkbenchFixtureClient` which (per PR-T5) renders the **same** components as the authenticated workbench:

- `ObjectWorkbenchRail` (left rail: VISIBILITY + flat OBJECTS TREE)
- `DrawingWorkbench` (centre: chrome + canvas)
- `WorkbenchInspectorHost` (right: per-family inspector content)

The shell uses `data-workbench-density="compact"` so all density tokens resolve to their compact values, matching what production sets.

### Stub action surfaces

`fixtureWorkbenchActionStubs.ts` exports two factories returning objects shaped to `ObjectWorkbenchSelectionActions` and `ObjectWorkbenchActions`. Every commit/add/remove handler is a no-op returning `{ ok: true }`. The host runs unmodified; edits don't persist.

`isLocked={true}` is set on the inspector host so editable controls render visually disabled — makes the read-only nature obvious.

### TypeScript as the maintenance signal

The stub objects use `ReturnType<typeof useObjectWorkbench*>` for typing. **When production adds a new action function, the stubs become structurally invalid and `npx tsc` fails until the stub catches up.** That's the alarm that keeps the fixture surface from silently drifting away from the production surface it mirrors.

## DON'T

- **Don't "simplify" the fixture client by removing the inspector mount.** The fixture is intentionally tracking production. If the mount looks like dead-feeling code on a casual read, it's serving the snapshot dev loop, not end users.
- **Don't replace the stubs with the real action hooks.** The real hooks (`useObjectWorkbenchActions`, `useObjectWorkbenchSelection`) need a real `EstimateDetail` + persist callback. Fabricating those is more work than the stubs and conflates "render the inspector" with "persist edits". The fixture is read-only by design.
- **Don't add new commit/action functions only to the stubs.** They exist to mirror production. If a stub is added without a corresponding production function, TS will allow it but the alarm meaning is lost.

## DO

- **Add new fixture snapshots** to `playwright/portal.workbench-snapshot.spec.ts` when iterating on a new family (deck, opening) or a new state (empty, error, multi-pergola). Each test screenshots one state; cheap.
- **Extend the stubs** when production adds an action function — the TS compile error will guide you to the exact slot.
- **Reference this loop** in plan documents when proposing visual changes to the workbench. It changes the iteration model from "ship and ask user to screenshot" to "ship, snapshot, self-review, iterate".

## Related

- Plan that introduced the loop: [docs/fixture-inspector-mount-plan.md](fixture-inspector-mount-plan.md)
- CAD-UI plan that motivated the density work: [docs/design-workbench-cad-ui-plan.md](design-workbench-cad-ui-plan.md)
- Tokens plan: [docs/design-tokens-and-density-plan.md](design-tokens-and-density-plan.md)
- Fixture route source: [apps/portal/app/qa/design-workbench-fixture/page.tsx](../apps/portal/app/qa/design-workbench-fixture/page.tsx)
- Fixture client (where the host is mounted): [apps/portal/app/staff/projects/[projectId]/design-workbench/DesignWorkbenchFixtureClient.tsx](../apps/portal/app/staff/projects/[projectId]/design-workbench/DesignWorkbenchFixtureClient.tsx)
- Stub action factories: [apps/portal/app/staff/projects/[projectId]/design-workbench/fixtureWorkbenchActionStubs.ts](../apps/portal/app/staff/projects/[projectId]/design-workbench/fixtureWorkbenchActionStubs.ts)
- Snapshot spec: [playwright/portal.workbench-snapshot.spec.ts](../playwright/portal.workbench-snapshot.spec.ts)
