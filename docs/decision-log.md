# Decision Log

Compact indexed lessons and guardrails for future agents. Scan relevant entries before non-trivial or risky work, especially when the task touches a known source-of-truth boundary, migration, auth path, data flow, or quality gate.

## Entry Template

```text
Date: YYYY-MM-DD
Area: short area name
Status: Active | Promoted | Superseded
Decision or mistake: what happened or what was decided
Why it mattered: the risk or outcome
Current guardrail: what future agents must do
Promoted to: durable docs or playbook rules, or None
Related docs/tests: paths or commands
```

Use `Status: Active` when the entry is still only a decision-log guardrail. New reusable lessons should remain `Active` until a later pass promotes them into a canonical doc, so this log continues to show live risks that have not yet become standing rules. Use `Status: Promoted` when the durable behavior is now represented in `docs/agent-playbook.md`, `AGENTS.md`, `docs/README.md`, or another canonical doc. Use `Status: Superseded` only when a newer entry or canonical doc replaces the rule.

## Index

| Date | Area | Status | Guardrail |
| --- | --- | --- | --- |
| 2026-05-01 | Supabase Schema | Promoted | Schema-affecting work needs a table/RPC ownership map before future behavior changes. |
| 2026-05-01 | Agent Routing | Promoted | Non-trivial changes need a path ownership and doc-trigger map before editing. |
| 2026-05-01 | Automation/Email/Audit | Promoted | Automation, email outbox, audit, tasks, and follow-ups need a canonical side-effect doc. |
| 2026-05-01 | API/Auth | Promoted | Staff/admin/public-token route changes need a route contract doc before future behavior changes. |
| 2026-05-01 | Projects/Estimates | Promoted | Core project/contact/estimate workflows need a canonical doc before future behavior changes. |
| 2026-05-01 | Docs/Testing | Promoted | Keep broad repo command guidance in `docs/testing-and-qa.md`; link to it instead of duplicating command blocks. |
| 2026-05-01 | Parallel Work | Promoted | Use universal parallel-work guardrails for concurrent lanes across apps, packages, docs, and workbench migration. |
| 2026-05-01 | Geometry Top Projection | Promoted | Mesh-backed top projection must follow the 3D Top camera visibility contract, not render-mesh order or face winding. |
| 2026-05-01 | Plan Rendering | Promoted | Geometry-ready plan views must use top projection as the single committed visual body source. |
| 2026-05-01 | Plan Rendering | Promoted | Projection-backed plans must suppress context/reference bodies as normal visuals and invert the projection transform for deck drag coordinates. |
| 2026-05-01 | Plan Rendering | Promoted | Geometry-ready plan selection and drag must use render-graph layer ownership and canonical preview/commit/rebuild round trips. |
| 2026-05-01 | Plan Rendering | Promoted | Projection-backed overlays must bind visible selection/hit geometry to committed top-projection polygons, not reference footprints. |
| 2026-05-01 | Plan Rendering | Promoted | Geometry-ready Model Space is a hard top-projection-only render path; legacy/context/reference/opening overlays stay out of normal visuals. |
| 2026-05-01 | Design Workbench Architecture | Promoted | Split workbench ownership contract-first: coordinate adapters and render graphs leave React presenters before moving tools/renderers. |
| 2026-05-01 | Deck Interaction | Promoted | Projection-backed deck snapping must use top-projection frames live and object frames only at the commit boundary. |
| 2026-05-01 | Plan Detail | Promoted | Geometry-ready plan detail and deck snap edges must come from scene-backed projected wall segments, not legacy footprint overlays or roof outlines. |
| 2026-05-01 | Deck Interaction | Promoted | Floating deck releases are valid projection placements and must not be failed by snapped-settle geometry checks. |
| 2026-05-01 | Deck Interaction | Promoted | Projection-backed deck drag sessions must use committed top-projection polygons for live drag math, not SVG-projected or legacy overlay objects. |
| 2026-05-01 | Deck Interaction | Promoted | Projection-backed deck releases must map render-space previews through object commit frames before writing persisted deck fields. |
| 2026-05-03 | Design Workbench Geometry | Promoted | There is one solved geometry spine; plan, 3D, sheet, section, detail, snap, and interaction surfaces are views of it. |
| 2026-05-03 | Deck Interaction | Active | Projection-backed deck releases must not use `commitStartPolygon` bounds remapping; it can reintroduce stale overlay coordinates. |
| 2026-05-04 | Deck Interaction | Active | Projection-backed drag deltas must normalize the pointer anchor, and snapped commits must map render-frame offsets into object-frame offsets before settle. |
| 2026-05-04 | Plan Rendering | Active | Geometry-ready Model Space Top renders through `Geometry3DViewport lockedViewPreset="top"` on the same R3F scene as Perspective; the SVG `ProjectionTopViewport` stack is retired. |
| 2026-05-04 | Design Workbench Architecture | Active | Workbench has two render surfaces: a read-only 3D viewport (`Geometry3DViewport`) and a 2D `PlanViewport` (the editor). Plan replaces "Model Space" in the mode switch (`Sheet | Plan | 3D`); all editing, tools, and gizmos live in PlanViewport. |
| 2026-05-04 | Design Workbench Architecture | Active | Nine foundational contracts govern the read/edit split (single-source intent, three-phase drag, plan-projection math, typed selection, isolated tool state machines, snap-as-a-service, gizmos+overlays Plan-only, mm everywhere, 3D is read-only). |
| 2026-05-21 | Design Workbench Testing | Active | 8 ModelSpaceViewport tests are stale-fixture failures, not regressions — needs `objectWorkbenchOverlayInput` migration before they go green again. |
| 2026-05-21 | Design Workbench Testing | Active | 2 import-guard failures are real architectural drift — ModelSpaceViewport still imports houseFirstWorkbenchModel + does not route through Geometry3DViewport as the guards expect. |
| 2026-05-01 | Quotes/Invoices/Job Packs | Promoted | High-risk side-effect workflows need a canonical doc before future behavior changes. |
| 2026-05-01 | Docs | Promoted | Read the agent playbook for non-trivial portal work; promote durable lessons from this log into the playbook. |
| 2026-05-01 | Docs | Promoted | Do not delete active guardrail docs without confirming usage or replacing the rule. |
| 2026-05-01 | Docs | Promoted | Distinguish current-state references from active operating rules. |
| 2026-05-06 | Decomposition / Refactor Hygiene | Active | Extracting helpers during a decomposition refactor must be byte-for-byte; rewriting "while I'm there" introduces subtle behavioural drift that escapes typecheck. |
| 2026-05-08 | PlanViewport / Pointer Events | Active | Pointer-driven tools require `touch-action: none`, `setPointerCapture` on primary-button down, `pointerCancel` -> `cancelActiveTool` (not `pointerUp`), and a pure dispatch helper that NEVER invents coords on null. |
| 2026-05-08 | Debugging Hygiene | Active | When live-runtime symptoms don't match any of the current hypotheses, instrument the boundary with logs before iterating fixes; root-cause from real data, not theory chains. |
| 2026-05-08 | House Roof Topology | Active | "Click hip triangle to open as gable" needs a Dutch-hip / half-hip topology in the geometry pipeline -- hipped + `openGableEndIds` is currently a no-op (gated to gable form). Multi-session work: rectangle Dutch-hip first, joined Dutch-hip second, UI third. |
| 2026-05-12 | 3D Wall Rendering | Active | Wall solids must consume `renderMesh` (not just `boundary`); miter footprints offset inward-only `(0, -thickness)`, not centered `(±half, ±half)`; non-flat-top walls extrude polygonally via `buildPolygonalWallRenderMesh`; open-gable migrated-from-hipped boundaries reshape only when `wallBoundaryHasFlatTop` is true. |
| 2026-05-12 | 3D Viewport Navigation | Active | OrbitControls `mouseButtons.LEFT` must branch on `lockedViewPreset === 'top'` (pan in Plan, rotate in 3D). Trackpad users have no MIDDLE button, so rotate-on-LEFT is the only navigable default. |
| 2026-05-12 | Open-Gable Roof Frames | Active | Triangular gable walls have a 1-point top profile (apex only); the frame-feature gate must be `topProfile.length < 1`, not `< 2`, or the gable-end posts/top-chord disappear. |
| 2026-05-13 | Plan Rendering | Active | Visual deduplication of redundant house outlines is the RENDER LAYER's job, not the graph's: keep `house_reference + footprint` in `committedBodies` (the hit-target chain needs it for canvas house selection) and drop the redundant stroke in `PlanCommittedBodyLayer` (Plan) and `TopProjectionLayerRenderer` (Sheet) via `filterPlanVisibleBodies`. |
| 2026-05-13 | Pergola Snap Targets | Active | `HouseModel3D.roofEaves` must include EVERY attachable perimeter edge (drain + weather-flashed gable + apron), not just `drain_eave`. Opening a Dutch-hip end strips the adjacent roof plane and reclassifies the eave as `weather_flashed_edge` -- the user still expects to snap a pergola there. Downstream gutter/flashing consumers re-filter on `edgeKind`. |
| 2026-05-13 | Plan Tool Chain | Active | `EdgeDragTool.onPointerDown` runs a distance-based priority: terminal-end toggle target (`event.shape?.metadata?.openGableEndId`) ONLY falls through to SelectTool when the click is outside `edgeHitToleranceMm` of the active outline. Clicks on the synthetic's eave-corner overhang that overlap a wall edge start an edge drag instead, restoring wall interaction under the synthetic. Default tolerance is 250 mm (was 500). |
| 2026-05-13 | House Roof Topology | Active | The geometry normalize migration treats `roofIntent.form: 'gable'` as "hipped + every terminal end open" regardless of `openGableEndIds`. Any terminal-end toggle that operates on the workbench state must port the migration into explicit `form: 'hipped' + openGableEndIds: <all terminals minus the toggled one>` in the SAME commit, or `[].filter(...)` produces a no-op and normalize re-migrates on the next solve. Helper: `resolveHouseTerminalEndToggleRoofDraft`. |
| 2026-05-14 | Plan Snap Engine | Active | `resolveMoveSnap` resolves a corner snap after the primary: if a second target on a different polygon edge whose direction is at least `cornerMinAngleDeg` (default 30 deg) from the primary's lies within tolerance, it solves the 2x2 system `[primary_normal; secondary_normal] . delta = [ps; ss]` so the moving polygon's corner lands on the two target lines' intersection. `MoveSnapResult.secondary` + `cornerVertex` are optional; single-line consumers are unaffected. EdgeDragTool stays single-line (1D motion). |
| 2026-05-14 | House Roof Topology | Active | Milestone 13 session C: `'gable'` is retired from the `HouseRoofForm` type union (`'flat' \| 'mono' \| 'hipped'`). `resolveHouseRoofForm` (geometry normalize) and `normalizeHouseFormRoofIntent` (workbench draft normalize) BOTH map legacy `'gable'` string input to `'hipped'` so storage can still carry it but no typed surface accepts it. Picker, validators, dispatchers, and inspector derivations are simplified accordingly. Known regression: legacy gable-form houses in preset mode (no explicit polygon at normalize time) load as `'hipped'` with empty `openGableEndIds`; the user re-opens ends from the rail or Plan canvas. |
| 2026-05-14 | House Roof Topology | Active | Partial-open clicks on joined footprints (U / wrap with one terminal end opened) require TWO wavefront facet-validator relaxations: (1) `allowRaisedBoundaryPoints: true` -- the slope adjacent to a stationary gable edge legitimately reaches the eave at apex z, not eave z (the gable wall fills the height gap); (2) the `face_count_mismatch` check subtracts the stationary edge count from the expected facet count because stationary edges intentionally produce zero slope facets. Without these, clicking ONE terminal end on a U produced `roof_topology_face_count_mismatch:5:8` and the geometry rendered as invalid. Fully-hipped (no stationary edges) and bent-spine all-open paths are unchanged. |

## Entries

### 2026-05-03 - Design Workbench Geometry - Single Solved Geometry Spine

Area: Design Workbench Geometry

Status: Promoted

Decision or mistake: plan, 3D, sheet, object overlays, snap frames, and commit/rebuild paths were allowed to carry separate geometry models that each looked locally valid.

Why it mattered: Model Space could be visually accurate to 3D while deck dragging or sheet output still jumped or drifted because another view-specific geometry quietly acted as truth.

Current guardrail: object-first design intent resolves into one solved physical geometry artifact. Plan, 3D, sheet, section, wall/detail lines, snap frames, dimensions, hit targets, and interaction previews are derived views of that artifact. Calculator-era plan models, semantic house context, legacy sheet geometry, and object-workbench overlay polygons are fallback/reference/edit-support only unless explicitly derived from the solved geometry spine.

Promoted to: `docs/target-architecture.md`, `docs/design-workbench-architecture.md`, `docs/costing-and-geometry.md`, `docs/parallel-work-guardrails.md`.

Related docs/tests: `docs/design-workbench-architecture.md`, `docs/costing-and-geometry.md`, `docs/parallel-work-guardrails.md`, `npm run test:portal:workbench`, `npm run test:portal:browser`.

### 2026-05-01 - Design Workbench Architecture - Contract First Split

Area: Design Workbench Architecture

Status: Promoted

Decision or mistake: Model Space rendering, coordinate transforms, pointer lifecycles, preview state, and commit conversion had accumulated inside large React components, making plan/3D coordinate bugs difficult to isolate.

Why it mattered: deck movement could pass narrow visual or DOM tests while still crossing renderer, projection, object, and commit spaces in different files.

Current guardrail: split the workbench by contracts first. Plan coordinate transforms belong in `PlanCoordinateAdapter`, top-projection visual ownership belongs in the plan render graph, and interaction tools/commit adapters should consume those contracts instead of duplicating math in presenters.

