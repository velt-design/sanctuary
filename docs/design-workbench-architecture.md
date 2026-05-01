# Design Workbench Architecture

The design workbench is the portal drawing and model-editing surface for estimate-backed designs. The active workbench migration is sealed around an object-first project model and solved geometry spine. Compatibility remains only as explicit legacy estimate snapshot import/export support and named fallback boundaries.

## Primary Paths

- Route: `/staff/projects/[projectId]/design-workbench`.
- Estimate workbench client: `apps/portal/app/staff/projects/[projectId]/design-workbench`.
- UI components: `apps/portal/components/drawings`.
- Domain library: `apps/portal/lib/drawings`.
- Geometry package: `packages/geometry`.
- Browser smoke: `playwright/portal.drawing-workbench.spec.ts`.

## Component Layers

- `workbench`: top-level shell, viewport mode switching, save/status surfaces.
- `viewports`: Model Space, Sheet View, 3D, Draw Outline interaction.
- `rail`: configurator and object-workbench inspector rails.
- `sheets`: A3 sheet composition.
- `renderers`: shared drawing rendering components when present.

## Domain Layers

- `state`: workbench store, UI state, object-first model, compatibility adapters, status/inspector models.
- `geometry`: package input builders, preview derivation, compatibility geometry adapters.
- `interactions`: shared object interaction engine plus family adapters.
- `assembly`: semantic assembly builders and geometry contracts.
- `views`: plan/section/elevation view-model builders.
- `details` and `annotations`: generated details and placement policy.

## Object-First Model

The active workbench is object-first:

- House forms, decks, openings, and pergolas are modeled as explicit objects.
- Hosted objects resolve against derived house/building behavior.
- Geometry, plan, 3D, section, and sheet views should consume solved/derived models rather than each inventing shape truth.
- The solved module's 3D scene and model-space top projection are paired: the projection is generated from the same `ViewerSceneModel` handed to the 3D viewport, with assembly reference shapes carried forward explicitly.
- Geometry-ready model-space plan fitting uses `geometryTopProjection.extents`; legacy `ModulePlanModel` dimensions are a fallback path, not the source of scene fit.
- Geometry-ready plan rendering is projection-first in both Model Space and Sheet View. Top projection owns committed house, deck, and pergola bodies; context/reference projection shapes are diagnostics or non-body overlays unless intentionally rendered as markers/lines. Object-workbench overlays provide transparent hit targets, previews, handles, and dimensions without drawing duplicate committed bodies. Deck dragging in projection-backed plans must invert the same screen-axis transform used to draw the top projection, so pointer movement is screen-native.
- Compatibility or legacy fallback state must stay named and visible in tests or status models, and must not become active geometry truth.

## Rail Notes

`ObjectWorkbenchRail` is the canonical hidden workbench rail. `ConfiguratorRail` remains for estimates-tab compatibility.

House Forms expose preset footprints and roof forms: flat, mono, gable, and hipped. Preset changes should keep roof-form intent available across attachment-side rotations. Unsupported custom topology should preserve selected intent while surfacing blocking diagnostics rather than silently approximating geometry.

## Interaction Model

Shared vocabulary for direct manipulation:

- `hover`
- `selected`
- `drag-intent`
- `dragging`
- `snap-available`
- `snapped`
- `floating`
- `blocked`
- `commit`
- `cancel`

`objectInteractionEngine` owns shared pointer and drag lifecycle behavior. Object-family adapters own hit targets, drag eligibility, previews, snap rules, commit payloads, validation, and hint text.

Deck dragging is the first concrete adapter pattern. Opening adapters also exist and should follow the same contract style.

## Drawing Persistence

Design workbench persistence uses local-first working copies for estimate drawing drafts. Object-first data is stored inside the estimate drawing draft shape while compatibility loading remains explicit for older snapshots.

When changing persistence:

- Keep estimate locks respected.
- Preserve local draft recovery.
- Keep compatibility adapters isolated.
- Add tests for migration or fallback boundaries.

## Verification

```bash
npm run test:portal -- apps/portal/lib/drawings
npm run test:portal -- apps/portal/components/drawings
npm run test:portal:browser
```

For 3D or drawing UI work, use Playwright screenshots or visual checks in addition to unit tests.