Promoted to: `docs/design-workbench-architecture.md`.

Related docs/tests: `apps/portal/lib/drawings/views/plan/planCoordinateAdapter.test.ts`, `apps/portal/lib/drawings/views/plan/planRenderGraph.test.ts`, `apps/portal/app/staff/calculator/ModuleViewsCard.test.tsx`, `apps/portal/components/drawings/viewports/ModelSpaceViewport.test.tsx`.

### 2026-05-01 - Deck Interaction - Projection To Object Commit Frame

Area: Deck Interaction

Status: Promoted

Decision or mistake: floating projection-backed releases persisted raw top-projection preview coordinates into `floatingRect`, while the object rebuild interpreted those fields as object/local deck coordinates.

Why it mattered: the deck could preview in the right place, then rebuild far away or on the wrong side because the saved coordinates crossed the render/object boundary unconverted.

Current guardrail: projection-backed deck releases must map the rendered preview polygon through a matched render-frame to object-frame transform before writing snapped offsets, custom outlines, or floating rects. If no object commit frame can be matched, fail the release with diagnostics instead of saving raw projection coordinates. Legacy non-projection fallback may keep direct plan-space behavior.

Promoted to: `docs/design-workbench-architecture.md`.

Related docs/tests: `apps/portal/lib/drawings/interactions/deckInteractionAdapter.test.ts`, `apps/portal/components/drawings/viewports/ModelSpaceViewport.test.tsx`.

### 2026-05-03 - Deck Interaction - No Commit-Start Bounds For Projection Releases

Area: Deck Interaction

Status: Active

Decision or mistake: projection-backed floating releases still had a bounds-based `commitStartPolygon` remap path available before the render-frame to object-frame transform.

Why it mattered: `commitStartPolygon` can come from stale object-workbench or legacy overlay geometry. Using its bounds lets a visually correct top-projection preview rebuild through old coordinates and jump on release.

Current guardrail: projection-backed releases must map through matched render/object frames only. `commitStartPolygon` is legacy/fallback or diagnostic geometry and must not override top-projection frame mapping for floating or snapped projection commits.

Promoted to: None

Related docs/tests: `apps/portal/lib/drawings/interactions/deckCommitAdapter.test.ts`, `apps/portal/components/drawings/viewports/ModelSpaceViewport.test.tsx`.

### 2026-05-04 - Plan Rendering - Unified Scene Graph Top Viewport

Area: Plan Rendering

Status: Active

Decision or mistake: an SVG-based `ProjectionTopViewport` stack (`ProjectionTopViewport.tsx`, `ProjectionTopSvg.tsx`, `ProjectionTopLayers.tsx`, `ProjectionTopHitTargets.tsx`, `ProjectionTopDimensions.tsx`, `ProjectionTopInteractionAdapter.ts`) was running as a parallel renderer for geometry-ready Model Space Plan, reading `topProjection` and producing its own SVG body/hit-target tree alongside the R3F 3D viewport.

Why it mattered: it violated the Rhino-like north star (one scene graph, multiple cameras). Two renderers reading the same artifact via different code paths drift; selection, dimensions, and interaction logic had to be re-implemented per surface.

Current guardrail: geometry-ready Model Space Plan renders through `Geometry3DViewport` with `lockedViewPreset="top"` (orthographic top camera, rotation locked, right-drag pan, wheel zoom). Selection comes from the shared scene's R3F raycaster. The SVG ProjectionTop stack is deleted; `topProjection` remains only for Sheet drawings and parity diagnostics. Future Front/Right/Section viewports should follow the same pattern: same scene graph, different `lockedViewPreset`.

Promoted to: None

Related docs/tests: `apps/portal/components/drawings/viewports/Geometry3DViewport.tsx`, `apps/portal/components/drawings/viewports/ModelSpaceViewport.tsx`, `apps/portal/components/drawings/rail/objectWorkbenchImportGuards.test.ts`.

### 2026-05-04 - Deck Interaction - Projection Drag Anchor And Commit Offset Parity

Area: Deck Interaction

Status: Active

Decision or mistake: projection-backed deck drag normalized the grabbed point to the deck center when the pointer resolver landed outside the committed polygon, but preview deltas and snapped commit offsets could still use the raw pointer or render-frame center offset.

Why it mattered: a screen-right drag could feel like it moved through the wrong frame, and a side-wall snap could settle with a projection/object-frame offset instead of the released preview.

Current guardrail: projection-backed drag sessions must use one normalized start anchor for grabbed-point and delta math, preserving raw resolver points only as diagnostics. Snapped commits must map center offsets through the matched render/object frames before persistence, and settle matching may allow only narrow top-projection visual jitter while still rejecting larger rebuilt-geometry drift.

Promoted to: None

Related docs/tests: `apps/portal/lib/drawings/interactions/deckInteractionAdapter.test.ts`, `apps/portal/lib/drawings/interactions/deckCommitAdapter.test.ts`, `apps/portal/lib/drawings/interactions/deckReleaseSettlementController.test.ts`, `apps/portal/components/drawings/viewports/ModelSpaceViewport.test.tsx`.

### 2026-05-01 - Deck Interaction - Projection-Native Drag Session

Area: Deck Interaction

Status: Promoted

Decision or mistake: projection-backed deck drag mixed top-projection pointer coordinates with overlay objects whose interaction fields could be SVG-projected for rendering or derived from older object-workbench geometry.

Why it mattered: every drag could feel like it moved through an old coordinate system before the commit/rebuild tried to land in the real 3D/top-projection position.

Current guardrail: geometry-ready deck drag sessions use committed top-projection polygons, centers, grabbed points, hit targets, and preview polygons for live plan-space math. SVG-only interaction data is display-only, legacy/object polygons are fallback or commit-boundary data only, and projection-backed drags must not fall back to the raw legacy plan resolver.

Promoted to: `docs/design-workbench-architecture.md`.

Related docs/tests: `apps/portal/lib/drawings/interactions/deckInteractionAdapter.test.ts`, `apps/portal/components/drawings/viewports/ModelSpaceViewport.test.tsx`, `apps/portal/app/staff/calculator/ModuleViewsCard.tsx`.

### 2026-05-01 - Deck Interaction - Floating Release Legality

Area: Deck Interaction

Status: Promoted

Decision or mistake: floating deck release reused snapped release remapping and strict top-projection settle failure behavior.

Why it mattered: dragging a deck away from the house could commit successfully, then show a blocking failure because the top-projection deck body was late or did not match the released preview before the settle deadline.

Current guardrail: a floating release persists the released projected preview as an absolute `floatingRect`. Wall/snap frames remain witness metadata only. If a floating commit succeeds, stale top-projection geometry may be reported with projection-settle diagnostics, but it must not become a user-facing failed move. Snapped releases remain strict.

Promoted to: `docs/design-workbench-architecture.md`, `docs/costing-and-geometry.md`.

Related docs/tests: `apps/portal/lib/drawings/interactions/deckInteractionAdapter.test.ts`, `apps/portal/components/drawings/viewports/ModelSpaceViewport.test.tsx`.

### 2026-05-01 - Plan Detail - Scene-Backed Wall Edges

Area: Plan Detail

Status: Promoted

Decision or mistake: After Model Space became projection-only, plan detail still needed to return without reintroducing legacy/reference overlays or using roof outlines as deck host edges.

Why it mattered: users need accurate wall edges for snapping and readable plans, but detail must remain tied to the same 3D scene as the top-view bodies.

Current guardrail: solved house wall segments emit `house_line:wall_segment` scene objects. Top projection renders them as context detail with `planDetailRole: wall_edge` and `snapRole: deck_host_edge`; they do not drive extents or committed body counts. Projection-backed deck snapping should prefer these wall-edge frames, with committed body frames only as fallback.

Promoted to: `docs/design-workbench-architecture.md`.

Related docs/tests: `packages/geometry/src/viewer.test.ts`, `packages/geometry/src/topProjection.test.ts`, `apps/portal/app/staff/calculator/ModuleViewsCard.test.tsx`, `apps/portal/lib/drawings/views/plan/buildPlanViewModel.test.ts`.

### 2026-05-01 - Plan Rendering - Model Space Hard Projection Cut

Area: Plan Rendering

Status: Promoted

Decision or mistake: Model Space still executed legacy/context/object-workbench branches after top projection rendered, so selection or edit state could leak mirrored house/deck/opening geometry back onto the plan.

Why it mattered: users could still see multiple plan truths at once even after projection-first rendering landed.

Current guardrail: geometry-ready Model Space must take the `top_projection_only` branch. Normal visible bodies come only from top-projection committed bodies, while legacy pergola geometry, semantic house context, reference footprints, model primary dimensions, fall labels, context shapes, and opening drag overlays stay out of normal Model Space rendering. Projection-backed selection and hit targets must come from `top_projection_committed`.

Promoted to: `docs/design-workbench-architecture.md`, `docs/costing-and-geometry.md`.

Related docs/tests: `apps/portal/app/staff/calculator/ModuleViewsCard.test.tsx`, `apps/portal/components/drawings/viewports/ModelSpaceViewport.test.tsx`, `docs/design-workbench-architecture.md`, `docs/costing-and-geometry.md`.

### 2026-05-01 - Plan Rendering - Overlay Source Ownership

Area: Plan Rendering

Status: Promoted

Decision or mistake: object-workbench overlays could still use the top-projection `house_reference` footprint or geometry-plan fallback polygon as the visible selection/hit body while the committed plan body came from the 3D top projection.

Why it mattered: normal Model Space could show a mirrored second house/deck plan even when committed body rendering was projection-first.

Current guardrail: projection-backed selection outlines and hit targets must bind to `top_projection_committed` polygons. Context/reference/fallback polygons may drive host/reference math, explicit footprint editing, or diagnostics, but their visible normal overlay counts must stay `0`.

Promoted to: `docs/design-workbench-architecture.md`, `docs/costing-and-geometry.md`.

Related docs/tests: `apps/portal/app/staff/calculator/ModuleViewsCard.test.tsx`, `apps/portal/lib/drawings/views/plan/buildPlanViewModel.test.ts`, `docs/design-workbench-architecture.md`, `docs/costing-and-geometry.md`.

### 2026-05-01 - Plan Rendering - Layer Ownership And Drag Round Trip

Area: Plan Rendering

Status: Promoted

Decision or mistake: geometry-ready plan mode still allowed top projection, object-workbench overlays, selection state, preview state, and commit rebuild geometry to draw or persist bodies through different coordinate contracts.

Why it mattered: selected decks could reintroduce a second house/deck body, and deck release could jump because the preview and persisted commit were not compared in the same canonical object plan space.

Current guardrail: geometry-ready normal visuals must flow through the plan render graph and only draw filled/stroked bodies from `committedBodies`. Selection may add transparent hit targets, outlines, handles, dimensions, and previews only. Deck drag preview, release commit payload, and rebuilt settled geometry must round-trip through canonical object plan metres, with projection-backed settle failures surfaced instead of silently snapping.

Promoted to: `docs/design-workbench-architecture.md`, `docs/costing-and-geometry.md`.

Related docs/tests: `apps/portal/app/staff/calculator/ModuleViewsCard.test.tsx`, `apps/portal/components/drawings/viewports/ModelSpaceViewport.test.tsx`, `apps/portal/lib/drawings/interactions/deckInteractionAdapter.test.ts`, `docs/design-workbench-architecture.md`, `docs/costing-and-geometry.md`.

### 2026-05-01 - Deck Interaction - Projection-Native Snap And Commit

Area: Deck Interaction

Status: Promoted

Decision or mistake: after Model Space became projection-only, deck drag still mixed top-projection live coordinates with geometry/object commit frames during snap and release.

Why it mattered: a deck preview could look correctly snapped in Model Space, then release to the opposite side or jump because the projected preview point was treated as an object-local commit point.

Current guardrail: geometry-ready deck drag uses committed top-projection frames for live hit, snap, and preview. Commit serialization maps the released preview through matching frame coordinates into canonical object plan metres; object/geometry frames are commit targets only, not live snap geometry.

Promoted to: `docs/design-workbench-architecture.md`.

Related docs/tests: `apps/portal/lib/drawings/views/plan/objectWorkbenchPlanOverlay.ts`, `apps/portal/lib/drawings/interactions/deckInteractionAdapter.test.ts`, `docs/design-workbench-architecture.md`.

### 2026-05-01 - Agent Routing - Change Routing Map

Area: Agent Routing

Status: Promoted

Decision or mistake: agent docs had the right learning loop, but future agents still had to infer which paths mapped to which owner docs and when docs needed updates.

Why it mattered: ambiguity causes extra repo scans, wrong-layer edits, duplicate docs, and missed documentation updates after behavior changes.

Current guardrail: before non-trivial portal work, use `docs/change-routing.md` to map changed paths to owner docs, doc update triggers, common task cards, and docs bloat rules.

Promoted to: `docs/change-routing.md`, `docs/agent-playbook.md`, `docs/README.md`, `AGENTS.md`.

Related docs/tests: `docs/change-routing.md`, `docs/testing-and-qa.md`, `npm run text:mojibake`.

### 2026-05-01 - Automation/Email/Audit - Side-Effect Owner Doc

Area: Automation/Email/Audit

Status: Promoted

Decision or mistake: automation events, email outbox, audit rows, project tasks, follow-ups, and marketing enquiry email behavior were visible in schema and code but did not have a focused owner doc.

Why it mattered: future side-effect changes can duplicate emails, miss idempotency keys, hide failures from staff, bypass audit records, or expand direct browser writes.

Current guardrail: before changing automation, email outbox, audit, follow-up, task, site-visit notification, or marketing enquiry email behavior, read `docs/automation-email-audit.md` and verify idempotency, outbox visibility, server-owned sends, and audit records.

Promoted to: `docs/automation-email-audit.md`, `docs/change-routing.md`, `docs/agent-playbook.md`, `docs/README.md`, `AGENTS.md`.

Related docs/tests: `docs/automation-email-audit.md`, `docs/supabase-schema-map.md`, `docs/security-privacy-quality.md`, `docs/testing-and-qa.md`.

### 2026-05-01 - Supabase Schema - Ownership Map

Area: Supabase Schema

Status: Promoted

Decision or mistake: active tables and RPCs were spread across migrations, route helpers, server helpers, and feature docs without one ownership map.

Why it mattered: future schema changes can bypass workflow owners, add direct browser writes, skip RLS/grants, or mutate public-token and Schedule V2 tables through the wrong boundary.

Current guardrail: before changing tables, RPCs, migrations, RLS, grants, or route Supabase access, read `docs/supabase-schema-map.md` and verify the owner doc, primary write path, primary read path, access boundary, migration source, and focused verification path.

Promoted to: `docs/supabase-schema-map.md`, `docs/agent-playbook.md`, `docs/README.md`, `AGENTS.md`.

Related docs/tests: `docs/supabase-schema-map.md`, `docs/environment-auth-supabase.md`, `docs/staff-api-auth-contracts.md`, `docs/testing-and-qa.md`.

### 2026-05-01 - API/Auth - Route Contract Doc

Area: API/Auth

Status: Promoted

Decision or mistake: staff, admin, public-token, diagnostics, response, and Supabase client boundaries were spread across helper files and feature docs without one route contract reference.

Why it mattered: future API changes can accidentally use the wrong auth helper, bypass route ownership, expose service-role access, skip token-hash checks, or return inconsistent diagnostics and error shapes.

Current guardrail: before changing staff, admin, or public-token API routes, read `docs/staff-api-auth-contracts.md` and verify auth helper choice, Supabase client boundary, diagnostics, response shape, and side-effect owner.

Promoted to: `docs/staff-api-auth-contracts.md`, `docs/agent-playbook.md`, `docs/README.md`, `AGENTS.md`.

Related docs/tests: `docs/staff-api-auth-contracts.md`, `docs/environment-auth-supabase.md`, `docs/quotes-invoices-job-packs.md`, `docs/testing-and-qa.md`.

### 2026-05-01 - Projects/Estimates - Core Workflow Doc

Area: Projects/Estimates

Status: Promoted

Decision or mistake: contacts, projects, calculator estimates, project snapshots, estimate locks, and local-first estimate mutations were spread across broad workflow, local-first, quote, and workbench docs without a dedicated current-state reference.

Why it mattered: future changes in this area can affect project detail state, pipeline tasks, estimate versioning, quote locks, local-first queues, design requests, quote creation, and downstream job-pack eligibility.

Current guardrail: before changing contacts, projects, project snapshots, calculator estimates, estimate locks, or local-first estimate mutation behavior, read `docs/projects-contacts-estimates-calculator.md` and verify the relevant route, domain, cache, and lock behavior.

Promoted to: `docs/projects-contacts-estimates-calculator.md`, `docs/agent-playbook.md`, `docs/README.md`, `AGENTS.md`.

Related docs/tests: `docs/projects-contacts-estimates-calculator.md`, `docs/local-first-sync.md`, `docs/quotes-invoices-job-packs.md`, `docs/testing-and-qa.md`.

### 2026-05-01 - Docs/Testing - Canonical Command Source

Area: Docs/Testing

Status: Promoted

Decision or mistake: broad command lists were repeated across entrypoint and architecture docs, creating drift risk when scripts or verification expectations change.

Why it mattered: future agents need one trusted place for repo commands so docs stay current and task-specific docs can focus on ownership, risks, and focused verification gates.

Current guardrail: keep general repo commands, docs-only checks, browser commands, and operational commands in `docs/testing-and-qa.md`. Other docs should link there and only list focused commands when the area needs a specific gate.

Promoted to: `docs/testing-and-qa.md`, `AGENTS.md`, `README.md`, `docs/architecture.md`, `docs/agent-playbook.md`, `docs/README.md`.

Related docs/tests: `docs/testing-and-qa.md`, `rg -n "/User[s]/|my[-]site|create[-]next[-]app|costing[-]baseline|\\.env\\.example" README.md AGENTS.md docs`, `npm run text:mojibake`.

### 2026-05-01 - Parallel Work - Universal Guardrails

Area: Parallel Work

Status: Promoted

Decision or mistake: the workbench-specific guardrail was broadened into universal parallel-work guardrails for concurrent work across marketing, portal, shared packages, docs, and workbench migration lanes.

Why it mattered: simultaneous marketing and portal work can drift across shared customer flows, quote and invoice routes, analytics and consent behavior, package contracts, and portal source-of-truth boundaries even when files do not conflict.

Current guardrail: before parallel lanes or cross-app work, read `docs/parallel-work-guardrails.md`, declare lane ownership, keep source-of-truth boundaries explicit, make temporary bridges visible, and run the named focused and integration checks.

Promoted to: `docs/parallel-work-guardrails.md`, `docs/agent-playbook.md`, `docs/README.md`, `AGENTS.md`.

Related docs/tests: `docs/parallel-work-guardrails.md`, `docs/platform-workflow.md`, `docs/testing-and-qa.md`, `npm run text:mojibake`.

### 2026-05-01 - Quotes/Invoices/Job Packs - Side-Effect Workflow Doc

Area: Quotes/Invoices/Job Packs

Status: Promoted

Decision or mistake: quote, invoice, public-token, PDF/email, and job-pack flows were identified as high-risk side-effect workflows without a dedicated canonical reference.

Why it mattered: future changes in these areas can affect public access, token security, generated files, email delivery, invoice retries, quote locks, project stages, and job-pack outputs.

Current guardrail: before changing these flows, read `docs/quotes-invoices-job-packs.md` and verify side effects, token boundaries, PDFs, emails, generated artifacts, and failure states.

Promoted to: `docs/quotes-invoices-job-packs.md`, `docs/agent-playbook.md`, `docs/README.md`, `AGENTS.md`.

Related docs/tests: `docs/quotes-invoices-job-packs.md`, `docs/platform-workflow.md`, `docs/testing-and-qa.md`.

### 2026-05-01 - Geometry Top Projection - Top Surface Contract

Area: Geometry Top Projection

Status: Promoted

Decision or mistake: mesh-backed house solids in the top projection used to trust render-mesh vertex-ring order and later face normals, which could still select or render lower envelope geometry when the plan needed the same visible top view as the 3D Top camera.

Why it mattered: model-space plan could look aligned to a bottom-up view of the 3D model even while sharing the same scene instance.

Current guardrail: top projection must follow the 3D Top camera convention: the camera is above world `+Z`, screen X is world `-X`, and screen Y down is world `+Y`. Roof and deck solids use semantic top boundaries; other mesh-backed solids use the highest non-vertical projected surface without trusting winding; lower envelope geometry must carry `topProjectionRole: hidden_from_top` and be filtered from normal Model Space rendering. Plan/3D accuracy changes must keep the top-view parity helper and fixture browser gate green.

Promoted to: `docs/costing-and-geometry.md`, `docs/design-workbench-architecture.md`, `docs/decision-log.md`.

Related docs/tests: `docs/costing-and-geometry.md`, `packages/geometry/src/topProjection.test.ts`, `npm run test -- packages/geometry/src/topProjection.test.ts packages/geometry/src/contracts.test.ts`.

### 2026-05-01 - Plan Rendering - Single Projection Body Source

Area: Plan Rendering

Status: Promoted

Decision or mistake: geometry-ready Model Space could draw top-projection bodies and object-workbench committed bodies at the same time, while Sheet View could still render the legacy plan path without the solved projection.

Why it mattered: users saw two offset versions of the deck/house in Model Space and a Sheet View that did not match the 3D Top view.

Current guardrail: geometry-ready plan rendering must use top projection as the single committed visual body source in both Model Space and Sheet View. Object-workbench overlays may keep object identity attrs for hit targets, previews, handles, and dimensions, but duplicate visual body diagnostics must remain `0`.

Promoted to: `docs/costing-and-geometry.md`, `docs/design-workbench-architecture.md`, `docs/decision-log.md`.

Related docs/tests: `apps/portal/app/staff/calculator/ModuleViewsCard.test.tsx`, `apps/portal/components/drawings/workbench/DrawingWorkbench.test.tsx`, `apps/portal/components/drawings/viewports/ModelSpaceViewport.test.tsx`.

### 2026-05-01 - Plan Rendering - Projection-Native Interaction Axes

Area: Plan Rendering

Status: Promoted

Decision or mistake: after switching plan visuals to top projection, context/reference projection bodies could still render like a second house/deck, and deck dragging used raw SVG plan coordinates instead of the inverse top-projection screen transform.

Why it mattered: users still saw doubled plan geometry and deck drag felt inverted: right moved left and up moved down relative to the rendered Model Space plan.

Current guardrail: geometry-ready normal plans render top-visible bodies only; context/reference bodies stay suppressed or non-body overlays, and deck drag point resolvers must invert the same `world_x_left_world_y_down` transform used to draw top projection.

Promoted to: `docs/costing-and-geometry.md`, `docs/design-workbench-architecture.md`, `docs/decision-log.md`.

Related docs/tests: `apps/portal/app/staff/calculator/ModuleViewsCard.test.tsx`, `apps/portal/components/drawings/viewports/ModelSpaceViewport.test.tsx`.

### 2026-05-01 - Docs - Agent Playbook

Area: Docs

Status: Promoted

Decision or mistake: recurring portal work needs a procedural playbook, not only an index of current-state references.

Why it mattered: future agents need a repeatable work loop for discovery, source-of-truth checks, risk routing, verification, docs maintenance, and learning from past corrections without requiring the user to intervene each time.

Current guardrail: agents should read `docs/agent-playbook.md` for non-trivial portal work. New lessons go to `docs/decision-log.md` first; only durable, repeatable behaviors should be promoted into the playbook.

Promoted to: `docs/agent-playbook.md`, `AGENTS.md`, `docs/README.md`.

Related docs/tests: `docs/agent-playbook.md`, `AGENTS.md`, `docs/README.md`, `docs/decision-log.md`.

### 2026-05-01 - Docs - Active Guardrail Docs

Area: Docs

Status: Promoted

Decision or mistake: `docs/design-workbench-parallel-migration-rules.md` was deleted during a docs cleanup even though it was still an active workbench migration authority.

Why it mattered: the cleanup treated all long historical-looking docs as stale, but this file carried live rules for parallel workbench migration safety.

Current guardrail: before deleting any doc, check whether it is a current reference, active guardrail, operational runbook, or historical artifact. Active guardrail docs must be restored or explicitly superseded by an equivalent canonical doc, with old paths preserved as redirects when future agents may search for them.

Promoted to: `docs/parallel-work-guardrails.md`, `docs/design-workbench-parallel-migration-rules.md`, `docs/agent-playbook.md`, `docs/README.md`, `AGENTS.md`.

Related docs/tests: historical predecessor `docs/design-workbench-parallel-migration-rules.md`, now superseded by `docs/parallel-work-guardrails.md`; `docs/README.md`; `AGENTS.md`.

### 2026-05-01 - Docs - Current References And Operating Rules

Area: Docs

Status: Promoted

Decision or mistake: the agent docs originally optimized for current-state references but did not clearly preserve active operating rules that guide ongoing migration work.

Why it mattered: future agents need both current architecture facts and procedural guardrails from past mistakes to work safely without repeated user intervention.

Current guardrail: docs may be either `Current` references or `Active guardrail` operating rules. `docs/README.md` must label them clearly, and agents should update relevant docs whenever implementation work changes behavior, boundaries, tests, or known risks.

Promoted to: `docs/README.md`, `AGENTS.md`, `docs/agent-playbook.md`.

Related docs/tests: `docs/README.md`, `AGENTS.md`, `docs/decision-log.md`.

### 2026-05-04 - Design Workbench Architecture - Read Edit Split: Plan Editor And 3D Viewer

Area: Design Workbench Architecture

Status: Active

Decision or mistake: the workbench had three viewport modes (`sheet`, `model`, `geometry3d`). The earlier plan was to collapse to a single canonical 3D editor where movement, gizmos, and tools all lived inside the R3F scene graph. That plan was revised: 3D editing inside R3F has too many ways for screen<->world coordinate math to leak into command paths, and overlays/gizmos in 3D fight orthographic camera presets when users want a clean drawing.

Why it mattered: this is the load-bearing architectural decision for every subsequent interaction feature. Picking the wrong surface for editing means the entire tool/snap/gizmo tree gets built against the wrong coordinate space.

Current guardrail: the workbench has two render surfaces, both derived from the same solved geometry artifact:

- **`Geometry3DViewport`** (read-only): the R3F scene graph. Camera presets, selection highlights for visual reference. **No drag handlers, no gizmos, no commit paths.** Selecting an object in 3D writes into shared selection state -- that is the only output 3D produces.
- **`PlanViewport`** (the editor): a 2D SVG/Canvas surface that consumes the same artifact (typically `topProjection` for committed polygon plan, plus the scene graph for snap targets and dimensions). **All editing lives here:** tools, gizmos, drag, snap, dimension overlays, hit targets.

The viewport mode switch becomes `Sheet | Plan | 3D`. The `'model'` mode and `ModelSpaceViewport.tsx` remain in the type union and codebase only until their non-3D responsibilities migrate into `PlanViewport`. Once `PlanViewport` is functional, the `'model'` mode is removed.

`DesignViewport.tsx` is the host that mounts the right surface for the active mode. It owns the typed selection seam (`selectionRouter.ts`) shared between 3D and Plan, but does not own editing chrome itself.

New workbench interaction code lives under `apps/portal/components/drawings/viewports/PlanViewport/{canvas,tools,interactions,gizmos,overlays}/` and `apps/portal/lib/drawings/commands/` -- never inside `ModelSpaceViewport`, never inside `Geometry3DViewport`, never inside `DesignViewport`.

Promoted to: None

Related docs/tests: `docs/design-workbench-architecture.md`, `apps/portal/components/drawings/viewports/DesignViewport.tsx`, `apps/portal/components/drawings/viewports/PlanViewport/`, `apps/portal/components/drawings/workbench/ViewportModeSwitch.tsx`.

### 2026-05-04 - Design Workbench Architecture - Nine Contracts For The Read Edit Split

Area: Design Workbench Architecture

Status: Active

Decision or mistake: as PlanViewport accretes tools, gizmos, snap, and dimension code, prior workbench experience shows it is easy to lose seam discipline -- interactions mutate state directly, drag math leaks pixel/screen coordinates into commit paths, scene objects get classified by string-matching ids, and editing chrome bleeds into the read-only 3D surface. Each of these is a category of bug we have already paid for at least once.

Why it mattered: future workbench work expects a large volume of interaction code. Cementing the right invariants up-front -- before tools and commands are written -- makes growth safe; retrofitting them later is expensive and tends to be skipped.

Current guardrail: every interactive feature added to PlanViewport (and the read-only 3D viewport) must obey nine contracts.

1. **Single source of truth.** Design intent is the only writable state. `WorkbenchSolvedGeometryArtifact`, `viewerScene`, and `topProjection` are derived. Tools never mutate intent directly; they issue a `Command` through the command bus.
2. **Three-phase drag.** Every transformative gesture implements `begin -> update -> commit`. `begin` snapshots state. `update` mutates a preview overlay only. `commit` issues a Command. Cancel reverts to the `begin` snapshot.
3. **Plan-projection math.** Drag deltas live in plan-projection coordinates (mm). Object-frame conversions happen at the commit boundary, never at the input edge. Screen<->plan conversion happens only at the pointer edge. The deck-projection drift class of bugs traces back to violating this rule.
4. **Typed selection.** `selectionRouter.ts` returns a discriminated `WorkbenchSelectionTarget` union shared by both 3D and Plan. No substring matching on scene object ids. Unhandled object families fall through to a typed `unhandled` case that is logged, not silently dropped.
5. **Tools are isolated state machines.** Only the active tool sees pointer events. `ToolDispatcher` owns tool activation and routes events. Switching tools cancels in-flight gestures. Tools live exclusively in PlanViewport.
6. **Snap is a service, not per-tool.** Tools query `snapEngine.query(point, context)` and receive a ranked list. They do not reimplement nearest-edge/midpoint/intersection logic per tool. The snap engine lives in PlanViewport.
7. **Gizmos and overlays are Plan-only and owned by tools.** Translation, rotation, and edge-drag handles are rendered above the selection by the active tool inside PlanViewport. 3D never renders editing chrome -- it only renders solved geometry plus a passive selection highlight.
8. **mm everywhere.** Every container that takes a numeric position, size, or delta types it as `Mm`. Pixel and screen units are confined to the pointer edge and never enter command payloads.
9. **3D is read-only.** `Geometry3DViewport` has no drag handlers, no gizmos, no commit paths. Selecting an object in 3D writes into shared selection state -- that is the only output 3D produces. Editing chrome must not be added to the 3D surface, even temporarily.

Promoted to: None

Related docs/tests: `docs/design-workbench-architecture.md`, `apps/portal/components/drawings/viewports/PlanViewport/`, `apps/portal/components/drawings/viewports/Geometry3DViewport.tsx`, `apps/portal/components/drawings/viewports/selection/selectionRouter.ts`, `apps/portal/lib/drawings/commands/`.

### 2026-05-06 - Decomposition / Refactor Hygiene - Copy Verbatim When Extracting

Area: Decomposition / Refactor Hygiene

Status: Active

Decision or mistake: while extracting helpers from `apps/portal/lib/quotes/serverCore.ts` into a new `rowMappers.ts` module, two helpers (`toStatus`, `safeStringArray`) were re-implemented from memory rather than copied byte-for-byte. The replacements had subtly different validation logic -- one accepted statuses the original rejected; the other lost a fallback branch. Caught at review before typecheck, but neither typecheck nor the existing call-site tests would have surfaced the drift because the changed behaviour only fires on edge-case inputs the existing tests do not exercise.

Why it mattered: decomposition refactors look "mechanical" but rewrites slip in easily -- "while I'm there" tidying is the standard way pure helpers acquire silent regressions. Because typecheck cannot see behavioural drift in pure helper bodies, and because callers' tests usually only cover the happy path of the refactored helper, this class of bug is invisible to local CI and tends to be discovered in production.

Current guardrail: when extracting helpers as part of a decomposition pass, copy byte-for-byte from the source file. Do not rename, retype, or "tidy" the helper while moving it. Behaviour-preserving improvements belong in a separate PR with their own tests. If the helper has no direct test, add one in the new module before the next functional change.

Promoted to: `docs/file-decomposition-and-ownership.md` (Operating Rule extraction-hygiene note)

Related docs/tests: `docs/file-decomposition-and-ownership.md`, `apps/portal/lib/quotes/rowMappers.ts`, `apps/portal/lib/quotes/serverHelpers.ts`, `apps/portal/lib/quotes/serverLoaders.ts`

### 2026-05-08 - PlanViewport / Pointer Events - Four Invariants For Pointer-Driven Tools

Area: PlanViewport / Pointer Events

Status: Active

Decision or mistake: while shipping the move tool (milestone 14), several user-visible bugs surfaced over multiple iterations -- pergola couldn't be selected, deck moved to a "random location," deck slid exponentially toward the corner with each commit, and (after a partial fix) the click was always cancelled mid-drag. Multiple plausible-but-wrong root causes were tried (geometry encode/decode math, viewBox cursor-scale runaway, null-point fallback) before the actual cause was found. The real root cause was at the React/DOM event boundary, not the geometry layer: `pointerCancel` was aliased to `pointerUp`, the SVG had no `touch-action: none`, primary-button drags didn't `setPointerCapture`, and the dispatcher had a `(0, 0)` fallback when the cursor couldn't be resolved. Any one of these alone produces wildly wrong delta values; together they hid the real failure mode behind defensive layers that "felt" like fixes.

Why it mattered: pointer events are the input boundary of every interactive tool. A bug there manifests as something happening to the deck/pergola/whatever, so investigation goes downstream into geometry first. The actual fixes are tiny (one CSS line, one capture call, one handler split, one helper extraction) but are LOAD-BEARING: removing any one re-introduces the bug. Future agents who "clean up" what looks redundant can re-ship the same regression. Worse, all 79 unit tests for MoveTool / commitDeckTransform / etc. passed throughout, because the boundary that actually fails has no JSDOM-level integration test (`SVGSVGElement.getScreenCTM` is not implemented in JSDOM).

Current guardrail: every pointer-driven tool added to PlanViewport must respect four invariants, enforced at [PlanCanvas.tsx](../apps/portal/components/drawings/viewports/PlanViewport/canvas/PlanCanvas.tsx) and [pointerDispatch.ts](../apps/portal/components/drawings/viewports/PlanViewport/canvas/pointerDispatch.ts):

1. **`touch-action: none`** on the SVG canvas. Browser default lets the gesture be stolen.
2. **`setPointerCapture(pointerId)` on every primary-button pointer-down.** Without capture, the browser fires `pointerleave`/`pointercancel` as soon as the cursor crosses any element boundary mid-drag.
3. **`pointerCancel` MUST call `dispatcher.cancelActiveTool()`, never dispatch as `pointerUp`.** Cancel events have `clientX/Y === 0`; routing them as up dispatches a synthetic release at world coord (0, 0)-derived, which (with pan/zoom applied) lands deep off-canvas. MoveTool computes `delta = bogusEnd - realStart` and the deck jumps proportional to its distance from origin; each commit grows the distance, making the next bogus delta larger -- the deck-runaway bug.
4. **The pure dispatch helper NEVER invents a coord on null.** `buildPointerDispatchAction` returns `{ type: 'skip' }` when the cursor can't be resolved. The previous shape-only fallback to `point: { x: 0, y: 0 }` poisoned MoveTool's session for any pointer-move/up where the SVG couldn't be measured.

Promoted to: `docs/maintainability-principles.md` (Coordinate-system footgun #5); `docs/design-workbench-architecture.md` (Milestone 14 -- pointer-event contract subsection)

Related docs/tests: `apps/portal/components/drawings/viewports/PlanViewport/canvas/PlanCanvas.tsx`, `apps/portal/components/drawings/viewports/PlanViewport/canvas/pointerDispatch.ts`, `apps/portal/components/drawings/viewports/PlanViewport/canvas/pointerDispatch.test.ts`, `apps/portal/components/drawings/viewports/PlanViewport/canvas/PlanCanvas.module.css`

### 2026-05-08 - Debugging Hygiene - Diagnose Before Theorising

Area: Debugging Hygiene

Status: Active

Decision or mistake: a user-reported runaway-drift bug was attacked through three iterations of theory-driven fixes (subtract house position in `buildDeckTransformPatch`; cap `PLAN_LAYOUT_MAX_DIMENSION_M`; bail on null point in dispatcher) before adding diagnostic logs. The logs immediately revealed the real cause -- a `pointerCancel` event with `clientX/Y === 0` was being committed as a `pointerUp` -- which none of the prior hypotheses matched. The first three fixes were defensible-but-wrong: each addressed a real possible failure mode, but none was THE cause, and shipping them as "fixes" without confirmation extended the time the bug was in production.

Why it mattered: when a hypothesis-driven fix doesn't work, the natural next move is to refine the hypothesis. But when symptoms don't match ANY current hypothesis, more theorising compounds the wrong-direction work. Five minutes of `console.log` at the suspected boundary collapses the hypothesis tree to one branch immediately. This is especially true for bugs at I/O / DOM boundaries (pointer events, browser APIs, network responses) where the actual data shape is hard to predict from code-reading alone.

Current guardrail: when a bug recurs after a "should have fixed it" change, stop iterating fixes. Add diagnostic logs at the suspected boundary (input edge, persistence edge, downstream consumer), reproduce, and let the data identify the root cause. Remove the logs after the fix lands. Defensive layers added during the wrong-direction work should be audited: keep what's load-bearing or cheap, remove what isn't, and document the rest with comments naming the bug they guard. Avoid leaving "I think this might also be needed" code in the tree -- it's indistinguishable from dead code to future maintainers.

Promoted to: None

Related docs/tests: this session's chain of fixes in [PlanCanvas.tsx](../apps/portal/components/drawings/viewports/PlanViewport/canvas/PlanCanvas.tsx), [planLayout.ts](../apps/portal/components/drawings/viewports/PlanViewport/canvas/planLayout.ts), [commitDeckTransform.ts](../apps/portal/lib/drawings/commits/commitDeckTransform.ts).

### 2026-05-08 - House Roof Topology - Dutch-Hip Migration Plan

Area: House Roof Topology

Status: Active

Decision or mistake: user requested "click hip triangle in plan view to convert that corner of a hipped roof to a gable end" -- with the goal of retiring the standalone `gable` roof form and replacing it with `hipped` + per-end open/closed toggles. The data model already supports this (`HouseModelConfig.openGableEndIds`) and the inspector already populates `terminalEnds` for any roof form, but the geometry pipeline gates open-end honouring behind `roofForm === 'gable'` (`packages/geometry/src/houseModel.ts:428`). For hipped roofs, `openGableEndIds` is currently a no-op -- the roof topology is built assuming all terminal ends are closed.

Why it mattered: properly opening one end of a hipped roof while keeping the others hipped is the "Dutch hip" / "half-hip" topology. The roof builder must remove the hip plane on the open end, extend the ridge to that end face, and adjust the trapezoidal main slopes to reach the new ridge endpoint. None of `roofRectangleHipped.ts`, `roofJoinedHipped.ts`, or `roofPrimary.ts` knows about partial conversion today. Lifting the gate alone produces inconsistent geometry (open-gable wall tag + hip plane drawn over it).

Current guardrail: the migration is multi-session work, organised around a UNIFICATION approach (not patching the existing per-form builders). Hipped and gable are degenerate cases of the same shape -- a rectangular roof with two terminal ends, each independently `'hipped' | 'open_gable'`. The patched alternative (add `openTerminalEndIds` parameter to existing per-form builders) duplicates topology rules across hipped + gable + Dutch-hip branches and leaves `gable` as a separate codepath -- inconsistent with the user's stated goal of retiring the gable form entirely. Unification keeps topology rules in one place and makes Dutch-hip a natural case (one end hipped, one open).

**Locked design choices** (confirmed with user):
- `type RidgeEndCap = 'hipped' | 'open_gable'` -- binary; no speculative third state.
- Remove `'gable'` from `HouseRoofForm` type union immediately in session C (not deferred). Robust normalize-migration MUST run before any type-narrowing read; load-time migration coverage is non-negotiable.
- Plan-view click target = first-class top-projection shape (`kind: 'house_terminal_end'`) with stable id; reuses existing PlanHitTargetLayer + hover halo + selection halo infrastructure.

Sequence:

1. **Session A (rectangle unification + Dutch-hip):**
   - New file `packages/geometry/src/house/roofRectangle.ts` exporting `buildRectangularRoof({ minX, maxX, minY, maxY, eaveHeightMm, roofPitchDeg, ridgeAxis, startCap, endCap })`. Body unifies today's `buildRectangleHippedRoof` (in `roofRectangleHipped.ts`) and `buildRectangularGableRoof` (in `roofPrimary.ts`), branched per-end on cap state.
   - Topology rules (ridge along X axis; mirror for Y; ignore for pyramid):
     - `startCap = 'hipped'`: emit `house-roof-min-x` triangular plane; ridge starts at `(input.minX + halfShort, centerY, ridgeZ)`; emit 2 hip features pointing at ridge start.
     - `startCap = 'open_gable'`: skip min-x plane; ridge starts at `(input.minX, centerY, ridgeZ)`; skip those 2 hip features; the `min-y` and `max-y` planes' western corners use the extended ridge start.
     - Same logic mirrored for `endCap` on the max-x side.
   - Existing entries `buildRectangleHippedRoof` and `buildRectangularGableRoof` become thin compat wrappers calling the unified builder with both caps set, until session C retires `gable`.
   - Lift the `roofForm === 'gable'` gate in `houseModel.ts:428` -- `openGableEndIds` is now meaningful for any rectangular roof regardless of form.
   - Plumb `openTerminalEndIds` through `buildHippedHouseRoof` -> `buildPrimaryHouseRoof` -> `buildSharedHouseRoof`.
   - Tests parameterised over (startCap, endCap) x ridgeAxis -- ~8 unique topologies. Equivalence assertions: `(hipped, hipped)` byte-equivalent to existing `buildRectangleHippedRoof`; `(open, open)` byte-equivalent to existing `buildRectangularGableRoof`. THIS IS THE MIGRATION SAFETY NET.

2. **Session B (joined / L-shape Dutch-hip):** the wavefront-based joined builder (`buildJoinedRoofWavefrontRegions` in `roofJoinedWavefront.ts`, 428 LOC) does NOT trivially extend to per-end caps -- the topology emerges from edge velocities + offset advancement, not from explicit ridge endpoints. Investigated mid-session A; honest scope is its own focused session. Two viable approaches surfaced:

   - **Approach A (true Dutch hip)**: set velocity = 0 on terminal-end edges in `joinedRoofWavefrontVertexVelocity` so those edges stay at the eave while neighbours advance. The neighbouring facets reach the now-stationary edge, forming a real gable end. Mental model matches "a gable wall has no inward roof advance." Implementation: extend `JoinedRoofWavefrontLoop` vertex velocity computation to flag stationary edges; trace impact through `advanceJoinedRoofWavefrontLoop`, edge-collapse + split logic, and `polygonizeJoinedRoofWavefrontSegments`. Wavefront is the most complex algorithm in the geometry package -- changes need careful test coverage (rectangle Dutch-hip via the joined path as a sanity check; explicit L-shape Dutch-hip cases). Probably a full session; possibly two if the velocity-zero edge case has unexpected interactions with edge collapse.

   - **Approach B (clipped gable / jerkin head)**: just remove facets/planes whose `metadata.sourceEdgeId` matches an open terminal end's source edge. Adjacent facets keep their inset-ridge boundaries; the gable wall apex sits at the hip apex height (NOT at the full ridge-line gable peak). Architecturally a real style ("jerkin head" / "clipped gable") but visually different from a full open gable. Implementation: ~1 hr post-hoc filter on `buildJoinedRectilinearHippedRoof`'s output. Documented limitation rather than the user's stated mental model.

   User chose Approach A. Implementation entry points:
   - `roofJoinedWavefront.ts:25` `joinedRoofWavefrontVertexVelocity` -- accept a `stationaryEdgeIds` set; when both edges of a vertex are stationary, vertex velocity = 0; when one is stationary, vertex slides along the stationary edge under the moving edge's pressure (analogous to a gable wall with one slope).
   - `roofJoinedWavefront.ts:318` `advanceJoinedRoofWavefrontLoop` -- skip distance-to-collapse / distance-to-split calculations for stationary edges (they never collapse or split).
   - `roofJoinedHipped.ts:16` `buildJoinedRectilinearHippedRoof` -- accept `openTerminalEndIds`, look up corresponding `sourceEdgeId`s via `deriveHouseGableTerminalEndsFromFootprint`, pass to wavefront as the stationary set.
   - Plumb through `buildHippedHouseRoof` (joined branch in `roofPrimary.ts`).
   - Tests: rectangle Dutch-hip via the joined path produces the same shape as session A's direct rectangular path (sanity check); explicit L-shape with one terminal end open produces a true gable extension (visual: roof slope removed, ridge extends, gable wall reaches the ridge apex).

3. **Session C (UI + type retirement):**
   - normalize-time migration: `roofForm: 'gable'` -> `roofForm: 'hipped'` + `openGableEndIds: [<all terminal ids>]`. MUST run before any read narrows the type. Test: load fixture with `roofForm: 'gable'`, assert post-normalize state is hipped+all-open and produces identical `HouseModel3D`.
   - Remove `'gable'` from `HouseRoofForm` type union in `contracts.ts` (and `houseFirstWorkbenchModel.ts`, `objectFirstWorkbenchModel.ts` -- 3 places). Remove `'gable'` from `HOUSE_ROOF_FORM_ORDER`. Retire `buildRectangularGableRoof` and the gable-specific builder in `roofPrimary.ts`.
   - Inspector: lift the `roofForm === 'gable'` gate in `HouseFormRoofSections.tsx:165`; rename "Open gable ends" label to something form-agnostic (e.g. "Roof ends").
   - Plan-view click target: extend `topProjection.ts` to emit one `kind: 'house_terminal_end'` shape per terminal end (id = the terminal-end id, polygon = the hip-triangle plan polygon for hipped state, the gable-end-face polygon for open state -- so the click target moves with the state). On click, toggle id in `openGableEndIds` via `commitSharedHouseFormRoof` action. Hover affordance reuses `PlanHoverHaloLayer`.

4. **Slice 2 follow-up (after slice 1 ships):** smart pergola-attachment prompt -- when a hip end is opened on a wall a pergola is attached to (or when a pergola is dragged onto an open-gable wall), prompt "convert pergola to gable form to match house gable height + pitch?" Auto-copies gable parameters.

Terminal-end ID format: `house-gable-end-x-{N}` or `house-gable-end-y-{N}` (`packages/geometry/src/house/roofJoinedGableTerminals.ts:67`). The `sourceEdgeId` field on each terminal end maps it to a footprint edge index.

Promoted to: None

Related docs/tests: `packages/geometry/src/houseModel.ts` (gating at line 428), `packages/geometry/src/house/roofRectangleHipped.ts`, `packages/geometry/src/house/roofJoinedHipped.ts`, `packages/geometry/src/house/roofPrimary.ts`, `packages/geometry/src/house/roofJoinedGableTerminals.ts`, `apps/portal/components/drawings/rail/HouseFormRoofSections.tsx:165`, `apps/portal/lib/drawings/state/objectWorkbenchStatusModel.ts:336`.

### 2026-05-12 - 3D Wall Rendering - Solid Walls, Inward Miter, and Renderable Open-Gable Boundaries

Area: 3D Wall Rendering

Status: Active

Decision or mistake: walls in the 3D viewport rendered as flat polygons that looked papery; on hipped roofs with one end opened (Dutch-hip), the resulting open-gable wall was not drawn at all. Three independent issues were uncovered while making walls render as 3D solids: (1) the 3D viewport had a wall-specific branch that ignored `renderMesh` and rebuilt geometry from `boundary` alone -- so any extrusion work in `envelopeSolids.ts` was silently discarded for walls; (2) the miter footprint helper was offsetting walls by `+/- half-thickness` (centered on the footprint edge), but the house footprint is defined as the outer face of the wall -- centered offsets push half the wall mass *outside* the house outline, and adjacent walls' centered offsets do not meet cleanly at corners; (3) the migrated-from-hipped open-gable wall arrived with a 4-vertex flat-top boundary (rectangle), not the 5-vertex apex shape native gable walls have, so the polygonal extruder had no apex to extrude -- the wall vanished into the roof. A naive reshape (always inject the apex) regressed native gable: those walls already have 5 vertices and re-inserting an apex produces a degenerate boundary.

Why it mattered: each issue masked the others. Bumping `DEFAULT_WALL_SOLID_THICKNESS_MM` from 90 -> 150 didn't make walls look thicker because the viewer was still rebuilding from boundary. Adding the polygonal extruder didn't make open-gable walls visible because they had no apex in their boundary. Fixing the reshape broke native gable until the `wallBoundaryHasFlatTop` guard landed. Future agents touching `envelopeSolids.ts`, `roofSolids.ts`, the viewer's `kind === 'wall'` path, or open-gable boundary handling can re-introduce any of these regressions individually.

Current guardrail: four rules apply when touching 3D wall rendering:

1. **Walls consume `renderMesh` first.** The 3D viewport's wall-rendering path in [Geometry3DViewport.tsx](../apps/portal/components/drawings/viewports/Geometry3DViewport/index.tsx) (around the wall-object useMemo) must call `buildRenderMeshGeometry(object.renderMesh) ?? buildPolygonSlabGeometry(...)`, in that order. Never reach for `boundary` before `renderMesh`.
2. **Miter footprints are inward-only.** Use `buildMiteredOffsetStripFootprints(footprint, 0, -DEFAULT_WALL_SOLID_THICKNESS_MM)` in [envelopeSolids.ts](../packages/geometry/src/house/envelopeSolids.ts), not the centered `buildMiteredStripFootprints(footprint, half)` variant. The footprint edge is the outer face of the wall; the interior extrudes inward toward the house centroid. Adjacent walls meet cleanly at corners only under this convention.
3. **Non-flat-top walls extrude polygonally.** When `wallBoundaryHasFlatTop(boundary)` is false (gable walls -- triangular or pentagonal top), the wall builder must call `buildPolygonalWallRenderMesh(boundary, planeNormal, thicknessMm)` in [roofSolids.ts](../packages/geometry/src/house/roofSolids.ts). This extrudes the closed polygonal boundary perpendicular to its plane via `+/- half-thickness`, fan-triangulates both faces, and bridges the sides with quads. Flat-top walls keep using `buildVerticalPrismRenderMesh` on the miter footprint.
4. **Open-gable boundary reshape is gated by `wallBoundaryHasFlatTop`.** In [houseModel.ts](../packages/geometry/src/houseModel.ts), when an `open_gable_frame` wall is migrated from hipped topology, its boundary arrives flat-top (4 vertices) and must be reshaped to insert the apex at `ridgeZ`. Native gable walls already have 5-vertex apex boundaries and MUST NOT be reshaped -- gating on `wallBoundaryHasFlatTop(segment.boundary)` is what distinguishes the two cases. Inserting an apex into an already-apex boundary degrades the wall.

Promoted to: None

Related docs/tests: [packages/geometry/src/house/envelopeSolids.ts](../packages/geometry/src/house/envelopeSolids.ts), [packages/geometry/src/house/roofSolids.ts](../packages/geometry/src/house/roofSolids.ts), [packages/geometry/src/house/buildPolygonalWallRenderMesh.test.ts](../packages/geometry/src/house/buildPolygonalWallRenderMesh.test.ts), [packages/geometry/src/houseModel.ts](../packages/geometry/src/houseModel.ts), [packages/geometry/src/houseModel.test.ts](../packages/geometry/src/houseModel.test.ts), [apps/portal/components/drawings/viewports/Geometry3DViewport/index.tsx](../apps/portal/components/drawings/viewports/Geometry3DViewport/index.tsx).

### 2026-05-12 - 3D Viewport Navigation - Trackpad-Friendly Mouse Bindings

Area: 3D Viewport Navigation

Status: Active

Decision or mistake: the design workbench 3D viewport used OrbitControls defaults -- LEFT = rotate, MIDDLE = dolly, RIGHT = pan -- which works fine with a 3-button mouse but is hostile on a MacBook trackpad. Trackpads have no MIDDLE button; right-click-drag on a trackpad is either a context menu (Safari) or two-finger gesture (varies). Users couldn't rotate the 3D view at all on Mac trackpads, and on the Plan (top-locked) view, LEFT-drag accidentally rotated the locked-top camera, producing visible tilt artifacts before snapping back.

Why it mattered: 3D viewport navigation is the primary "feel" interaction of the workbench. A confusing rotate/pan binding doesn't surface as a bug report -- users just feel the tool is broken. The fix is one tiny ternary in `mouseButtons`, but the principle (which button does what *depends* on which view-preset is active) is non-obvious and easy to regress when adding new view presets or wiring new controls.

Current guardrail: `OrbitControls.mouseButtons.LEFT` must branch on `lockedViewPreset` in [Geometry3DViewport.tsx](../apps/portal/components/drawings/viewports/Geometry3DViewport/index.tsx):

```ts
mouseButtons={{
  LEFT: lockedViewPreset === "top" ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: lockedViewPreset === "top" ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
}}
```

In top-locked views (Plan), LEFT must PAN -- rotation has no semantic in a top-locked camera. In Perspective (3D), LEFT must ROTATE so trackpad users can navigate at all. RIGHT mirrors LEFT for safety (some Mac trackpad gestures synthesize right-click). MIDDLE stays dolly. Any new view preset that locks the camera in a constrained axis must extend this branch -- pan, not rotate, on LEFT.

Promoted to: None

Related docs/tests: [apps/portal/components/drawings/viewports/Geometry3DViewport/index.tsx](../apps/portal/components/drawings/viewports/Geometry3DViewport/index.tsx).

### 2026-05-12 - Open-Gable Roof Frames - Triangular Top Profile Gate

Area: Open-Gable Roof Frames

Status: Active

Decision or mistake: [roofFrames.ts](../packages/geometry/src/house/roofFrames.ts) emits gable-end frame features (posts, top-chord) by walking the top-profile of an open-gable wall. The gate guarded `topProfile.length < 2`, intending to skip degenerate walls with no top profile. But triangular gable walls (a single apex point above the eave line) have a *1-point* top profile -- one vertex, no segment. The `< 2` gate skipped them entirely, producing open-gable walls with no frame features (the apex post and top-chord vanished).

Why it mattered: the failure mode is visually subtle -- the open-gable rectangle still renders (via `buildPolygonalWallRenderMesh`), but the frame timber detail is missing on the triangular variant only. Pentagonal flat-top gable walls (apex + two short verticals) have a 2-point top profile and were fine; triangular gable walls (apex only) silently lost their frames. The bug only manifests on roof presets that produce triangular gable boundaries.

Current guardrail: the gate is `topProfile.length < 1`, not `< 2`. A 1-point top profile is valid -- it's the apex, and the frame builder emits the two side-verticals from the eave corners to the apex (no top-chord segment, since `topProfile.length - 1 === 0`). Only `topProfile.length < 1` (zero vertices = degenerate) deserves the skip. When adding new wall-topology variants, double-check that `topProfile.length === 1` is treated as a valid case by every consumer.

Promoted to: None

Related docs/tests: [packages/geometry/src/house/roofFrames.ts](../packages/geometry/src/house/roofFrames.ts), [packages/geometry/src/houseModel.test.ts](../packages/geometry/src/houseModel.test.ts).

### 2026-05-13 - Plan Rendering - Suppress House Footprint When Roof Body Renders

Area: Plan Rendering

Status: Active

Decision or mistake: on Sheet (and projection-only Plan), houses with a `house_surface_solid + roof` committed body ALSO rendered a `house_reference + footprint` committed body. Both are top_visible polygons in the same active module's top-projection. Visually they produced overlapping strokes -- the roof outline (with eave overhangs) plus a concentric inner footprint outline (the wall outer face). On hipped roofs this looked like doubled house edges; on roofs with zero overhang the polygons could coincide entirely and stroke twice.

A first fix (commit `77a3a133`) suppressed `house_reference + footprint` at the render-graph level inside `buildProjectionPlanRenderGraph` whenever a roof body existed. That removed the visible double-stroke but ALSO removed the house's clickable polygon: the Plan canvas's hit-target layer derives from the same `committedBodies` array via `filterPlanHitTargets(committedBodies)`. After the fix, users could no longer click the house polygon on the Plan canvas to select the house -- they had to use the rail. The graph-level filter conflated "visible stroke" with "hit target."

Why it mattered: the same array (`committedBodies`) serves two distinct concerns -- visible rendering AND hit-testing -- and they have different requirements. Removing the canonical reference footprint from the graph removes BOTH, even when only one was the goal. The hit-target chain has no alternative anchor for house selection on the canvas. Future agents who push more responsibilities through `committedBodies` (selection, drag, dimensions) will hit the same trap if they suppress at the graph level.

Current guardrail: visual deduplication of the redundant house outline lives at the RENDER LAYER, not the graph. Specifically:

- In [planRenderGraph.ts](../apps/portal/lib/drawings/views/plan/planRenderGraph.ts), `buildProjectionPlanRenderGraph` filters out `house_surface[_solid] + footprint` shapes when a `house + roof` body exists (they are redundant footprint surfaces of a footprint), but KEEPS `house_reference + footprint`. The reference shape is the hit-target anchor for house selection.
- In [PlanCommittedBodyLayer.tsx](../apps/portal/components/drawings/viewports/PlanViewport/canvas/layers/PlanCommittedBodyLayer.tsx), the visible polygon list is filtered through [planVisibleBodyFilter.ts](../apps/portal/components/drawings/viewports/PlanViewport/canvas/planVisibleBodyFilter.ts) (`filterPlanVisibleBodies`). When a `house + roof` body is present, every `house + footprint` polygon (any sourceType) is dropped from the visible layer. The hit-target layer (different `<g>`) still sees the polygon, so clicks still work.
- In [ModulePlanLayerRenderers.tsx](../apps/portal/app/staff/calculator/ModulePlanLayerRenderers.tsx)'s `TopProjectionLayerRenderer` (Sheet view), the same render-time suppression applies. Sheet has no hit-target layer for the house so a render-only filter is sufficient.
- The non-active project-context overlay path (`buildProjectContextOverlayShapes` in workbenchSolvedModel.ts) is unaffected -- it filters `house_reference` out of the context overlay separately.

When the render graph eventually grows a dedicated `hitTargets` layer that is independent of `committedBodies`, the visible-only filter can collapse back into the graph filter. Until then, keep visible and hit-target concerns split across graph and render.

Promoted to: None

Related docs/tests: [apps/portal/lib/drawings/views/plan/planRenderGraph.ts](../apps/portal/lib/drawings/views/plan/planRenderGraph.ts), [apps/portal/lib/drawings/views/plan/planRenderGraph.test.ts](../apps/portal/lib/drawings/views/plan/planRenderGraph.test.ts), [apps/portal/components/drawings/viewports/PlanViewport/canvas/planVisibleBodyFilter.ts](../apps/portal/components/drawings/viewports/PlanViewport/canvas/planVisibleBodyFilter.ts), [apps/portal/components/drawings/viewports/PlanViewport/canvas/planVisibleBodyFilter.test.ts](../apps/portal/components/drawings/viewports/PlanViewport/canvas/planVisibleBodyFilter.test.ts), [apps/portal/components/drawings/viewports/PlanViewport/canvas/layers/PlanCommittedBodyLayer.tsx](../apps/portal/components/drawings/viewports/PlanViewport/canvas/layers/PlanCommittedBodyLayer.tsx), [apps/portal/components/drawings/viewports/PlanViewport/canvas/planHitTargetFilter.ts](../apps/portal/components/drawings/viewports/PlanViewport/canvas/planHitTargetFilter.ts), [apps/portal/app/staff/calculator/ModulePlanLayerRenderers.tsx](../apps/portal/app/staff/calculator/ModulePlanLayerRenderers.tsx), [apps/portal/lib/drawings/state/workbenchSolvedModel.ts](../apps/portal/lib/drawings/state/workbenchSolvedModel.ts) (`buildProjectContextOverlayShapes` for the project context-overlay path that still keeps `house_reference`).

### 2026-05-13 - Pergola Snap Targets - Every Attachable Perimeter Edge

Area: Pergola Snap Targets

Status: Active

Decision or mistake: `HouseModel3D.roofEaves` (`packages/geometry/src/houseModel.ts`) used to filter perimeter edges to `edgeKind === 'drain_eave'` only -- the v1 simplification was "pergolas attach to gutter-bearing edges." Two real cases break under this:

1. **Opened Dutch-hip gable end.** Milestone 13 lets a user open a hip end into a gable. The geometric consequence is that the adjacent roof plane disappears; `classifyHousePerimeterEdges` then labels the perimeter edge `weather_flashed_edge` (no draining plane above it). The user still wants to snap a pergola to that perimeter -- it's a valid attachment line in plan view. With the old filter, that edge was invisible to the snap engine.
2. **L-/U-shape apron joins.** Inner perimeter joins are classified `house_apron_edge`. The same omission applied.

Why it mattered: pergola placement is the workbench's primary interaction. "Some perimeter edges don't snap" surfaces as a feel/quality complaint that doesn't trip any test. The classifier's edge-kind labels are correct (they describe hydrology) but the downstream filter conflated hydrology with attachment eligibility.

Current guardrail: `HouseModel3D.roofEaves` includes every attachable perimeter edge -- `drain_eave`, `weather_flashed_edge`, and `house_apron_edge`. `HouseRoofEave3D.edgeKind` now spans all three values (was a literal `"drain_eave"`). Downstream consumers that truly need draining edges only (gutter rendering, flashing rules) re-filter on `edgeKind === 'drain_eave'` at their own call sites. The snap consumer (`buildHouseSnapTargets`) needs no change: it already emits one snap line per eave. When adding new perimeter classifications, default to "attachable" unless the geometry physically excludes pergola attachment (e.g. an inner courtyard with no ground access).

Promoted to: None

Related docs/tests: [packages/geometry/src/houseModel.ts](../packages/geometry/src/houseModel.ts), [packages/geometry/src/contracts.ts](../packages/geometry/src/contracts.ts) (`HouseRoofEave3D` edgeKind union), [packages/geometry/src/house/perimeterEdges.ts](../packages/geometry/src/house/perimeterEdges.ts) (the classifier; unchanged), [apps/portal/components/drawings/viewports/PlanViewport/interactions/snap/buildHouseSnapTargets.ts](../apps/portal/components/drawings/viewports/PlanViewport/interactions/snap/buildHouseSnapTargets.ts), [apps/portal/components/drawings/viewports/PlanViewport/interactions/snap/buildHouseSnapTargets.test.ts](../apps/portal/components/drawings/viewports/PlanViewport/interactions/snap/buildHouseSnapTargets.test.ts), [packages/geometry/src/houseModel.test.ts](../packages/geometry/src/houseModel.test.ts).

### 2026-05-13 - Plan Tool Chain - Terminal-End Click Yields to Edge Drag Within Tolerance

Area: Plan Tool Chain

Status: Active

Decision or mistake: this entry has two rounds. **Round 1** (commit `cae8cb13`): clicking the synthetic gable triangle to re-close an opened Dutch-hip end did nothing when the house was the active selection. `EdgeDragTool` is the entry tool in the Plan tool chain, and its `onPointerDown` accepts ANY click that lands within `edgeHitToleranceMm` of the active outline's perimeter. The synthetic gable triangle is built from `[apex, eaveStart, eaveEnd]` with the eave corners pushed outward by the eave overhang, so it overlaps the house outline's perimeter edge entirely. With the house selected, EdgeDragTool started a resize session, swallowing the click before the chain could fall through to `MoveTool` → `SelectTool`. Round-1 fix added an UNCONDITIONAL early-fallthrough on `event.shape?.metadata?.openGableEndId`, which routed every terminal-end click to SelectTool.

**Round 2:** the unconditional fallthrough swung the pendulum too far. The synthetic triangle's eave-corner extension covers a strip of the wall edge that the user reasonably expects to be the resize/drag affordance. With the round-1 fix in place, the user lost the ability to drag the wall edge anywhere the synthetic overlapped it -- every click in that strip routed to the toggle, never to edge drag. The fix needed to be distance-based, not categorical.

Why it mattered: same class of bug as the `pointerCancel` -> `pointerUp` aliasing in milestone 14 -- the user-visible symptom (toggle silently fails / wall drag silently fails) sits downstream of an input-layer boundary, and naive categorical fixes overshoot in the opposite direction. The lesson again: distinguish "click target" from "interactive region" -- they have different precedence rules when polygons overlap.

Current guardrail: `EdgeDragTool.onPointerDown` runs a single proximity check at the top of the handler and feeds the same answer to BOTH gates:

1. Compute `closest = findClosestPolygonEdge(outline.polygon, event.point)` and `withinEdgeTolerance = !!closest && closest.distanceMm <= tolerance`.
2. If `event.shape?.metadata?.openGableEndId` is a string AND NOT `withinEdgeTolerance` → fall through to SelectTool (the toggle path).
3. Else if no outline / no closest edge / not within tolerance → fall through to SelectTool (the existing non-edge-drag path).
4. Else start the edge drag session.

The contract: terminal-end toggle targets are click targets in the synthetic's INTERIOR only. Clicks on the synthetic's perimeter overhang that fall inside the active outline's `edgeHitToleranceMm` band are edge-drag clicks, not toggle clicks. Future tools added to the Plan chain that introduce "click-only" UI targets overlapping movable outlines MUST mirror this distance-based precedence (not a categorical fallthrough). Default tolerance is 250 mm (was 500); the smaller value addresses user feedback that wall hit boxes felt too generous AND naturally shrinks the band where edge drag and toggle compete.

If the chain grows more click-only UI targets, promote the proximity-check pattern into a shared helper (`shouldYieldToActiveOutlineEdgeDrag(event, outline, tolerance)`) consumed by every tool's `onPointerDown`.

Promoted to: None

Related docs/tests: [apps/portal/components/drawings/viewports/PlanViewport/tools/EdgeDragTool.ts](../apps/portal/components/drawings/viewports/PlanViewport/tools/EdgeDragTool.ts), [apps/portal/components/drawings/viewports/PlanViewport/tools/EdgeDragTool.test.ts](../apps/portal/components/drawings/viewports/PlanViewport/tools/EdgeDragTool.test.ts) ("terminal-end toggle priority vs. edge drag" describe block: falls through when far from the edge; starts edge drag when within tolerance), [apps/portal/components/drawings/viewports/PlanViewport/interactions/selectShape.ts](../apps/portal/components/drawings/viewports/PlanViewport/interactions/selectShape.ts), [apps/portal/components/drawings/viewports/selection/selectionRouter.ts](../apps/portal/components/drawings/viewports/selection/selectionRouter.ts) (`house_terminal_end_toggle` classification), [packages/geometry/src/topProjection.ts](../packages/geometry/src/topProjection.ts) (`enrichHouseRoofShapesWithTerminalEnds` -- emits synthetic triangle with `openGableEndId` + `isOpen` metadata).

### 2026-05-13 - House Roof Topology - Gable Form Migration Must Be Ported on First Toggle

Area: House Roof Topology

Status: Active

Decision or mistake: clicking the synthetic gable triangle on the Plan canvas to re-close an opened end did nothing -- even after the EdgeDragTool early-fallthrough (`cae8cb13`) and all the diagnostic instrumentation passed every hop. The entire chain (PlanHitTargetLayer → EdgeDragTool fallthrough → SelectTool → callback) was firing correctly. The callback received `endId: 'house-gable-end-x-1'` and `currentlyOpen: true`, but `currentRoof.openGableEndIds` came back as `[]` -- empty. So the toggle's logic (`currentlyOpen ? filter(id !== endId) : [...currentOpenIds, endId]`) produced `[].filter(...) === []`, committed an empty list, and the user saw no change. The root cause was state inconsistency: the workbench had `roofIntent.form === 'gable'` with empty `openGableEndIds`, but the geometry normalize layer at `packages/geometry/src/normalize.ts:691-720` carries a milestone-13 compat migration that treats `roofForm: 'gable'` as "hipped + every terminal end open" regardless of the explicit `openGableEndIds`. So the GEOMETRY topology renders every end open while the WORKBENCH state has `openGableEndIds: []`. Any toggle from this implicit state is a no-op because there's nothing in the explicit set to remove, and the migration re-opens every end on the next solve.

Why it mattered: this is the second-order failure mode after the EdgeDragTool fix. Two rounds of theory-based fixes ran before instrumentation pinpointed it. The lesson, repeated from `2026-05-08 Debugging Hygiene`: a wired-up pipeline that silently fails almost always means state is split across two consumers that LOOK like they should agree but don't. The migration was correctly documented in `normalize.ts` but never ported back into the workbench draft -- so the rail's "Open"/"Close" buttons on a gable form also look like they don't work (clicking them commits `[]` and the migration re-opens everything anyway). The Plan toggle inherited the same bug.

Current guardrail: any UI toggle that operates on a single terminal end's open state MUST go through [`resolveHouseTerminalEndToggleRoofDraft`](../apps/portal/app/staff/projects/[projectId]/design-workbench/resolveHouseTerminalEndToggleRoofDraft.ts) (or replicate its semantics exactly). When the current roof's `form === 'gable'`, that helper converts to `form: 'hipped'` and seeds `openGableEndIds` from the full terminal-end set (minus the one being closed, or plus the one being opened). This ports the implicit migration into explicit workbench state in one commit, so subsequent reads of `openGableEndIds` agree with the rendered topology and every future toggle works as the user expects.

Future agents:
- ~~The rail's open-end toggle at [HouseFormRoofSections.tsx:188-195](../apps/portal/components/drawings/rail/HouseFormRoofSections.tsx) currently still uses inline logic that has the same bug for gable-form roofs. Migrating it to use the shared helper is the obvious next step; do it the next time the rail is touched.~~ **DONE 2026-05-14:** the rail's toggle now routes through `resolveHouseTerminalEndToggleRoofDraft`. Both the Plan canvas and the rail share the helper; the gable-migration bug is fixed on both surfaces.
- ~~The deeper fix is to migrate `form: 'gable'` -> `form: 'hipped' + openGableEndIds: <all terminals>` at the workbench draft normalization boundary so every consumer reads coherent state.~~ **DONE 2026-05-14 (Slices 2 + 2B):** the migration runs at TWO boundaries: (1) `normalizeHouseFormRoofIntent` (workbench draft normalize) migrates when an explicit footprint polygon is present; (2) `migrateGableToHippedForGeometryInput` in `apps/portal/lib/drawings/geometry/buildRawGeometryModuleInput.ts` is the catch-all -- it runs against the always-resolved polygon (`houseForm.footprint.polygon || resolveFootprintPolygon(module)`) so every geometry input is `'hipped' + openGableEndIds: <list>`, never `'gable'`. The `openGableEndIds` auto-derivation in `packages/geometry/src/normalize.ts:691-720` is RETIRED (replaced with a one-line pass-through of `resolveHouseOpenGableEndIds`). The form-name narrowing at `normalize.ts:506` (`rawRoofForm === 'gable' ? 'hipped' : rawRoofForm`) STAYS as a defensive safety net for direct geometry callers that bypass `buildRawGeometryModuleInput`. Inspector `terminalEnds[].isOpen` keeps the `intent.form === 'gable' ? true : ...` fallback for the rare workbench-state-only-sees-gable case. **Milestone 13 session C** (dropping `'gable'` from the `HouseRoofForm` type union, retiring `buildRectangularGableRoof` and the gable-specific builder in `roofPrimary.ts`) is now unblocked.
- When adding new consumers that read `roofIntent.openGableEndIds` for behavior (snap targets, rail badges, etc.), if the user expects the result to match the rendered topology, those consumers must either run the migration themselves or assume the helper has already ported the state.

Promoted to: None

Related docs/tests: [apps/portal/app/staff/projects/[projectId]/design-workbench/resolveHouseTerminalEndToggleRoofDraft.ts](../apps/portal/app/staff/projects/[projectId]/design-workbench/resolveHouseTerminalEndToggleRoofDraft.ts), [apps/portal/app/staff/projects/[projectId]/design-workbench/resolveHouseTerminalEndToggleRoofDraft.test.ts](../apps/portal/app/staff/projects/[projectId]/design-workbench/resolveHouseTerminalEndToggleRoofDraft.test.ts), [apps/portal/app/staff/projects/[projectId]/design-workbench/DesignWorkbenchEstimateClient.tsx](../apps/portal/app/staff/projects/[projectId]/design-workbench/DesignWorkbenchEstimateClient.tsx) (`onToggleHouseTerminalEnd` callsite), [packages/geometry/src/normalize.ts](../packages/geometry/src/normalize.ts) (the migration at lines 691-720), [apps/portal/components/drawings/rail/HouseFormRoofSections.tsx](../apps/portal/components/drawings/rail/HouseFormRoofSections.tsx) (still-buggy rail toggle to migrate).

### 2026-05-14 - Plan Snap Engine - Corner Snap Extends MoveTool

Area: Plan Snap Engine

Status: Active

Decision or mistake: the snap engine was single-line for years -- each MoveTool/EdgeDragTool drag resolved at most one `EdgeSnapResult` and applied one perpendicular correction along the snapped edge's normal. Users couldn't snap a pergola or deck to a HOUSE CORNER cleanly: dragging toward a corner attracted to one wall, but the orthogonal axis stayed free, so the user had to drag along the snapped wall to align the second edge by eye. CAD users have a baked-in expectation of corner snapping; without it the workbench's feel was off in attachment workflows.

Why it mattered: the constraint was a RESOLUTION choice, not a structural limit. `SnapLineTarget` already carries direction (bounded segment endpoints); the engine just never asked "is there a non-parallel partner in tolerance?" The deck system already proved the persistence side: deck shapes store `primaryHostEdgeId + secondaryHostEdgeId + cornerVertexId` (`deckInteractionContract.ts`), and `deckCommitAdapter.ts` resolves both reference frames before committing. The piece that was missing was the SNAP RESOLVER stage -- detecting the pair, computing the intersection, and producing a 2D delta that lands the moving polygon's corner there in one shot.

Current guardrail: corner snap lives in [`resolveMoveSnap`](../apps/portal/components/drawings/viewports/PlanViewport/tools/resolveMoveSnap.ts) only. EdgeDragTool's motion is 1D (perpendicular to the dragged edge) -- a second axis doesn't exist, so corner snap doesn't apply.

`resolveMoveSnap` runs a two-pass search:

1. **Primary** -- the existing single-line search across every polygon edge against every target. Smallest-correction wins.
2. **Secondary (corner partner)** -- on a DIFFERENT polygon edge (`excludeEdgeIndex` guard), against targets whose direction is at least `cornerMinAngleDeg` (default 30 deg) away from the primary's. The same per-edge distance/parallelism gates run; smallest-correction wins among the filtered candidates.

When a secondary is found, the resolver solves the 2x2 system `[primary_normal; secondary_normal] . delta = [primary_snapDeltaMm; secondary_snapDeltaMm]` for the 2-vector `delta`. After applying `delta`, both edges sit exactly on their target lines; their shared corner sits on the intersection of the two target lines (computed and returned as `cornerVertex`). Existing single-line callers see `secondary: undefined` and unchanged behaviour.

The visual indicator layer ([PlanMoveSnapIndicatorLayer in PlanSnapIndicatorLayer.tsx](../apps/portal/components/drawings/viewports/PlanViewport/canvas/layers/PlanSnapIndicatorLayer.tsx)) renders both snap lines + a marker at `cornerVertex` when secondary is present; the primary-only render path is unchanged.

Future agents:
- This slice ships the visual + geometric corner snap. The commit path still persists a single primary host edge for pergolas. Persistent dual-host attachment for pergolas (mirroring the deck `primaryHostEdgeId/secondaryHostEdgeId/cornerVertexId` data-model extension) is a separate slice -- gated on a clear product ask, since the geometric corner snap alone gives the user the "feel" they were asking for.
- When adding new snap target families (opening edges, deck edges as pergola hosts, etc.), make sure the new targets carry bounded `start`/`end` so `targetsFormCornerPair` can compute a direction vector. Targets without orientation can't participate in the secondary search.
- `cornerMinAngleDeg` is per-call, not per-family. If pergola-vs-deck have different "what counts as a corner" thresholds, expose per-family overrides at the MoveTool config layer (mirror `houseEdgeHitToleranceMm` / `pergolaEdgeHitToleranceMm` pattern flagged in the "Terminal-End Click Yields to Edge Drag" entry).

Promoted to: None

Related docs/tests: [apps/portal/components/drawings/viewports/PlanViewport/tools/resolveMoveSnap.ts](../apps/portal/components/drawings/viewports/PlanViewport/tools/resolveMoveSnap.ts), [apps/portal/components/drawings/viewports/PlanViewport/tools/resolveMoveSnap.test.ts](../apps/portal/components/drawings/viewports/PlanViewport/tools/resolveMoveSnap.test.ts) ("corner snap (two non-parallel targets in tolerance)" describe block), [apps/portal/components/drawings/viewports/PlanViewport/canvas/layers/PlanSnapIndicatorLayer.tsx](../apps/portal/components/drawings/viewports/PlanViewport/canvas/layers/PlanSnapIndicatorLayer.tsx) (`PlanMoveSnapIndicatorLayer` renders secondary + corner marker), [apps/portal/lib/drawings/interactions/deckInteractionContract.ts](../apps/portal/lib/drawings/interactions/deckInteractionContract.ts) (`corner_dual_edge` deck attachment precedent), `apps/portal/lib/drawings/interactions/deckReleaseSettlementController.ts` (dual-edge commit precedent: searches for `secondaryHostEdgeId` to see the settlement flow).

### 2026-05-14 - House Roof Topology - Session C: HouseRoofForm 'gable' Retirement

Area: House Roof Topology

Status: Active

Decision or mistake: closes Milestone 13. Earlier sessions made `'gable'` topologically redundant -- a `'hipped'` roof with every terminal end open produces identical geometry via the unified Dutch-hip rectangle/joined builder. Sessions 2 and 2B migrated the workbench draft state and the geometry input boundary so `'gable'` was never produced at runtime, only consumed from legacy storage. Session C completes the retirement at the TYPE level: `HouseRoofForm` is now `'flat' | 'mono' | 'hipped'`, and `'gable'` is mapped to `'hipped'` at the two normalize boundaries before it crosses any typed surface. The picker, rail labels, validators, dispatcher branches, and inspector derivations that handled `'gable'` are all simplified or removed.

Why it mattered: the `'gable'` literal was the only remaining handle for legacy gable behavior that survived sessions A/B. Keeping it in the type union meant every form-aware consumer (validators, dispatchers, snap-target builders, inspector derivations, rail labels) had to carry a `form === 'gable' || form === 'hipped'` branch. ~30 conditional branches across the geometry package + portal app boiled down to either `form === 'hipped'` or unconditional logic, and the dispatcher in `roofPrimary.ts:540` no longer routes to `buildGabledHouseRoof` -- it always calls `buildHippedHouseRoof`.

Current guardrail: legacy gable storage continues to round-trip safely. Two narrowing points map `'gable'` to `'hipped'`:

1. `resolveHouseRoofForm` in [packages/geometry/src/normalize.ts](../packages/geometry/src/normalize.ts): geometry-side input safety net. Accepts the wider `HouseRoofForm | 'gable'` input type and returns the narrowed `HouseRoofForm`.
2. `normalizeHouseFormRoofIntent` in [apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts](../apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts): workbench draft normalize. Detects legacy `'gable'` via string comparison (cast through `unknown`), maps to `'hipped'`, and when an explicit polygon is available seeds `openGableEndIds` with the all-terminals-open set so the rendered topology matches what gable-form houses produced before.

Internal builders kept and re-wired: `buildGabledHouseRoof` (and its delegate `buildBentSpineJoinedGableRoofX`) is back in the dispatcher's joined path -- the wavefront-based `buildJoinedRectilinearHippedRoof` does not produce the closure metadata + `bent_spine_joined_gable` geometry kind that downstream consumers (rail, plan view, terminal-closure walls) expect for the legacy gable topology on U / wrap footprints. `buildHippedHouseRoof` now detects "every active-axis terminal end is open" and routes through `buildGabledHouseRoof`; partial-open joined cases still go through the wavefront with stationary edges. `buildRectangularGableRoof`, `buildJoinedRectilinearGableRoof`, and `buildLegacyJoinedRectilinearGableRoof` typecheck (their internal `metadata.roofForm` was changed from `'gable'` to `'hipped'`) but have no production callers; they can be deleted in a follow-up.

Capability + validation surface changes:

- `HOUSE_ROOF_FORM_BEHAVIORS.hipped.controls.appendage = true` (was `false`). Hipped subsumes the retired gable form, which previously surfaced the appendage band. Without this, every authored appendage on a legacy gable-form house silently dropped at the rail boundary on upgrade.
- `appendageAllowed = sharedRoofForm === 'mono' || sharedRoofForm === 'hipped'` in [houseFirstWorkbenchAdapter.ts](../apps/portal/lib/drawings/state/houseFirstWorkbenchAdapter.ts) (was `'mono' || 'gable'`). Mirrors the capability change.
- `getHouseRoofFormBehavior` falls back to the hipped behavior for unrecognized form names, so direct geometry callers that pass legacy serialized `'gable'` strings get a sane footprint requirement instead of an undefined-property crash.
- `deriveHouseRoofGeometryKind` now accepts optional `openGableEndIds` + `roofRidgeAxis`. When every active terminal end is open on a joined footprint it reports `'bent_spine_joined_gable'`; partial-open + closed cases stay `'rectilinear_joined_hipped'`. The rail's geometry kind label tracks the dispatcher.
- `walls.ts:buildWallSegments` triggers roof-aligned wall top profiles on `roofGeometry === 'bent_spine_joined_gable'` instead of `roofForm === 'gable'`. The rectangular all-open (`startCap === 'open_gable' && endCap === 'open_gable'`) case keeps a flat-top wall and relies on the existing reshape in `buildHouseModel3D` to triangulate to `[groundStart, groundEnd, apex]`. Without this split, rectangular gable produced 5-point gable walls while joined gable produced 4-point flat-top walls.
- Frame features built by `buildOpenGableFrameFeatures` get the parent roof's `roofQaStatus` stamped in `buildHouseModel3D` after construction, so the `model.roofFeatures.every(f => f.metadata.roofQaStatus === 'valid')` invariant holds across the synthetic + builder-emitted feature sets.

Known regression: legacy gable-form houses stored in PRESET MODE (no explicit polygon at the workbench draft normalize boundary) now load as `'hipped'` with empty `openGableEndIds`. The geometry pipeline previously force-opened every end via the compat migration at `normalize.ts:691-720`; that compat was retired in slice 2B. For preset-mode houses, the user needs to re-open the desired ends from the rail or Plan canvas after upgrade. Custom-polygon houses (the common case) migrate fully; the `setObjectFirstRoofIntent` -> `normalizeHouseFormRoofIntent` path with `polygon: [...]` seeds `openGableEndIds` from the resolved terminals.

Future agents:
- The dead-code gable builders (`buildRectangularGableRoof`, `buildGabledHouseRoof`, `buildJoinedRectilinearGableRoof`, `buildLegacyJoinedRectilinearGableRoof`, related terminal helpers) can be deleted in a follow-up cleanup once their test coverage is verified to exist elsewhere.
- The cast `value?.form as unknown as 'hipped'` in `normalizeHouseFormRoofIntent` is the safety net for legacy storage. If a future schema validator runs BEFORE this normalize, the cast becomes redundant.

Promoted to: None

Related docs/tests: [packages/geometry/src/contracts.ts](../packages/geometry/src/contracts.ts) (`HouseRoofForm` union), [packages/geometry/src/houseRoofValidation.ts](../packages/geometry/src/houseRoofValidation.ts) (`HOUSE_ROOF_FORM_BEHAVIORS`, `HOUSE_ROOF_FORM_ORDER`), [packages/geometry/src/normalize.ts](../packages/geometry/src/normalize.ts) (`resolveHouseRoofForm`), [packages/geometry/src/house/roofPrimary.ts](../packages/geometry/src/house/roofPrimary.ts) (`buildPrimaryHouseRoof` dispatcher), [apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts](../apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts) (`normalizeHouseFormRoofIntent`), [apps/portal/components/drawings/rail/HouseFormRoofSections.tsx](../apps/portal/components/drawings/rail/HouseFormRoofSections.tsx) (rail picker + open-end toggles), [apps/portal/app/staff/projects/[projectId]/design-workbench/resolveHouseTerminalEndToggleRoofDraft.ts](../apps/portal/app/staff/projects/[projectId]/design-workbench/resolveHouseTerminalEndToggleRoofDraft.ts) (now a plain hipped toggle since the migration moved upstream).

### 2026-05-14 - House Roof Topology - Partial-Open Joined Topology Wavefront Fix

Area: House Roof Topology

Status: Active

Decision or mistake: clicking ONE terminal end on a U / wrap footprint produced invalid geometry (`roof_topology_face_count_mismatch:5:8`) because the wavefront-based joined-hipped builder's facet validator was strict in two places that don't hold for partial-open topologies:

1. `roofPointOnEaveBoundaryAtWrongHeight` rejected any facet whose boundary touched the eave polygon at a z != eaveHeightMm. For a slope adjacent to a stationary gable edge, the slope legitimately reaches the eave at apex z (the gable wall fills the vertical gap). The validator now accepts those raised-boundary points when `allowRaisedBoundaryPoints: true` is plumbed through; `buildJoinedRectilinearHippedRoof` opts in only when any edge is stationary, so the fully-hipped case stays strict.

2. The `face_count_mismatch` topology check compared `facets.length` to `input.edges.length`. Stationary edges intentionally produce ZERO slope facets (the vertical gable wall replaces the slope), so the expected count is `input.edges.length - stationaryEdgeCount`. Detected by counting edges with `|inwardNormal| <= ROOF_JOIN_EPSILON_MM`.

Why it mattered: before this fix, the only way to see bent-spine gable peaks on a U / wrap was to open BOTH terminal ends (which routes through `buildGabledHouseRoof`, a separate code path). Individual click-toggling was a no-op visually because the workbench fell back to invalid-geometry rendering. The user expectation (per session B) is that each terminal end is independently toggleable -- this fix makes that work for joined footprints, matching the rectangular case.

Future agents:
- `allowRaisedBoundaryPoints` is now plumbed through `buildJoinedRoofFacets`. The flag is consumed only by `roofPointOnEaveBoundaryAtWrongHeight`; other validators (finite boundary, non-zero area, simple polygon) still apply. Adding similar pre-existing-strict checks should mirror this opt-in shape.
- The stationary-edge count is derived from the edge's inward normal (`Math.hypot(inwardNormal.x, inwardNormal.y) <= ROOF_JOIN_EPSILON_MM`). If a future builder wants to encode "stationary" differently (e.g. a flag), update both the velocity treatment in `roofJoinedWavefront.ts` and the count in `roofJoinedFacets.ts`.

Current guardrail: joined-hipped facet validation must treat stationary-edge topology as a first-class case, not an error. Any new pre-existing-strict validator (raised-point checks, face counts, ridge-graph completeness) must either skip stationary edges or accept the resulting partial-open geometry; opt-in via `allowRaisedBoundaryPoints` for boundary-height checks, and subtract `stationaryEdgeCount` from any "expected facets equals edges" comparison.

Promoted to: None

Related docs/tests: [packages/geometry/src/house/roofJoinedFacets.ts](../packages/geometry/src/house/roofJoinedFacets.ts) (`allowRaisedBoundaryPoints` + stationary-edge-aware face-count check), [packages/geometry/src/house/roofJoinedHipped.ts](../packages/geometry/src/house/roofJoinedHipped.ts) (passes flag when stationary edges exist), [packages/geometry/src/houseModel.test.ts](../packages/geometry/src/houseModel.test.ts) (regression test: "produces valid joined-hipped geometry when ONE terminal end is opened on a U/wrap footprint").

### 2026-05-21 - Design Workbench Testing - ModelSpaceViewport Fixture Rot

Area: Design Workbench Testing

Status: Active

Decision or mistake: 8 tests in `apps/portal/components/drawings/viewports/ModelSpaceViewport.test.tsx` fail on `main` with `data-plan-render-status="invalid_geometry"`. These are NOT a regression in shipped code — the neighbouring 30 `PlanViewport` / `Geometry3DViewport` tests pass against the same render pipeline, and `typecheck` is clean. The failures are localised stale-fixture rot from the milestone-13 `objectWorkbenchOverlayInput` contract change. Two of the test bodies have explicit `TODO(milestone-13): migrate to the new objectWorkbenchOverlayInput shape` comments left next to `as unknown as Parameters<typeof buildPlanViewModel>[0]` casts (the May 11 "build error" commit silenced the type errors but didn't finish the fixture migration). Tests 727 (resize handles) and 794 (house-first overlays) drive resize-handle / hit-target rendering for the primary dimension-editing path; tests 957 / 992 / 1028 / 1156 / 1220 are interaction tests that need those hit targets to exist before they can dispatch events; test 2435 is a separate draw-outline state-machine assertion (unrelated to geometry).

Why it mattered: this is the kind of failure that compounds across PRs if the surface gets touched. A future agent making any HouseModel / plan-render change will see these same 8 fail and may assume their change caused them, or worse, may add their own `as unknown` cast to keep things green. The contract-change debt has to be paid down with a real migration.

Fix path (Phase A — geometry/render, ~half day): trace why `buildAssemblyModel({ planModel })` no longer surfaces `planModel` into the resulting `DrawingAssemblyModel`; replace the two `as unknown as ...` casts (lines ~444, ~777) with properly-shaped `objectWorkbenchOverlayInput` objects matching the type at [buildPlanViewModel.ts:79](../apps/portal/lib/drawings/views/plan/buildPlanViewModel.ts#L79). Phase B (~1-2h): the draw-outline test at line 2435 is a separate state-machine bug — either the preceding `dispatchPointer` calls no longer correspond to the gesture they intend, or the state machine changed its precedence and the test encodes obsolete behaviour. Phase C (~30m): once green, remove the `as unknown` casts and the `TODO(milestone-13)` comments so the type system catches the next fixture drift before the tests do.

Current guardrail: do NOT add more `as unknown as Parameters<typeof buildPlanViewModel>[0]` casts. If a future change makes these tests easier to migrate (e.g. a focused harness for the new overlay-input shape), take the migration in that PR instead of deferring again. Multi-form work (PR8+ in the multi-house-form sequence) verifies against the PR6/PR7 integration tests in `houseFirstWorkbenchAdapter.test.ts` and the passing `PlanViewport` / `Geometry3DViewport` suites; do not block on these 8 unless touching the same surface.

Promoted to: None

Related docs/tests: [apps/portal/components/drawings/viewports/ModelSpaceViewport.test.tsx](../apps/portal/components/drawings/viewports/ModelSpaceViewport.test.tsx) (failing tests, casted fixtures, TODO comments), [apps/portal/lib/drawings/views/plan/buildPlanViewModel.ts](../apps/portal/lib/drawings/views/plan/buildPlanViewModel.ts) (`PlanViewModelSource` union, `invalid_geometry` fallback at line 132), commit `d1fff14` ("build error", 2026-05-11) introduced the casts.

### 2026-05-21 - Design Workbench Testing - ModelSpaceViewport Architectural Drift

Area: Design Workbench Testing

Status: Active

Decision or mistake: 2 import-guard failures in `apps/portal/components/drawings/rail/objectWorkbenchImportGuards.test.ts` are real architectural violations, not stale paths. They were previously masked by ENOENT errors against the stale `Geometry3DViewport.tsx` path (file moved to `Geometry3DViewport/index.tsx` during decomposition); fixing the path in the guard test unmasked them. The two real violations:

1. **ModelSpaceViewport.tsx imports `houseFirstWorkbenchModel`** -- uses `HouseFirstDeckDraft`, `HouseFirstOpeningDraft`, `WorkbenchHouseSelection`, `WorkbenchMode` types directly. The guard treats this as a layering violation because `houseFirstWorkbenchModel` is the legacy state-compatibility model that boundary files (viewports/workbench) should not consume directly.

2. **ModelSpaceViewport.tsx does not route through `Geometry3DViewport`** -- the guard at [objectWorkbenchImportGuards.test.ts:270-272](../apps/portal/components/drawings/rail/objectWorkbenchImportGuards.test.ts#L270-L272) expects `ModelSpaceViewport` to import `Geometry3DViewport` with `lockedViewPreset="top"`, per the canonical architecture in the 2026-05-04 entry "Model Space Top renders through Geometry3DViewport lockedViewPreset='top'". The actual ModelSpaceViewport.tsx does not do this. Either the architecture migration was reverted/incomplete, or the guard was added speculatively before the migration landed and never enforced.

Why it mattered: same compound-cost argument as the ModelSpaceViewport stale-fixture entry above -- failures accumulate across PRs, mask real issues, and erode test-signal trust. The PR8 multi-form sequence shipped 6 PRs with these failures red, masking the genuine question of "is multi-form work breaking anything?"

Fix path: migrate `ModelSpaceViewport.tsx` off `houseFirstWorkbenchModel` -- either (a) move the legacy types to a neutral module both files import from, or (b) replace the imports with object-first equivalents (`ObjectFirstDeckDraft`, `ObjectFirstOpeningDraft`, etc.). For the Geometry3DViewport routing, audit whether the 2026-05-04 architecture is still the intent -- if yes, complete the migration; if not, retire the guard. Approx 1 day for the full fix.

Current guardrail: do not add new `from '@/lib/drawings/state/houseFirstWorkbenchModel'` imports in viewport, workbench, or rail files (the existing ones in `ModelSpaceViewport.tsx` are grandfathered until the cleanup). Multi-form work continues on the object-first model -- HouseFormModel, ObjectFirstHouseFormDraft -- which is the canonical project-level shape.

Promoted to: None

Related docs/tests: [apps/portal/components/drawings/viewports/ModelSpaceViewport.tsx](../apps/portal/components/drawings/viewports/ModelSpaceViewport.tsx) (the legacy imports at lines 25-30), [apps/portal/components/drawings/rail/objectWorkbenchImportGuards.test.ts](../apps/portal/components/drawings/rail/objectWorkbenchImportGuards.test.ts) (the 2 failing assertions at lines 270-272 and 408-413), 2026-05-04 entry "Model Space Top renders through Geometry3DViewport lockedViewPreset='top'" (the canonical architecture the guard enforces).
