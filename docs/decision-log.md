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

| Date       | Area                             | Status   | Guardrail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------- | -------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------- |
| 2026-05-01 | Supabase Schema                  | Promoted | Schema-affecting work needs a table/RPC ownership map before future behavior changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-05-01 | Agent Routing                    | Promoted | Non-trivial changes need a path ownership and doc-trigger map before editing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-05-01 | Automation/Email/Audit           | Promoted | Automation, email outbox, audit, tasks, and follow-ups need a canonical side-effect doc.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-05-01 | API/Auth                         | Promoted | Staff/admin/public-token route changes need a route contract doc before future behavior changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-05-01 | Projects/Estimates               | Promoted | Core project/contact/estimate workflows need a canonical doc before future behavior changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-05-01 | Docs/Testing                     | Promoted | Keep broad repo command guidance in `docs/testing-and-qa.md`; link to it instead of duplicating command blocks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-05-01 | Parallel Work                    | Promoted | Use universal parallel-work guardrails for concurrent lanes across apps, packages, docs, and workbench migration.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-05-01 | Geometry Top Projection          | Promoted | Mesh-backed top projection must follow the 3D Top camera visibility contract, not render-mesh order or face winding.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-05-01 | Plan Rendering                   | Promoted | Geometry-ready plan views must use top projection as the single committed visual body source.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-05-01 | Plan Rendering                   | Promoted | Projection-backed plans must suppress context/reference bodies as normal visuals and invert the projection transform for deck drag coordinates.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-05-01 | Plan Rendering                   | Promoted | Geometry-ready plan selection and drag must use render-graph layer ownership and canonical preview/commit/rebuild round trips.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-05-01 | Plan Rendering                   | Promoted | Projection-backed overlays must bind visible selection/hit geometry to committed top-projection polygons, not reference footprints.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-06-02 | Portal Test Auth                 | Active   | Service-role-backed portal test-user provisioning must be explicit, local/staging-targeted, and never run as part of routine browser gates.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-06-02 | Portal Browser Coverage          | Active   | Authenticated portal route coverage must be catalog-driven through `playwright/support/portalRouteCatalog.ts`; browser specs consume catalog subsets instead of local hardcoded route lists.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-06-02 | Portal Browser Coverage          | Active   | Seeded portal scenarios must be explicit, local/staging-only, idempotent, and separate from non-mutating browser gates.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-06-02 | Agent Tooling                    | Active   | Complex page bug reports should capture the shared page debug export before implementation changes; page exports must stay gated outside production and preserve page-specific inner payloads.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-06-02 | Portal Browser Evidence          | Active   | Portal browser specs must use the shared evidence lane instead of local ad hoc console, request, screenshot, or viewport listeners.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-06-02 | Agent Tooling                    | Active   | Portal-agent quality should be catalog/report driven through the scorecard, not inferred manually from screenshots, one-off test files, or scattered route lists.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-06-02 | Agent Tooling                    | Active   | Strictness ratchets must start with stable, changed-safe coverage baselines and must not block broad legacy pressure or unrelated repo-health debt.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-06-02 | Workbench Debugging              | Active   | Workbench captured repros must be validated and attached through the shared Playwright helper before any exact payload is baked into `sanctuaryWorkbenchCapturedFixtures.ts`; browser specs must not write captured payloads to tracked files.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-06-02 | Workbench Debugging              | Active   | Multi-house roof solver captures must pass the stricter verifier before baking; healthy one-house payloads or non-reproducing pages are evidence only, not solver fixtures.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-06-11 | Design Workbench                 | Active   | Live workbench runtime is object-first only: no calculator module state, house-first carrier, raw module/house context, module index, legacy plan/section fallback, or costing imports may enter workbench roots. Snapshot-only calculator designs are unsupported/empty in the workbench, and repricing stays disabled until a downstream artifact-to-commercial adapter is introduced outside runtime.                                                                                                                                                                                                                                                                                                              |
| 2026-06-03 | Design Workbench                 | Active   | Object-first workbench state must persist through authenticated staff estimate boundaries and reload as the source of truth before live multi-house bugs are captured; legacy `house-main` synthesis is only for estimates without saved object-first state.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-06-03 | Design Workbench                 | Active   | House roof intent must resolve through an object-first authorship boundary before status, raw geometry input, Plan, or 3D render health; unauthored legacy/default `mono` repairs to canonical `hipped`, while authored mono remains a user design choice.                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-06-03 | Workbench House Forms            | Active   | House-form status must validate preset forms against resolved raw geometry when draft polygons are empty; do not mark healthy preset roofs invalid just because the authored polygon field is blank.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-06-03 | Workbench House Forms            | Active   | Project 3D preview composition must replace legacy active-module house layers whenever project house geometry exists, including single-pergola projects; expose per-house projection health in 3D diagnostics alongside Plan.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-06-03 | Workbench House Forms            | Active   | Custom house footprint numeric residue must be canonicalized at the `@sp/geometry` solved-input boundary before wall/eave/roof solving; do not mutate saved drafts or patch Plan/3D rendering for sub-visible coordinate noise.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-06-03 | Workbench House Forms            | Active   | Custom hipped eave repair is package-owned and render-only: Plan and 3D consume the same repaired eave package from `HouseModel3D`, while final package roof QA owns health status.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-06-03 | Workbench House Forms            | Active   | Fully hipped non-rectangular orthogonal house footprints route through `eave_graph_source_edge_envelope`; invalid topology stays diagnostic instead of falling back to Plan paint fixes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-06-03 | Workbench House Forms            | Active   | Fully hipped custom orthogonal roofs must pass semantic topology QA before committed roof bodies, material accounting, or status can be considered healthy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-05-30 | Portal Shell                     | Active   | Expandable pinned sidebars must keep each icon, label, and submenu in one vertical flow group; split rail/panel lists desync icons from labels.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-05-29 | Workbench Cleanup                | Active   | PR-T7: house form inspector cull -- dead-write/derived fields and duplicate diagnostics were removed from the right rail; future inspector controls must persist and re-derive.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-05-29 | Workbench Cleanup                | Active   | PR-T8: roof appendage band feature removed end-to-end; future shape edits go through the gumball, not inspector number fields.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-05-29 | Workbench Cleanup                | Active   | PR-T9: deck inspector cull — `deck.label` / `deck.kind` / `deck.elevationMode` removed; host edge dropdown removed (snap-derived only); ground-clamp on negative offsets dropped.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-06-16 | Portal Lists                     | Active   | PR-PG1: explicit `.range(0, MAX_LIST_FETCH_ROWS - 1)` + `count: 'exact'` at every staff list-fetch boundary; `ListCountBanner` on contacts + projects pages surfaces visible-vs-total when crossing 80% of the ceiling. Closes PostgREST's silent 1000-row default.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-05-29 | Workbench Geometry               | Active   | Multi-house PR3: project house geometry registry is the canonical derived source for per-form house references, host-excluded 3D scene composition, and PlanViewport house snap targets. Per-pergola `RawGeometryModuleInput.houseContext` remains a Phase 2 deletion target; host house ids now flow through geometry, so portal-side scene retag bridges should not be reintroduced.                                                                                                                                                                                                                                                                                                                               |
| 2026-05-29 | Workbench Geometry               | Active   | Multi-object PR2: object-first pergolas without persisted calculator modules solve through explicit runtime-only sources. Do not reintroduce fake `inputs.modules[]` persistence just to render/select a pergola; keep the temporary `CalculatorModuleInputs` adapter in memory until the per-object solve rewrite deletes it.                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-05-29 | Workbench Geometry               | Active   | Multi-object PR3: Add Pergola creates a freestanding object-first pergola and selects its transient solve entry. Do not revive select-host-first or persisted-module creation flows when adding new pergolas.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-05-29 | Workbench Geometry               | Active   | Multi-object PR4: project context pergola outlines are selectable plan targets. Selection must resolve by `pergolaId` across persisted and transient solved entries, never by falling back to module 0.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-05-29 | Plan Rendering                   | Active   | Multi-object PR5: Plan Editor renders project-wide pergola bodies by object id, not by active module. Do not regress multi-pergola plans to active-only detail plus reference boxes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-05-29 | 3D Rendering                     | Active   | Multi-object PR6: 3D Review renders project-wide pergola scene bodies by `pergolaId`, not by active module. Keep 3D read/select-only and preserve object ids for selection.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-05-30 | Workbench Geometry               | Active   | Multi-object PR7: workbench solve sources route eligible host-house groups through package-level `solveProject`. Do not add new per-module normalize/solve branches in portal state; keep remaining `houseContext` use explicit as the next deletion target.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-05-30 | Workbench Geometry               | Active   | PR-2B.1b.3g: QA fixture routes must pass the same project-level render contracts as production workbench routes instead of creating parallel render behavior.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-05-30 | Workbench Rendering              | Active   | Multi-object PR8: invalid selected pergolas must not own the project view basis. Keep Plan/3D on a ready project basis and render invalid selections as reference/context objects.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-05-30 | Plan Rendering                   | Active   | Multi-object PR9: house-form plan rendering must resolve by canonical `house_reference:<formId>` from `projectHouseGeometries`. Do not let the object-workbench overlay borrow the active pergola module's host-house projection for a different selected house form; visible-body dedupe is per house form id, not global.                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-05-30 | Plan Rendering                   | Active   | PR-2B.1b.3e: project Plan surfaces must use `projectPlanProjection` as their object source. Do not render object-workbench Plan from the active module `topProjection`; active selection may affect halos and inspector state only, not which house or pergola bodies exist.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-05-30 | Workbench House Forms            | Active   | PR-2B.1b.3j: house-form labels are order-derived presentation and `house-main` must never be privileged. An explicit empty object-first house assembly is a tombstone, not permission to re-synthesize a primary house.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-05-31 | Plan Rendering                   | Active   | PR-2B.1b.3k: house-form status and visible plan body precedence must be keyed by `houseFormId`. Rail/inspector/overlay status must not borrow the first house form; house roof Plan bodies are eave-perimeter projections, while roof-material projections are not committed Plan bodies.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-05-31 | Plan Rendering                   | Active   | PR-2B.1b.3l: Plan SVG paint order is a semantic view-model contract, not raw top-projection array/z-order. Project pergola bodies must paint below house roof bodies while hit targets and selection chrome remain separate layers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-05-31 | Plan Rendering                   | Active   | PR-2B.1b.3m: Plan hit targets are event geometry only. They must not paint hover/body visuals; local hover affordance belongs in explicit outline chrome, suppressed for the active selection.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-05-31 | Plan Rendering                   | Active   | PR-2B.1b.3p: visible reference fallbacks need provenance diagnostics and must remain diagnostic/outline-only instead of being mistaken for committed house bodies.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-05-31 | Plan Rendering                   | Active   | PR-2B.1b.3q: no selected house means no selected-house overlay/status fallback; project house projection health remains project-level diagnostics.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-05-31 | Workbench House Forms            | Active   | PR-2B.1b.3n: solver-derived roof fields should not appear as primary user controls unless they are clear design choices. Hipped ridge axis is derived from the selected house form's footprint, and footprint presets are seeds/provenance rather than object identity.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-05-31 | Workbench House Forms            | Active   | PR-2B.1b.3o: roof intent writes must be object-id addressed. Roof controls and plan terminal-end toggles must carry `houseFormId` and must not fall back to the first house form.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-05-31 | Workbench House Forms            | Active   | PR-2B.1b.3r: selected-object status must be nullable and keyed by explicit object id. Project/row status may list every house form, but selected-house inspector, trust, diagnostics, and overlay status must not fall back to the first house form.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-05-31 | Workbench Actions                | Active   | PR-2B.1b.3s: action context must be nullable and object-owned. Deck/opening/pergola/house action paths resolve house context from the target object's owner id, never from House 1 or the active module.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-06-01 | Workbench Rendering              | Active   | PR-2B.1b.3t: project render surfaces may show committed bodies only for object-owned healthy geometry. Invalid or unresolved object-first pergolas must render as reference/diagnostic fallbacks, not normal Plan/3D bodies.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-06-01 | Workbench Rendering              | Active   | PR-2B.1b.3u: unresolved pergola fallbacks must have their own diagnostic render path. They may appear as transparent Plan context outlines and 3D reference lines, but must not flow through committed pergola body layers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-06-01 | Workbench Rendering              | Active   | PR-2B.1b.3v: diagnostic fallbacks are first-class render outputs, separate from committed bodies, hit-target paint, selection chrome, and generic context overlays.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-06-01 | Workbench Rendering              | Active   | PR-2B.1b.3w: house render health is owned per `houseFormId` before Plan/3D consume project render data. Mixed project composition orchestrates house health; it must not infer house stages after merge.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-06-01 | Workbench Rendering              | Active   | PR-2B.1b.3x: house render health has one implementation and repro fixtures should live in focused fixture modules instead of growing the registry hotspot.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-06-01 | Workbench Rendering              | Active   | PR-2B.1b.3y: project 3D must not use active-module preview as committed geometry for suppressed/unresolved project objects.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-06-01 | Workbench Geometry               | Active   | PR-2B.1b.3aa: house roof failures must be diagnosed at geometry-stage boundaries before Plan/3D render fallbacks are changed. Capture the live failing payload before changing solver behavior.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-06-01 | Workbench Geometry               | Active   | PR-2B.1b.3ab: package house-model adapters must expose the raw-house-to-model boundary and named roof-stage statuses before solver fixes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-06-01 | Workbench Geometry               | Active   | PR-2B.1b.3z: house geometry must cross one object-id-addressed input boundary before Plan or 3D consume it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-06-02 | Workbench Geometry               | Active   | PR-2B.1b.3ac: package roof pipeline stages must be explicit and capture-driven before solver changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-06-02 | Geometry Tests                   | Active   | PR-2B.1b.3ad: geometry solver tests should be split by stage/family instead of relying on one monolithic integration file.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-06-02 | Workbench Geometry               | Active   | PR-2B.1b.3ae: live captured fixtures are required before solver changes for screenshot-only house roof failures.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-06-02 | Workbench Geometry               | Active   | PR-2B.1b.3af: roof-stage diagnostics must classify the first missing render-critical stage, not an optional intermediate collection when valid committed roof bodies exist.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-06-03 | Workbench House Forms            | Active   | Coverage solver fixes must stay quarantined to representative fixtures until solver-owned evidence proves the topology; do not promote healthy one-house captures into multi-house roof solver fixtures.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-05-01 | Plan Rendering                   | Promoted | Geometry-ready Model Space is a hard top-projection-only render path; legacy/context/reference/opening overlays stay out of normal visuals.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-05-01 | Design Workbench Architecture    | Promoted | Split workbench ownership contract-first: coordinate adapters and render graphs leave React presenters before moving tools/renderers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-05-01 | Deck Interaction                 | Promoted | Projection-backed deck snapping must use top-projection frames live and object frames only at the commit boundary.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-05-01 | Plan Detail                      | Promoted | Geometry-ready plan detail and deck snap edges must come from scene-backed projected wall segments, not legacy footprint overlays or roof outlines.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-05-01 | Deck Interaction                 | Promoted | Floating deck releases are valid projection placements and must not be failed by snapped-settle geometry checks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-05-01 | Deck Interaction                 | Promoted | Projection-backed deck drag sessions must use committed top-projection polygons for live drag math, not SVG-projected or legacy overlay objects.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-05-01 | Deck Interaction                 | Promoted | Projection-backed deck releases must map render-space previews through object commit frames before writing persisted deck fields.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-05-03 | Design Workbench Geometry        | Promoted | There is one solved geometry spine; plan, 3D, sheet, section, detail, snap, and interaction surfaces are views of it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-05-03 | Deck Interaction                 | Active   | Projection-backed deck releases must not use `commitStartPolygon` bounds remapping; it can reintroduce stale overlay coordinates.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-05-04 | Deck Interaction                 | Active   | Projection-backed drag deltas must normalize the pointer anchor, and snapped commits must map render-frame offsets into object-frame offsets before settle.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-05-04 | Plan Rendering                   | Active   | Geometry-ready Model Space Top renders through `Geometry3DViewport lockedViewPreset="top"` on the same R3F scene as Perspective; the SVG `ProjectionTopViewport` stack is retired.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-05-04 | Design Workbench Architecture    | Active   | Workbench has two render surfaces: a read-only 3D viewport (`Geometry3DViewport`) and a 2D `PlanViewport` (the editor). Plan replaces "Model Space" in the mode switch (`Sheet \| Plan \| 3D`); all editing, tools, and gizmos live in PlanViewport.                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-05-04 | Design Workbench Architecture    | Active   | Nine foundational contracts govern the read/edit split (single-source intent, three-phase drag, plan-projection math, typed selection, isolated tool state machines, snap-as-a-service, gizmos+overlays Plan-only, mm everywhere, 3D is read-only).                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-05-21 | Design Workbench Testing         | Active   | 8 ModelSpaceViewport tests are stale-fixture failures, not regressions — needs `objectWorkbenchOverlayInput` migration before they go green again.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-05-21 | Design Workbench Testing         | Active   | 2 import-guard failures are real architectural drift — ModelSpaceViewport still imports houseFirstWorkbenchModel + does not route through Geometry3DViewport as the guards expect.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-05-01 | Quotes/Invoices/Job Packs        | Promoted | High-risk side-effect workflows need a canonical doc before future behavior changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-05-01 | Docs                             | Promoted | Read the agent playbook for non-trivial portal work; promote durable lessons from this log into the playbook.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-05-01 | Docs                             | Promoted | Do not delete active guardrail docs without confirming usage or replacing the rule.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-05-01 | Docs                             | Promoted | Distinguish current-state references from active operating rules.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-05-06 | Decomposition / Refactor Hygiene | Active   | Extracting helpers during a decomposition refactor must be byte-for-byte; rewriting "while I'm there" introduces subtle behavioural drift that escapes typecheck.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-05-08 | PlanViewport / Pointer Events    | Active   | Pointer-driven tools require `touch-action: none`, `setPointerCapture` on primary-button down, `pointerCancel` -> `cancelActiveTool` (not `pointerUp`), and a pure dispatch helper that NEVER invents coords on null.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-05-08 | Debugging Hygiene                | Active   | When live-runtime symptoms don't match any of the current hypotheses, instrument the boundary with logs before iterating fixes; root-cause from real data, not theory chains.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-05-08 | House Roof Topology              | Active   | "Click hip triangle to open as gable" needs a Dutch-hip / half-hip topology in the geometry pipeline -- hipped + `openGableEndIds` is currently a no-op (gated to gable form). Multi-session work: rectangle Dutch-hip first, joined Dutch-hip second, UI third.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-05-12 | 3D Wall Rendering                | Active   | Wall solids must consume `renderMesh` (not just `boundary`); miter footprints offset inward-only `(0, -thickness)`, not centered `(±half, ±half)`; non-flat-top walls extrude polygonally via `buildPolygonalWallRenderMesh`; open-gable migrated-from-hipped boundaries reshape only when `wallBoundaryHasFlatTop` is true.                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-05-12 | 3D Viewport Navigation           | Active   | OrbitControls `mouseButtons.LEFT` must branch on `lockedViewPreset === 'top'` (pan in Plan, rotate in 3D). Trackpad users have no MIDDLE button, so rotate-on-LEFT is the only navigable default.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-05-12 | Open-Gable Roof Frames           | Active   | Triangular gable walls have a 1-point top profile (apex only); the frame-feature gate must be `topProfile.length < 1`, not `< 2`, or the gable-end posts/top-chord disappear.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-05-13 | Plan Rendering                   | Active   | Superseded by PR-2B.1b.3i/3l: visual house dedupe now lives in the Plan render graph's explicit committed-body visual stack, while `house_reference:*` stays in hit targets. Sheet still applies its own render-only suppression.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-05-13 | Pergola Snap Targets             | Active   | `HouseModel3D.roofEaves` must include EVERY attachable perimeter edge (drain + weather-flashed gable + apron), not just `drain_eave`. Opening a Dutch-hip end strips the adjacent roof plane and reclassifies the eave as `weather_flashed_edge` -- the user still expects to snap a pergola there. Downstream gutter/flashing consumers re-filter on `edgeKind`.                                                                                                                                                                                                                                                                                                                                                    |
| 2026-05-13 | Plan Tool Chain                  | Active   | `EdgeDragTool.onPointerDown` runs a distance-based priority: terminal-end toggle target (`event.shape?.metadata?.openGableEndId`) ONLY falls through to SelectTool when the click is outside `edgeHitToleranceMm` of the active outline. Clicks on the synthetic's eave-corner overhang that overlap a wall edge start an edge drag instead, restoring wall interaction under the synthetic. Default tolerance is 250 mm (was 500).                                                                                                                                                                                                                                                                                  |
| 2026-05-13 | House Roof Topology              | Active   | The geometry normalize migration treats `roofIntent.form: 'gable'` as "hipped + every terminal end open" regardless of `openGableEndIds`. Any terminal-end toggle that operates on the workbench state must port the migration into explicit `form: 'hipped' + openGableEndIds: <all terminals minus the toggled one>` in the SAME commit, or `[].filter(...)` produces a no-op and normalize re-migrates on the next solve. Helper: `resolveHouseTerminalEndToggleRoofDraft`.                                                                                                                                                                                                                                       |
| 2026-05-14 | Plan Snap Engine                 | Active   | `resolveMoveSnap` resolves a corner snap after the primary: if a second target on a different polygon edge whose direction is at least `cornerMinAngleDeg` (default 30 deg) from the primary's lies within tolerance, it solves the 2x2 system `[primary_normal; secondary_normal] . delta = [ps; ss]` so the moving polygon's corner lands on the two target lines' intersection. `MoveSnapResult.secondary` + `cornerVertex` are optional; single-line consumers are unaffected. EdgeDragTool stays single-line (1D motion).                                                                                                                                                                                       |
| 2026-05-14 | House Roof Topology              | Active   | Milestone 13 session C: `'gable'` is retired from the `HouseRoofForm` type union (`'flat' \| 'mono' \| 'hipped'`). `resolveHouseRoofForm` (geometry normalize) and `normalizeHouseFormRoofIntent` (workbench draft normalize) BOTH map legacy `'gable'` string input to `'hipped'` so storage can still carry it but no typed surface accepts it. Picker, validators, dispatchers, and inspector derivations are simplified accordingly. Known regression: legacy gable-form houses in preset mode (no explicit polygon at normalize time) load as `'hipped'` with empty `openGableEndIds`; the user re-opens ends from the rail or Plan canvas.                                                                     |
| 2026-05-14 | House Roof Topology              | Active   | Partial-open clicks on joined footprints (U / wrap with one terminal end opened) require TWO wavefront facet-validator relaxations: (1) `allowRaisedBoundaryPoints: true` -- the slope adjacent to a stationary gable edge legitimately reaches the eave at apex z, not eave z (the gable wall fills the height gap); (2) the `face_count_mismatch` check subtracts the stationary edge count from the expected facet count because stationary edges intentionally produce zero slope facets. Without these, clicking ONE terminal end on a U produced `roof_topology_face_count_mismatch:5:8` and the geometry rendered as invalid. Fully-hipped (no stationary edges) and bent-spine all-open paths are unchanged. |
| 2026-06-11 | Workbench House Forms | Active | Eave-offset recovery lives in `@sp/geometry`; fully hipped custom orthogonal roofs try `orthogonal_cell_union` at the requested overhang before any reduced-overhang/narrow-return repair, and commit the exact boundary only when downstream roof QA passes -- no Plan/first-house/active-module fallbacks. |
| 2026-06-11 | Workbench House Forms | Active | Fully hipped custom roofs try `source_edge_exact_envelope_partition` first and expose `roofTopologyExactPartition*` metadata; committed geometry must still pass semantic and coverage QA, and failed exact-attempt metadata must not become the diagnostic code for a roof that committed valid geometry. |
| 2026-06-12 | Design Workbench | Active | Live workbench runtime roots must not import `@sp/costing`, expose `data-workbench-pricing*`, or reintroduce `activeModule`/`moduleLabel`/`legacy_plan_m`/`geometry_plan_fallback`; pricing/readiness stays on estimate/calculator/commercial paths. |
| 2026-06-12 | Design Workbench | Active | Live workbench roots use object/pergola artifact vocabulary: pergola render diagnostics keyed by `pergolaId`/`artifactId`, `WorkbenchSolvedModel` exposes no solved-module arrays, and no module selection/status names return. |
| 2026-06-12 | Design Workbench | Active | `design-workbench-architecture.md` is the current contract, `design-workbench-multi-object-goal.md` tracks milestones, and `design-workbench-legacy-cull.md` is archived history plus Gate 0 references only; do not use old PR history as a next-task list. |
| 2026-06-12 | Design Workbench | Active | `DrawingWorkbench` callers pass `projectArtifact` and `WorkbenchViewportHost` is the only place to unpack it; no loose project geometry/status prop arrays or reintroduced `WorkbenchSolvedModel` aliases. |
| 2026-06-12 | Design Workbench | Active | Live workbench code reads solved project geometry, plan layers, snap sources, and render diagnostics from `projectArtifact`; the breakaway guard forbids direct `solvedModel.*` alias reads. |
| 2026-06-12 | Design Workbench | Active | `buildWorkbenchSolvedModel` builds project house geometry, then project pergola render artifacts, then passes the same pergola artifact list into project render-pipeline and viewer scene composition; package geometry owns pergola solving via a neutral boundary. |

## Entries

### 2026-06-02 - Portal Test Auth - Explicit Test User Provisioning

Area: Portal Test Auth

Status: Active

Decision or mistake: authenticated browser gates need a reliable staff account, but service-role-backed user creation is a mutation and must not happen implicitly inside routine test commands.

Why it mattered: implicit provisioning could mutate staging unexpectedly, hide credential problems, or make production safety depend on convention instead of a hard command gate.

Current guardrail: use `npm run portal:test-user:ensure` or `npm run portal:agent-access:provision` only with `PORTAL_TEST_PROVISION_TARGET=local|staging`. The provisioning script must refuse missing targets and `production`, must not log passwords or service-role keys, and normal browser gates must only consume credentials/auth state.

Promoted to: None

Related docs/tests: `scripts/ensure-portal-test-user.ts`, `scripts/ensure-portal-test-user.test.ts`, `playwright/support/portalAgent.ts`, `playwright/portal.agent-access.spec.ts`, `docs/testing-and-qa.md`, `docs/environment-auth-supabase.md`.

### 2026-06-02 - Portal Browser Coverage - Route Catalog Ownership

Area: Portal Browser Coverage

Status: Active

Decision or mistake: authenticated portal browser coverage should not grow through scattered hardcoded route lists in unrelated specs.

Why it mattered: agents need to know which routes exist, which role or seeded data they require, and which owner doc explains them. Hardcoded smoke lists make coverage drift harder to see and make dynamic/data-dependent routes look accidentally untested instead of intentionally scenario-gated.

Current guardrail: portal route coverage is catalog-driven through `playwright/support/portalRouteCatalog.ts`, with status mirrored in `docs/portal-route-catalog.md`. Browser specs consume catalog subsets such as `agentAccessSmokeRoutes`; dynamic routes remain `scenario-required` until seeded scenarios exist.

Promoted to: None

Related docs/tests: `playwright/support/portalRouteCatalog.ts`, `playwright/support/portalRouteCatalog.test.ts`, `playwright/portal.agent-access.spec.ts`, `docs/portal-route-catalog.md`, `docs/testing-and-qa.md`.

### 2026-06-02 - Portal Browser Coverage - Explicit Seeded Scenario Registry

Area: Portal Browser Coverage

Status: Active

Decision or mistake: dynamic portal route smoke needs deterministic project, estimate, quote, and workbench data, but data seeding is a mutation and must stay separate from routine browser gates.

Why it mattered: without seeded scenarios, agents could only open static staff pages or depend on whatever data happened to exist. If scenario provisioning were implicit, browser checks could mutate local or staging unexpectedly and make failures harder to reproduce.

Current guardrail: seeded portal scenarios live in `playwright/support/portalScenarioRegistry.ts` and are provisioned only by `npm run portal:scenarios:ensure` or the opt-in combined `npm run portal:agent-scenarios:provision`. Provisioning must require `PORTAL_TEST_SCENARIO_TARGET=local|staging`, refuse `production`, never log service-role keys or passwords, and write only non-secret route state to `playwright/.auth/portal-scenarios.json`. `npm run portal:agent-scenarios` reads that state only.

Promoted to: None

Related docs/tests: `scripts/ensure-portal-scenarios.ts`, `scripts/ensure-portal-scenarios.test.ts`, `playwright/support/portalScenarioRegistry.ts`, `playwright/portal.agent-scenarios.spec.ts`, `docs/testing-and-qa.md`, `docs/portal-route-catalog.md`.

### 2026-06-02 - Portal Browser Evidence - Shared Evidence Lane

Area: Portal Browser Evidence

Status: Active

Decision or mistake: browser specs were starting to grow local copies of console, network, screenshot, debug-export, and workbench viewport evidence capture.

Why it mattered: ad hoc evidence listeners drift quickly and make failures harder for agents to compare across auth, scenario, fixture, and route-catalog lanes. Browser failures should attach consistent artifacts without weakening auth or logging secrets.

Current guardrail: use `playwright/support/portalBrowserEvidence.ts` for portal browser evidence and `playwright/support/workbenchEvidence.ts` for Plan/3D viewport diagnostics. Specs should not add local evidence listeners or screenshots unless the shared helper cannot express the needed artifact; if that happens, extend the helper first.

Promoted to: None

Related docs/tests: `playwright/support/portalBrowserEvidence.ts`, `playwright/support/workbenchEvidence.ts`, `playwright/portal.agent-access.spec.ts`, `playwright/portal.agent-scenarios.spec.ts`, `playwright/portal.auth-runtime.spec.ts`, `docs/testing-and-qa.md`.

### 2026-06-01 - Workbench Geometry - Roof Solver Stage Diagnostics

Area: Workbench Geometry

Status: Active

Decision or mistake: repeated Plan/3D fallback patches did not fix the remaining house-form failure because the failing live state was not captured and the package roof path only exposed coarse render-health stages.

Why it mattered: without package-level stages, a missing roof body could be misread as Plan paint order, selection chrome, first-house fallback, or 3D scene composition. That led to useful cleanup, but not a direct fix for the live house geometry failure.

Current guardrail: house roof failures must cross an object-id-addressed geometry input boundary and report stage diagnostics before Plan/3D render behavior changes. Capture the live failing workbench payload through the gated debug fixture export before changing solver behavior for a screenshot-only repro.

Promoted to: None

Related docs/tests: `packages/geometry/src/houseRoofDiagnostics.ts`, `apps/portal/lib/drawings/state/houseFormGeometryInput.ts`, `apps/portal/lib/drawings/state/projectHouseRenderPipeline.ts`, `apps/portal/app/staff/projects/[projectId]/design-workbench/WorkbenchDebugExportButton.tsx`, `playwright/support/workbenchFixture.ts`.

### 2026-06-01 - Workbench Geometry - House Model Stage Boundary

Area: Workbench Geometry

Status: Active

Decision or mistake: house solver fixes should not start inside Plan, 3D, or portal render classification. The package must first expose the raw-house-to-model boundary and named roof-stage statuses so a captured repro can fail at a specific stage.

Why it mattered: `buildHouseModel3DFromRawHouseInput` previously built its compatibility `GeometryConfig` inline, which made it hard to tell whether a bad house failed during raw input adaptation, footprint/eave setup, roof topology, QA, or later projection. Portal code also duplicated empty roof-stage defaults, increasing drift risk.

Current guardrail: keep `buildHouseModel3DFromRawHouseInput` stable, but route it through `buildHouseModel3DGeometryConfigInputFromRawHouseInput`. Portal house geometry/render pipelines should consume package-owned roof-stage helpers (`EMPTY_HOUSE_ROOF_STAGE_DIAGNOSTICS`, `pickHouseRoofStageDiagnostics`, `firstHouseRoofStageDiagnosticCode`) instead of inventing their own stage defaults.

Promoted to: None

Related docs/tests: `packages/geometry/src/houseModel.ts`, `packages/geometry/src/houseRoofDiagnostics.ts`, `packages/geometry/src/houseModelStageDiagnostics.test.ts`, `apps/portal/lib/drawings/state/houseFormGeometryInput.ts`, `apps/portal/lib/drawings/state/projectHouseRenderPipeline.ts`.

### 2026-06-02 - Workbench Geometry - Roof Pipeline Stage Boundary

Area: Workbench Geometry

Status: Active

Decision or mistake: portal render-health stages and package roof solver stages are related but not equivalent. Portal code should not infer footprint/eave/topology/QA failures from Plan or 3D output counts.

Why it mattered: repeated render-layer cleanup made the workbench more object-owned, but the visible house bug persisted because the exact failing solver boundary was still implicit. The package now owns a typed `buildHouseRoofModelPipeline` result so the debug export can name the roof-pipeline stage independently from coarse Plan/3D render health.

Current guardrail: keep `buildHouseModel3DFromRawHouseInput` compatible, but expose roof pipeline diagnostics from `packages/geometry/src/house/`. Do not change solver behavior for screenshot-only failures; bake the copied live debug fixture first, then fix the first failing package stage.

Promoted to: None

Related docs/tests: `packages/geometry/src/house/roofModelPipeline.ts`, `packages/geometry/src/house/roofModelPipeline.test.ts`, `packages/geometry/src/houseModelStageDiagnostics.test.ts`, `apps/portal/lib/drawings/state/houseFormGeometryInput.ts`.

### 2026-05-30 - Portal Shell - Pinned Sidebar Flow

Area: Portal Shell

Status: Active

Decision or mistake: pinned sidebar icons and labels were rendered as two separate fixed vertical lists. Expanding a label submenu pushed only the label list down, so later icons no longer lined up with their labels.

Why it mattered: the sidebar looked like icons belonged to the wrong navigation item, which makes routine staff navigation error-prone and undermines the compact rail/label design.

Current guardrail: expandable pinned navigation must render each top-level icon, label, chevron, and submenu in a single parent flow group. Rail-only routes can keep an icon-only rail, but pinned mode must not stack an independent icon list beside an expandable label list.

Promoted to: None

Related docs/tests: `apps/portal/components/navigation/PortalSidebarPanel.test.tsx`, `apps/portal/components/layout/PortalShell.test.tsx`, `npm run test:portal:shell`.

### 2026-05-31 - Plan Rendering - House-Form Overlay Ownership

Area: Plan Rendering

Status: Active

Decision or mistake: object workbench status still exposed one `houseForm` status derived from the first house form, while Plan could paint both raw roof-solid and roof-material bodies for the same house form.

Why it mattered: selecting House 2 could show House 1's preset/status in rail or inspector surfaces, and duplicate visible roof bodies made the Plan overlay look like house forms were connected or competing.

Current guardrail: house-form status, rail rows, inspector state, selection overlays, hit targets, and visible body precedence must resolve by `houseFormId`. `house_roof_material:<houseFormId>` is the preferred visible roof body when present; raw same-form roof solids and canonical references stay out of the visible body layer except as explicit fallback.

Promoted to: None

Related docs/tests: `apps/portal/lib/drawings/state/drawingWorkbenchStore.test.ts`, `apps/portal/lib/drawings/views/plan/planRenderGraph.test.ts`, `apps/portal/lib/drawings/views/plan/planCommittedBodyVisualStack.ts`, `apps/portal/components/drawings/viewports/PlanViewport/PlanViewport.test.tsx`.

### 2026-05-31 - Plan Rendering - Project Visual Stack Ownership

Area: Plan Rendering

Status: Active

Decision or mistake: project Plan committed bodies still inherited raw top-projection array/z-order after the projection became object-owned. Pergola bodies have higher package-level geometry z-order than house roofs, so attached pergola panels could paint over the house/eave plan body even when there was no selection overlay.

Why it mattered: top-projection z-order describes geometry/object detail depth, not the SVG drawing contract for the project Plan editor. Letting it drive the final paint stack made project-level rendering look like objects were visually fused or selected when only their projected footprints overlapped.

Current guardrail: Plan SVG paint order is owned by the Plan view model. The render graph returns already-filtered and semantically sorted committed bodies: pergola visual bodies below house roof/roof-material bodies, canonical house references in hit/selection layers unless promoted as no-roof fallbacks, and detail/selection chrome in separate layers.

Promoted to: None

Related docs/tests: `apps/portal/lib/drawings/views/plan/planCommittedBodyVisualStack.ts`, `apps/portal/lib/drawings/views/plan/planRenderGraph.test.ts`, `apps/portal/components/drawings/viewports/PlanViewport/PlanViewport.test.tsx`, `playwright/portal.workbench-fixture.spec.ts`.

### 2026-05-31 - Plan Rendering - Invisible Hit Targets

Area: Plan Rendering

Status: Active

Decision or mistake: Plan hit targets stayed visually coupled to hover styling after visible bodies and hit targets were split. Because hit targets sit above committed bodies for pointer routing, the CSS `:hover` fill on canonical `house_reference:*` polygons could still paint a blue footprint over the house roof/pergola stack.

Why it mattered: event geometry is often larger or more canonical than the visible body it controls. Letting it paint hover/body visuals reintroduced the same overlay bug through a different layer.

Current guardrail: Plan hit targets are event-only. They may carry pointer handlers and diagnostics, but hover feedback must render through explicit chrome layers with outline-only styling, and the active selection suppresses duplicate hover chrome.

Promoted to: None

Related docs/tests: `apps/portal/components/drawings/viewports/PlanViewport/canvas/layers/PlanHitTargetLayer.tsx`, `apps/portal/components/drawings/viewports/PlanViewport/canvas/layers/PlanLocalHoverLayer.tsx`, `apps/portal/components/drawings/viewports/PlanViewport/PlanViewport.test.tsx`, `playwright/portal.workbench-fixture.spec.ts`.

### 2026-05-31 - Plan Rendering - Reference Fallback Provenance

Area: Plan Rendering

Status: Active

Decision or mistake: no-roof `house_reference:*` fallbacks could be promoted into the committed body layer without diagnostics and still use filled footprint styling. That made missing roof-material/roof bodies look like a generic overlay problem instead of an explicit fallback for one house form.

Why it mattered: Plan fallbacks are useful for inspectability, but they are not real house roof bodies. They need to expose their owning `houseFormId` and render as reference outlines so they do not visually compete with project roof/pergola geometry.

Current guardrail: Plan render diagnostics report per-house reference ids, roof/roof-material body ids, hit targets, and visible reference fallbacks. `house_reference:*` fallbacks may render only as transparent outline geometry; filled committed house bodies must come from roof or roof-material projection shapes.

Promoted to: None

Related docs/tests: `apps/portal/lib/drawings/views/plan/planRenderDiagnostics.ts`, `apps/portal/lib/drawings/views/plan/planRenderGraph.test.ts`, `apps/portal/components/drawings/viewports/PlanViewport/PlanViewport.test.tsx`, `playwright/portal.workbench-fixture.spec.ts`.

### 2026-05-30 - Plan Rendering - House Form Plan Body Identity

Area: Plan Rendering

Status: Active

Decision or mistake: house-form plan rendering could borrow the active pergola module's host-house projection when the selected house form was different.

Why it mattered: multi-house plan views need stable visual and hit-target identity per house form. Borrowing the active module's host projection makes the wrong house look selected and can dedupe visible bodies globally instead of by form.

Current guardrail: resolve house-form plan bodies through the canonical `house_reference:<formId>` entry from `projectHouseGeometries`. Visible-body dedupe is scoped by house form id, not treated as one global house outline.

Promoted to: None

Related docs/tests: `apps/portal/lib/drawings/state/workbenchSolvedModel.test.ts`, `apps/portal/lib/drawings/views/plan/buildPlanViewModel.test.ts`, `apps/portal/lib/drawings/views/plan/planRenderGraph.test.ts`.

### 2026-05-30 - Plan Rendering - Project Projection Source

Area: Plan Rendering

Status: Active

Decision or mistake: object-workbench Plan rendering still used the active module's `topProjection` as its base, then merged project-level references and pergola bodies on top.

Why it mattered: switching active pergolas changed which house form contributed detailed roof/body shapes. The Plan surface looked like houses were connected even though project-level house references were stable.

Current guardrail: object-workbench Plan surfaces must render from `WorkbenchSolvedModel.projectPlanProjection`, built from project-level house geometry and project pergola plan bodies. Active selection may change halos, dimensions, snap exclusions, and inspector state; it must not change which project objects exist in the Plan render source.

Promoted to: None

Related docs/tests: `apps/portal/lib/drawings/state/workbenchSolvedModel.test.ts`, `apps/portal/components/drawings/viewports/PlanViewport/PlanViewport.test.tsx`, `packages/geometry/src/topProjection.test.ts`.

### 2026-05-30 - Workbench Rendering - Stable Project View Basis

Area: Workbench Rendering

Status: Active

Decision or mistake: selecting an invalid transient pergola could make Plan lose its projection basis and could leave 3D with a selected id that did not exist in the aggregated scene.

Why it mattered: object selection and project rendering were still coupled to the active module's artifact, so one invalid object could blank or crash an otherwise valid multi-object project view.

Current guardrail: Plan and 3D should use a stable project basis derived from the active ready module, or the first ready module when the active selection is invalid. Invalid/unsupported objects remain selectable as reference/context outlines; do not invent solved bodies for them.

Promoted to: None

Related docs/tests: `docs/design-workbench-multi-object-goal.md`, `docs/design-workbench-architecture.md`, `apps/portal/lib/drawings/state/workbenchSolvedModel.test.ts`, `apps/portal/components/drawings/workbench/DrawingWorkbench.test.tsx`, `apps/portal/components/drawings/viewports/Geometry3DViewport/Geometry3DViewport.test.tsx`.

### 2026-05-29 - 3D Rendering - Project-Wide Pergola Scene Bodies

Area: 3D Rendering

Status: Active

Decision or mistake: multi-pergola 3D Review still showed only the active pergola after Plan Editor had moved to project-wide solved bodies.

Why it mattered: active-only 3D made the workbench look unresolved and encouraged another active-module-only presentation path, splitting Plan and 3D identity.

Current guardrail: 3D Review must consume a project-wide solved preview for valid pergolas. Prefix aggregated scene object ids by `pergolaId`, preserve `metadata.pergolaId`, and route selection by that id; direct manipulation remains Plan-only.

Promoted to: None

Related docs/tests: `docs/design-workbench-multi-object-goal.md`, `apps/portal/lib/drawings/state/workbenchSolvedModel.test.ts`, `apps/portal/components/drawings/viewports/selection/selectionRouter.test.ts`, `apps/portal/components/drawings/workbench/DrawingWorkbench.test.tsx`.

### 2026-05-30 - Workbench Geometry - Project Solve Boundary

Area: Workbench Geometry

Status: Active

Decision or mistake: workbench state now builds an explicit persisted + transient pergola solve-source list and routes eligible host-house groups through `@sp/geometry solveProject` before rehydrating the existing `WorkbenchSolvedModule` contract.

Why it mattered: repeated portal-side per-module normalize/solve branches made it too easy for future multi-object work to keep treating each pergola as its own project. The package-level boundary is now the normal workbench entry point for object-first host groups, while legacy/no-object-first sources remain named fallback.

Current guardrail: new workbench geometry solve work should extend the project solve-source boundary, not add another caller-specific per-module solve path in `workbenchSolvedModel.ts`. `RawGeometryModuleInput.houseContext` still exists as compatibility data and remains the next deletion/shrink target.

Promoted to: None

Related docs/tests: `docs/design-workbench-multi-object-goal.md`, `docs/design-workbench-architecture.md`, `apps/portal/lib/drawings/state/workbenchProjectSolveSources.test.ts`, `packages/geometry/src/solveProject.test.ts`.

### 2026-05-29 - Plan Rendering - Project-Wide Pergola Bodies

Area: Plan Rendering

Status: Active

Decision or mistake: multi-pergola Plan Editor rendering had reached solved-object selection, but full detail still came from the active module while other pergolas appeared only as faded reference boxes.

Why it mattered: active-only plan bodies made the workbench look like only one pergola was resolved, and it encouraged callers to keep adding active-module branches instead of aggregating solved objects by id.

Current guardrail: Plan rendering must aggregate valid pergola plan bodies by `pergolaId` from the solved model. Reference/context outlines are fallback and snap inputs, not the normal visual body for valid solved pergolas.

Promoted to: None

Related docs/tests: `docs/design-workbench-multi-object-goal.md`, `apps/portal/lib/drawings/state/workbenchSolvedModel.test.ts`, `apps/portal/components/drawings/viewports/PlanViewport/PlanViewport.test.tsx`.

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

Decision or mistake: walls in the 3D viewport rendered as flat polygons that looked papery; on hipped roofs with one end opened (Dutch-hip), the resulting open-gable wall was not drawn at all. Three independent issues were uncovered while making walls render as 3D solids: (1) the 3D viewport had a wall-specific branch that ignored `renderMesh` and rebuilt geometry from `boundary` alone -- so any extrusion work in `envelopeSolids.ts` was silently discarded for walls; (2) the miter footprint helper was offsetting walls by `+/- half-thickness` (centered on the footprint edge), but the house footprint is defined as the outer face of the wall -- centered offsets push half the wall mass _outside_ the house outline, and adjacent walls' centered offsets do not meet cleanly at corners; (3) the migrated-from-hipped open-gable wall arrived with a 4-vertex flat-top boundary (rectangle), not the 5-vertex apex shape native gable walls have, so the polygonal extruder had no apex to extrude -- the wall vanished into the roof. A naive reshape (always inject the apex) regressed native gable: those walls already have 5 vertices and re-inserting an apex produces a degenerate boundary.

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

Why it mattered: 3D viewport navigation is the primary "feel" interaction of the workbench. A confusing rotate/pan binding doesn't surface as a bug report -- users just feel the tool is broken. The fix is one tiny ternary in `mouseButtons`, but the principle (which button does what _depends_ on which view-preset is active) is non-obvious and easy to regress when adding new view presets or wiring new controls.

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

Decision or mistake: [roofFrames.ts](../packages/geometry/src/house/roofFrames.ts) emits gable-end frame features (posts, top-chord) by walking the top-profile of an open-gable wall. The gate guarded `topProfile.length < 2`, intending to skip degenerate walls with no top profile. But triangular gable walls (a single apex point above the eave line) have a _1-point_ top profile -- one vertex, no segment. The `< 2` gate skipped them entirely, producing open-gable walls with no frame features (the apex post and top-chord vanished).

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

Current guardrail: superseded by the explicit Plan hit-target layer and project visual stack from PR-2B.1b.3i/3l. The original mistake remains valid -- do not remove a house selection anchor just because it should not visibly paint -- but the implementation moved from a React render-layer filter into the Plan view model. Specifically:

- In [planRenderGraph.ts](../apps/portal/lib/drawings/views/plan/planRenderGraph.ts), `buildProjectionPlanRenderGraph` puts canonical `house_reference + footprint` shapes in `hitTargets`, not normal visible bodies. `house_reference` promotes to a visible committed fallback only when the same house form has no roof body.
- In [planCommittedBodyVisualStack.ts](../apps/portal/lib/drawings/views/plan/planCommittedBodyVisualStack.ts), visible committed bodies are filtered and semantically sorted before they reach React. Project-level house roof bodies come from the package eave-perimeter projection, and project pergola bodies paint below house roof bodies.
- In [PlanCommittedBodyLayer.tsx](../apps/portal/components/drawings/viewports/PlanViewport/canvas/layers/PlanCommittedBodyLayer.tsx), the layer is now a presenter only; it renders the already-filtered/sorted items from the render model.
- In [ModulePlanLayerRenderers.tsx](../apps/portal/app/staff/calculator/ModulePlanLayerRenderers.tsx)'s `TopProjectionLayerRenderer` (Sheet view), the same render-time suppression applies. Sheet has no hit-target layer for the house so a render-only filter is sufficient.
- The non-active project-context overlay path (`buildProjectContextOverlayShapes` in workbenchSolvedModel.ts) is unaffected -- it filters `house_reference` out of the context overlay separately.

Keep visible and hit-target concerns separate: interaction references belong in hit/selection layers unless explicitly promoted as no-body fallbacks.

Promoted to: None

Related docs/tests: [apps/portal/lib/drawings/views/plan/planRenderGraph.ts](../apps/portal/lib/drawings/views/plan/planRenderGraph.ts), [apps/portal/lib/drawings/views/plan/planCommittedBodyVisualStack.ts](../apps/portal/lib/drawings/views/plan/planCommittedBodyVisualStack.ts), [apps/portal/lib/drawings/views/plan/planRenderGraph.test.ts](../apps/portal/lib/drawings/views/plan/planRenderGraph.test.ts), [apps/portal/components/drawings/viewports/PlanViewport/canvas/layers/PlanCommittedBodyLayer.tsx](../apps/portal/components/drawings/viewports/PlanViewport/canvas/layers/PlanCommittedBodyLayer.tsx), [apps/portal/components/drawings/viewports/PlanViewport/canvas/planHitTargetFilter.ts](../apps/portal/components/drawings/viewports/PlanViewport/canvas/planHitTargetFilter.ts), [apps/portal/app/staff/calculator/ModulePlanLayerRenderers.tsx](../apps/portal/app/staff/calculator/ModulePlanLayerRenderers.tsx), [apps/portal/lib/drawings/state/workbenchSolvedModel.ts](../apps/portal/lib/drawings/state/workbenchSolvedModel.ts) (`buildProjectContextOverlayShapes` for the project context-overlay path that still keeps `house_reference`).

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
- `appendageAllowed = sharedRoofForm === 'mono' || sharedRoofForm === 'hipped'` in houseFirstWorkbenchAdapter.ts (was `'mono' || 'gable'`). Mirrors the capability change.
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

Related docs/tests: apps/portal/components/drawings/viewports/ModelSpaceViewport.test.tsx (failing tests, casted fixtures, TODO comments), [apps/portal/lib/drawings/views/plan/buildPlanViewModel.ts](../apps/portal/lib/drawings/views/plan/buildPlanViewModel.ts) (`PlanViewModelSource` union, `invalid_geometry` fallback at line 132), commit `d1fff14` ("build error", 2026-05-11) introduced the casts.

### 2026-05-21 - Design Workbench Testing - ModelSpaceViewport Architectural Drift

Area: Design Workbench Testing

Status: Active

Decision or mistake: 2 import-guard failures in `apps/portal/components/drawings/rail/objectWorkbenchImportGuards.test.ts` are real architectural violations, not stale paths. They were previously masked by ENOENT errors against the stale `Geometry3DViewport.tsx` path (file moved to `Geometry3DViewport/index.tsx` during decomposition); fixing the path in the guard test unmasked them. The two real violations:

1. **ModelSpaceViewport.tsx imports `houseFirstWorkbenchModel`** -- uses `HouseFirstDeckDraft`, `HouseFirstOpeningDraft`, `WorkbenchHouseSelection`, `WorkbenchMode` types directly. The guard treats this as a layering violation because `houseFirstWorkbenchModel` is the legacy state-compatibility model that boundary files (viewports/workbench) should not consume directly.

2. **ModelSpaceViewport.tsx does not route through `Geometry3DViewport`** -- the guard at objectWorkbenchImportGuards.test.ts:270-272 expects `ModelSpaceViewport` to import `Geometry3DViewport` with `lockedViewPreset="top"`, per the canonical architecture in the 2026-05-04 entry "Model Space Top renders through Geometry3DViewport lockedViewPreset='top'". The actual ModelSpaceViewport.tsx does not do this. Either the architecture migration was reverted/incomplete, or the guard was added speculatively before the migration landed and never enforced.

Why it mattered: same compound-cost argument as the ModelSpaceViewport stale-fixture entry above -- failures accumulate across PRs, mask real issues, and erode test-signal trust. The PR8 multi-form sequence shipped 6 PRs with these failures red, masking the genuine question of "is multi-form work breaking anything?"

Fix path: migrate `ModelSpaceViewport.tsx` off `houseFirstWorkbenchModel` -- either (a) move the legacy types to a neutral module both files import from, or (b) replace the imports with object-first equivalents (`ObjectFirstDeckDraft`, `ObjectFirstOpeningDraft`, etc.). For the Geometry3DViewport routing, audit whether the 2026-05-04 architecture is still the intent -- if yes, complete the migration; if not, retire the guard. Approx 1 day for the full fix.

Current guardrail: do not add new `from '@/lib/drawings/state/houseFirstWorkbenchModel'` imports in viewport, workbench, or rail files (the existing ones in `ModelSpaceViewport.tsx` are grandfathered until the cleanup). Multi-form work continues on the object-first model -- HouseFormModel, ObjectFirstHouseFormDraft -- which is the canonical project-level shape.

Promoted to: None

Related docs/tests: apps/portal/components/drawings/viewports/ModelSpaceViewport.tsx (the legacy imports at lines 25-30), apps/portal/components/drawings/rail/objectWorkbenchImportGuards.test.ts (the 2 failing assertions at lines 270-272 and 408-413), 2026-05-04 entry "Model Space Top renders through Geometry3DViewport lockedViewPreset='top'" (the canonical architecture the guard enforces).

### 2026-05-29 - Workbench Cleanup - PR-T7 House Form Inspector Cull

Area: Design Workbench / House Forms

Status: Active

Decision or mistake: restructured the house form right inspector into PRIMARY / DIMENSIONS / ADVANCED and removed dead-write or derived controls from the inspector and embedded rail. Removed surfaces included house connection, attachment strategy, storey mode, drawing rotation, disabled gable gutter readouts, duplicate selected-object diagnostics, and the Review Basis summary block.

Why it mattered: the old inspector mixed editable geometry controls with values that were either derived on the next solve, disabled, duplicated elsewhere, or useful only as solver diagnostics. That made the right rail look more powerful than it was and made future inspector changes harder to reason about.

Current guardrail: a house-form inspector control must either write a persisted object-first field that survives the next solve, or it should not be presented as an editable field. Solver diagnostics belong behind explicit diagnostics surfaces, not in the primary editing inspector. Keep the compact PRIMARY / DIMENSIONS / ADVANCED structure unless a future product change creates a new persisted editing concept.

Promoted to: None

Related docs/tests: [apps/portal/components/drawings/rail/HouseFormInspector.tsx](../apps/portal/components/drawings/rail/HouseFormInspector.tsx), [apps/portal/components/drawings/rail/HouseFormRoofSections.tsx](../apps/portal/components/drawings/rail/HouseFormRoofSections.tsx), apps/portal/components/drawings/rail/SanctuaryWorkbenchRail.tsx, [docs/house-inspector-cull-plan.md](house-inspector-cull-plan.md) (the PR-T7 plan).

### 2026-05-29 - Workbench Cleanup - PR-T8 Appendage Feature Cull

Area: Design Workbench / House Geometry

Status: Active

Decision or mistake: removed the roof "appendage band" feature end-to-end -- types, UI, geometry solver, validation codes, fixtures, and dedicated tests. The feature surfaced an editable secondary roof band attached to a chosen house-edge ("hostEdge") with its own pitch, drop, and form, but no production flow consumed it and the right inspector exposed dead fields with no downstream effect.

Why it mattered: the appendage controls were dead UI -- they sat in the inspector but nothing in cost engine, rendering, or estimates read the resulting `HouseRoofModel.appendage` shape. Keeping them around accumulated drag (validation branches, capability flags, host-edge support analysis, geometry-side perimeter builders, and ~12 test surfaces) without delivering a feature. Each subsequent house-roof PR had to thread the appendage shape through, increasing the cognitive load on otherwise-simple changes.

Current guardrail: shape edits to the house roof (pitch tweaks at one corner, mansard bands, lean-tos) go through the gumball in the 3D viewport in a future PR -- not through inspector number fields. If a future engineer reaches for an "add a roof band to this edge" inspector control again, treat it as a smell that the gumball is missing a capability instead of resurrecting the appendage feature. The deleted code lives at the PR-T8 commit -- check git history before re-deriving.

What was deleted (production source returns zero hits for `[Aa]ppendage` outside tombstone comments + tests):

- `packages/geometry/src/house/roofAppendages.ts` -- deleted entirely. The single load-bearing function (`buildSharedHouseRoof`) was lifted into `packages/geometry/src/house/sharedHouseRoof.ts`.
- Geometry types: `HouseRoofAppendageForm`, `HouseRoofAppendageSupport`, `HouseRoofAppendageHostRun`, `HouseRoofAppendageSupportAnalysis`, plus the `roofAppendage` field on `RawHouseInput` and friends.
- Geometry helpers: `deriveHouseRoofAppendageSupport`, `deriveHouseRoofAppendageSupportedHostEdges`, `deriveHouseRoofAppendageSupportFromFootprint`, `deriveHouseRoofAppendageSupportFromPrimaryRoof`, `buildHouseRoofAppendageBand`, `buildMonoAppendagePerimeterEdges`, `buildAppendagePerimeterEdges`, `resolveHouseRoofAppendageForm`, `formatAttachmentSideList`.
- Capability flags: `HouseRoofCapabilities.appendageSupported`, `HouseRoofCapabilities.appendageFootprintRequirement`, `HouseRoofControls.appendage`.
- Validation: `'invalid_appendage_topology'` and `'invalid_appendage_host_edge'` validation codes; `blockedBy: 'appendage'`.
- Portal state: `HouseRoofAppendageForm`, `HouseRoofModel.appendage`, `HouseRoofModel.appendageSupportedHostEdges`, `HouseRoofModel.appendageSupportReason`, `HouseRoofProvenance.appendage`, `HouseFirstRoofDraft.appendage`, plus `isHouseRoofAppendageForm`, `normalizeAppendageForm`, `hasExplicitRoofAppendage`, `roofFormAcceptsAppendage`.
- UI: appendage controls in `HouseFormRoofSections.tsx`, appendage rows in `WorkbenchDiagnosticsPanel.tsx`, appendage inspector model fields in `objectWorkbenchInspectorModel.ts` and `objectWorkbenchStatusModel.ts`.
- Tests: 4 dedicated `houseModel.test.ts` blocks, 1 `houseFirstWorkbenchAdapter.test.ts` block (re-skipped, asserts no longer derivable), 1 `drawingWorkbenchStore.test.ts` block (removed), the appendage gate suite in `houseRoofFormAdapter.test.ts`, the appendage invalid-diagnostics test in `DesignWorkbenchEstimateClient.test.tsx`, plus appendage entries scrubbed from every fixture (`objectFirstWorkbenchFixtures.ts`, `houseFirstWorkbenchFixtures.ts`, multiple test fixtures inline).

Legacy storage: any persisted draft still carrying an `appendage` block is silently dropped at the workbench draft normalize boundary (`normalizeHouseFormRoofIntent`); no migration path is needed because the only consumers were the inspector + the deleted geometry path.

Promoted to: None

Related docs/tests: [packages/geometry/src/house/sharedHouseRoof.ts](../packages/geometry/src/house/sharedHouseRoof.ts), [packages/geometry/src/houseRoofValidation.ts](../packages/geometry/src/houseRoofValidation.ts), apps/portal/lib/drawings/state/houseRoofFormAdapter.ts, [apps/portal/components/drawings/rail/HouseFormRoofSections.tsx](../apps/portal/components/drawings/rail/HouseFormRoofSections.tsx), [docs/appendage-removal-plan.md](appendage-removal-plan.md) (the PR-T8 plan).

### 2026-05-29 - Workbench Cleanup - PR-T9 Deck Inspector Cull

Area: Design Workbench / Deck

Status: Active

Decision or mistake: stripped the deck right-rail inspector of three dead fields (`deck.label`, `deck.kind`, `deck.elevationMode`), one snap-derived field that had a misleading inspector dropdown (`hostEdgeId`), and two duplicate action buttons (top-row `Add deck` + `Custom outline`). Same shape as PR-T8 (atomic delete + verify).

Why it mattered: deck right rail was the same shape as the pre-T7 house rail — manual labels nothing reads, a `kind` enum nothing branched on, an `elevationMode` dropdown whose three options collapsed to a single boolean branch (clamp negative offsets to ground or don't) that the user had never observed firing, and a host-edge dropdown that misled users into thinking they could override the snap engine. Each field added cost to every PR that touched the deck pipeline.

Current guardrail:

- `hostEdgeId` is snap-derived only — written by `buildDeckCommitPatch` in `deckCommitAdapter.ts` during drag release. If a future inspector control re-exposes manual edge selection, treat it as a smell that the snap-target picker is missing a UI affordance, not that the dropdown should come back.
- Deck names auto-derive from list index (`Deck ${index + 1}`). If a future use case needs persistent identity (e.g. PDF callouts), reintroduce as a derived field, not a manual one.
- `elevationMode` is gone — negative `levelOffsetMm` is no longer clamped to ground. A user can now sink a deck below ground level by typing a negative offset. If this bites, the boolean `sitsOnGround` comes back as a one-line addition.
- Costing recon (`rg 'kind|elevationMode' packages/costing/src`) confirmed zero hits before deletion. Re-run before similar culls.

What was deleted (production source returns zero hits for these names outside tombstone comments + negative-assertion tests):

- Portal state types: `DeckKind`, `DeckElevationMode` (both copies — `objectFirstWorkbenchModel.ts` + `houseFirstWorkbenchModel.ts`), plus `label` / `kind` / `elevationMode` fields on `DeckObjectModel`, `ObjectFirstDeckDraft`, `DeckModel`, `HouseFirstDeckDraft`, `ObjectWorkbenchDeckPatch`.
- Type guards: `isDeckKind`, `isDeckElevationMode`.
- Geometry types: `HouseDeckKind`, `HouseDeckElevationMode`, plus `name` / `kind` / `elevationMode` on `HouseDeckConfig`, `HouseDeck3D`, `RawHouseInput.decks[]`.
- Adapter logic: the elevationMode-branched `topSurfaceElevationMm` calc (now unconditionally `= levelOffsetMm`), the detached_threshold_alignment validation emission, the elevationMode-based deck classification (now `isAttached ? 'threshold_attached' : 'ground_supported'`).
- UI: deck-name TextField, deck-kind SelectField, deck-host-edge SelectField, deck-elevation SelectField in `DeckInspectorSections.tsx`. Top-row `Add deck` / `Custom outline` action buttons (left rail and Shape dropdown remain the canonical entry points).
- Options arrays: `DECK_KIND_OPTIONS`, `DECK_ELEVATION_OPTIONS` in `objectRailShared.tsx`.

Legacy storage: persisted drafts still carrying `label` / `kind` / `elevationMode` are silently dropped at `normalizeObjectFirstDeckDraft`. No migration script.

Promoted to: None

Related docs/tests: [apps/portal/components/drawings/rail/DeckInspectorSections.tsx](../apps/portal/components/drawings/rail/DeckInspectorSections.tsx), apps/portal/lib/drawings/state/houseFirstDeckAdapter.ts, [apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts](../apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts), [docs/deck-inspector-cull-plan.md](deck-inspector-cull-plan.md) (the PR-T9 plan).

### 2026-05-29 - Workbench Geometry - Multi-House PR3 Project House Geometry Registry

Area: Workbench Geometry

Status: Active

Decision or mistake: introduced a project-level house geometry registry as the canonical derived source for per-form house references, host-excluded 3D scene composition, and PlanViewport house snap targets in multi-house scenes. Replaces the previous pattern of each per-pergola `RawGeometryModuleInput.houseContext` carrying its own copy of the host house geometry — which produced duplicate scene objects and inconsistent snap targets when more than one pergola attached to the same house form.

Why it mattered: with multi-house support landing (PR3 of the multi-house sequence), the per-pergola houseContext shape stops being a 1:1 source of truth. Multiple pergolas pointing at the same house produced duplicate render objects with colliding ids; PlanViewport snap targets fired against the per-pergola copy, not the canonical project-level house. The registry pattern lifts house geometry to project scope so every consumer reads the same derived artifact.

Current guardrail: scene composition + snap-target derivation must read from the project house geometry registry, not from per-pergola `RawGeometryModuleInput.houseContext`. Per-pergola `houseContext` remains a Phase 2 deletion target (cleanup blocked on the solve loop becoming per-object — see [Phase 2 Plan](design-workbench-phase-2-plan.md)). Host house ids now flow through raw/normalized geometry and solver output directly; do not reintroduce portal-side scene retag bridges.

Promoted to: None

Related docs/tests: [apps/portal/components/drawings/viewports/PlanViewport/PlanViewport.tsx](../apps/portal/components/drawings/viewports/PlanViewport/PlanViewport.tsx), [apps/portal/components/drawings/viewports/PlanViewport/interactions/snap/buildProjectHouseSnapTargets.ts](../apps/portal/components/drawings/viewports/PlanViewport/interactions/snap/buildProjectHouseSnapTargets.ts), [apps/portal/components/drawings/viewports/PlanViewport/interactions/snap/buildProjectHouseSnapTargets.test.ts](../apps/portal/components/drawings/viewports/PlanViewport/interactions/snap/buildProjectHouseSnapTargets.test.ts).

### 2026-05-29 - Workbench Geometry - Multi-Object PR2 Runtime Pergola Solve Sources

Area: Workbench Geometry

Status: Active

Decision or mistake: object-first pergolas without matching calculator modules now solve through explicit runtime-only solve sources. The workbench synthesizes the temporary `CalculatorModuleInputs` adapter in memory so the existing renderer can consume it, but it does not write a fake row to persisted `inputs.modules[]`.

Why it mattered: enabling Add Pergola by persisting a temporary module row would have made the old calculator module bridge more comfortable instead of moving toward the object-first north star. Runtime solve sources let orphan pergolas render/select now while keeping the persistence model pointed at `objectFirst.pergolas`.

Current guardrail: do not create persisted calculator modules just to make object-first pergolas visible or selectable. If code needs calculator-shaped fields during the coexist period, keep them in a named runtime adapter and mark them for deletion with the per-object solve rewrite. Freestanding mono defaults need at least four posts because the geometry solver rejects the two-post layout.

Promoted to: None

Related docs/tests: apps/portal/lib/drawings/state/objectFirstPergolaSolveSources.ts, [apps/portal/lib/drawings/state/workbenchSolvedModel.test.ts](../apps/portal/lib/drawings/state/workbenchSolvedModel.test.ts), apps/portal/lib/drawings/state/drawingWorkbenchStore.test.ts.

### 2026-05-29 - Workbench Geometry - Multi-Object PR3 Freestanding Add Pergola

Area: Workbench Geometry

Status: Active

Decision or mistake: Add Pergola now creates a freestanding `objectFirst.pergolas[]` draft, selects it, and lets the runtime object-first pergola solve-source path render it. The action does not create or persist a calculator module row.

Why it mattered: this is the first user-visible multiple-pergola creation step. If it had written `inputs.modules[]` rows or asked the user to pick a host before creation, it would have rebuilt the legacy module/host workflow instead of the object-first north star.

Current guardrail: new pergolas are born freestanding with solver-valid defaults and snap later creates relationships. Do not add host-picking add flows or fake persisted module rows for visibility, selection, or costing during the coexistence period.

Promoted to: None

Related docs/tests: [apps/portal/app/staff/projects/[projectId]/design-workbench/objectWorkbenchDraftActions.test.ts](../apps/portal/app/staff/projects/%5BprojectId%5D/design-workbench/objectWorkbenchDraftActions.test.ts), [apps/portal/app/staff/projects/[projectId]/design-workbench/DesignWorkbenchEstimateClient.test.tsx](../apps/portal/app/staff/projects/%5BprojectId%5D/design-workbench/DesignWorkbenchEstimateClient.test.tsx), apps/portal/components/drawings/rail/ObjectWorkbenchRail.test.tsx.

### 2026-05-29 - Workbench Geometry - Multi-Object PR4 Plan Pergola Selection

Area: Workbench Geometry

Status: Active

Decision or mistake: non-active project pergola outlines are no longer passive-only plan context. The context `pergola_reference:<id>` shape is rendered as a hit target and routed through the same pergola-id selection resolver used by rail and inspector selection.

Why it mattered: a newly added or non-active pergola could be visible but not directly selectable from the plan, which preserved the old active-module-only editing assumption. Routing by `pergolaId` keeps transient object-first pergolas editable without inventing persisted calculator modules.

Current guardrail: selecting a pergola must resolve the matching solved entry by `pergolaId` across persisted and transient runtime modules. If no entry exists, keep the current module index; never silently select module 0.

Promoted to: None

Related docs/tests: [apps/portal/app/staff/projects/[projectId]/design-workbench/pergolaSelectionState.ts](../apps/portal/app/staff/projects/%5BprojectId%5D/design-workbench/pergolaSelectionState.ts), [apps/portal/components/drawings/viewports/PlanViewport/PlanViewport.test.tsx](../apps/portal/components/drawings/viewports/PlanViewport/PlanViewport.test.tsx), [apps/portal/components/drawings/viewports/PlanViewport/interactions/selectShape.test.ts](../apps/portal/components/drawings/viewports/PlanViewport/interactions/selectShape.test.ts).

### 2026-05-30 - Workbench Geometry - Production-Aligned QA Fixture Routes

Area: Workbench Geometry

Status: Active

Decision or mistake: hidden workbench fixture routes must mount the same project-level render contract as the production workbench route. The `/qa/design-workbench-fixture` route now passes `projectPlanProjection`, project pergola/context overlays, canonical house snap sources, active object refs, hover state, and projection-only model interactions into `DrawingWorkbench` instead of relying on active-module-only fixture defaults.

Why it mattered: the multi-house/two-pergola regressions were caused by active-module render sources. A Playwright fixture that omitted the production project-level props would have tested a parallel surface and could pass while production regressed, or fail on behavior that users no longer exercise.

Current guardrail: fixture routes are allowed to be authless and baked, but they must not simplify workbench render ownership. If production uses project-level object registries, the fixture route must pass those same inputs and only vary the data source.

Promoted to: None

Related docs/tests: [apps/portal/app/staff/projects/[projectId]/design-workbench/DesignWorkbenchFixtureClient.tsx](../apps/portal/app/staff/projects/%5BprojectId%5D/design-workbench/DesignWorkbenchFixtureClient.tsx), [apps/portal/lib/drawings/sanctuaryWorkbenchFixtures.ts](../apps/portal/lib/drawings/sanctuaryWorkbenchFixtures.ts), [playwright/portal.workbench-fixture.spec.ts](../playwright/portal.workbench-fixture.spec.ts).

### 2026-05-30 - Workbench House Forms - Removable Peer Forms

Area: Workbench House Forms

Status: Active

Decision or mistake: house forms are peers. User-visible labels are derived from current order (`House 1`, `House 2`, ...), and existing ids such as `house-main` are not presentation or primary-role signals.

Why it mattered: protecting `house-main`, displaying it as `House`, or re-creating it after the final form was removed kept the old single shared-house model alive inside the object-first workbench. That made removal and attachment behavior look inconsistent and encouraged fallback retargeting.

Current guardrail: when `objectFirst.houseAssembly` exists, its `houseForms[]` array is authoritative even when empty. Removing a house form must not retarget attached objects or silently synthesize a replacement; unresolved hosts are the correct object-first state until the user creates or snaps a new relationship.

Promoted to: None

Related docs/tests: [apps/portal/lib/drawings/state/objectFirstWorkbenchAdapter.ts](../apps/portal/lib/drawings/state/objectFirstWorkbenchAdapter.ts), apps/portal/lib/drawings/state/houseFirstWorkbenchAdapter.ts, apps/portal/lib/drawings/state/drawingWorkbenchStore.test.ts.

### 2026-05-31 - Workbench House Forms - Derived Roof Axis And Preset Seeds

Area: Workbench House Forms

Status: Active

Decision or mistake: hipped ridge axis is a solver-derived field, not normal user-facing house identity or a primary design control. Footprint presets are creation/edit seeds and provenance only; rail and inspector presentation must not describe a house form by raw preset id.

Why it mattered: exposing ridge axis made users fix a solver implementation detail manually when switching between U/wrap/recess footprints. Displaying raw preset ids (`wrap_right footprint`) also made presets look like the object identity even after the footprint became object-owned geometry.

Current guardrail: reconcile hipped `roofIntent.ridgeAxis` from the edited house form's current footprint by `houseFormId` before status/solve/render and on footprint writes. Keep presets available as seed controls, but use order-derived house labels plus neutral footprint readiness/custom status for presentation.

Promoted to: None

Related docs/tests: [apps/portal/lib/drawings/state/houseFormRoofIntentForFootprint.ts](../apps/portal/lib/drawings/state/houseFormRoofIntentForFootprint.ts), [apps/portal/app/staff/projects/[projectId]/design-workbench/houseFormFootprintDraftActions.ts](../apps/portal/app/staff/projects/%5BprojectId%5D/design-workbench/houseFormFootprintDraftActions.ts), [apps/portal/lib/drawings/state/drawingWorkbenchRailModel.ts](../apps/portal/lib/drawings/state/drawingWorkbenchRailModel.ts).

### 2026-05-31 - Workbench House Forms - Roof Intent By Id

Area: Workbench House Forms

Status: Active

Decision or mistake: house roof form, material, pitch, and open-end edits must write to an explicit `houseFormId`. Plan terminal-end hit targets carry their owning house form id, and clicks with missing ownership no-op instead of editing House 1.

Why it mattered: the shared-house roof draft path kept the original single-house assumption alive. When multiple house forms were visible, roof/open-end interactions could silently mutate the first form and make the selected form's Plan/3D roof body look disconnected from the inspector.

Current guardrail: normal roof writes go through `commitHouseFormRoofIntent({ houseFormId, roof })`; `commitSharedHouseRoofDraft` is a legacy wrapper only. New terminal-end or roof-control routes must preserve owner metadata from geometry through selection routing to the draft commit, and must not use array index 0 as a fallback.

Promoted to: None

Related docs/tests: [apps/portal/app/staff/projects/[projectId]/design-workbench/houseFormRoofDraftActions.ts](../apps/portal/app/staff/projects/%5BprojectId%5D/design-workbench/houseFormRoofDraftActions.ts), [apps/portal/components/drawings/viewports/selection/selectionRouter.ts](../apps/portal/components/drawings/viewports/selection/selectionRouter.ts), [packages/geometry/src/topProjection.ts](../packages/geometry/src/topProjection.ts).

### 2026-05-31 - Plan Rendering - House Projection Health And Selected-Only Overlays

Area: Plan Rendering

Status: Active

Decision or mistake: project Plan fallbacks must be diagnosed at the solved-model boundary, and selected-house overlays must only exist for an explicit selected `houseFormId`. No-selection must not manufacture House 1 chrome or overlay geometry.

Why it mattered: after visible body, hit-target, hover, and roof-write ownership were separated, the remaining large outline was a legitimate `house_reference` fallback for a house that lacked a usable roof/roof-material Plan body. Without solved-model health, the UI looked like another paint-layer bug. Without selected-only overlay resolution, no-selection could still inject first-house overlay state and hide the real render source.

Current guardrail: `WorkbenchSolvedModel.projectHouseProjectionHealth` is the project-level diagnostic source for house Plan projection stages. Plan overlays are selected-object chrome/status only; visible bodies come from `projectPlanProjection`, and no selected house means no object-workbench house overlay.

Promoted to: None

Related docs/tests: [apps/portal/lib/drawings/state/projectHouseProjectionHealth.ts](../apps/portal/lib/drawings/state/projectHouseProjectionHealth.ts), [apps/portal/lib/drawings/state/objectWorkbenchHouseOverlayInput.ts](../apps/portal/lib/drawings/state/objectWorkbenchHouseOverlayInput.ts), [apps/portal/components/drawings/viewports/PlanViewport/PlanViewport.test.tsx](../apps/portal/components/drawings/viewports/PlanViewport/PlanViewport.test.tsx), [playwright/portal.workbench-fixture.spec.ts](../playwright/portal.workbench-fixture.spec.ts).

### 2026-05-31 - Workbench House Forms - Selected Status Is Nullable

Area: Workbench House Forms

Status: Active

Decision or mistake: selected-house status must be a nullable, object-id-addressed view over project house-form status. `houseFormsById` can carry status for every row, but selected-house inspector context, trust aggregation, diagnostics, and Plan overlay status must not borrow array index 0 when no house is selected.

Why it mattered: the previous facade kept a temporary `status.houseForm` alias alive by falling back to the first form. That made no-selection and invalid-selection states look like House 1 was active, which obscured whether the remaining Plan issue came from selected chrome, fallback projection health, or a real House 2 geometry problem.

Current guardrail: call sites that need a selected house must use `selectedHouseFormStatus` / `selectedHouseFormId` and handle `null`. Row lists use `houseFormsById[houseForm.id]`; project diagnostics use project-level health; no selected house means no selected-house status.

Promoted to: None

Related docs/tests: [apps/portal/lib/drawings/state/objectWorkbenchStatusModel.ts](../apps/portal/lib/drawings/state/objectWorkbenchStatusModel.ts), [apps/portal/lib/drawings/state/objectWorkbenchInspectorModel.ts](../apps/portal/lib/drawings/state/objectWorkbenchInspectorModel.ts), apps/portal/lib/drawings/state/objectWorkbenchStatusModel.test.ts, apps/portal/lib/drawings/state/drawingWorkbenchStore.test.ts.

### 2026-05-31 - Workbench Actions - Object-Owned House Context

Area: Workbench Actions

Status: Active

Decision or mistake: object-workbench action paths must resolve house context from the target object owner, and unresolved ownership is a real nullable state. They must not use `activeHouseForm ?? houseForms[0]`, active module house position, or any other first-house fallback.

Why it mattered: after status/render paths became selected-object aware, action paths could still silently encode deck/opening/outline commits against House 1. That kind of write path makes later Plan diagnostics misleading because the stored object has already been mutated through the wrong house frame.

Current guardrail: selected house actions resolve by selected `houseFormId`; deck actions resolve through `deck.attachment.host.objectId`; opening actions resolve through `opening.sourceFormId`; pergola house context resolves only through an explicit house-form host. Missing context no-ops or returns a validation error instead of borrowing House 1.

Promoted to: None

Related docs/tests: [apps/portal/app/staff/projects/[projectId]/design-workbench/objectWorkbenchActionContext.ts](../apps/portal/app/staff/projects/%5BprojectId%5D/design-workbench/objectWorkbenchActionContext.ts), [apps/portal/app/staff/projects/[projectId]/design-workbench/useObjectWorkbenchActions.ts](../apps/portal/app/staff/projects/%5BprojectId%5D/design-workbench/useObjectWorkbenchActions.ts), [apps/portal/app/staff/projects/[projectId]/design-workbench/commitOutlineEdit.ts](../apps/portal/app/staff/projects/%5BprojectId%5D/design-workbench/commitOutlineEdit.ts), [apps/portal/app/staff/projects/[projectId]/design-workbench/objectWorkbenchActionContext.test.ts](../apps/portal/app/staff/projects/%5BprojectId%5D/design-workbench/objectWorkbenchActionContext.test.ts).

### 2026-06-01 - Workbench Rendering - Project Object Render Health

Area: Workbench Rendering

Status: Active

Decision or mistake: project render surfaces may only show committed bodies for object-owned healthy geometry. Invalid or unresolved object-first pergolas must stay visible as reference/diagnostic fallback only; they must not be painted into Plan/3D as normal pergola roof/panel/post bodies.

Why it mattered: the multi-object fixture showed an unresolved Pergola 2 still producing committed Plan and 3D geometry by way of coexist solve outputs. That made the UI look like a Plan overlay bug, but the real ambiguity was upstream: render consumers could not tell whether a body was healthy committed geometry or a fallback solve artifact.

Current guardrail: project rendering flows through `buildProjectObjectRenderPipeline`, which emits project Plan projection, per-house projection health, per-pergola render health, and gated Plan/3D body sources. Persisted module-backed pergolas keep their coexist render path, but transient object-first pergolas with unresolved hosts are suppressed from committed body layers and named by id in diagnostics.

Promoted to: None

Related docs/tests: [apps/portal/lib/drawings/state/projectObjectRenderPipeline.ts](../apps/portal/lib/drawings/state/projectObjectRenderPipeline.ts), apps/portal/lib/drawings/state/projectObjectRenderPipeline.test.ts, [apps/portal/lib/drawings/state/workbenchSolvedModel.ts](../apps/portal/lib/drawings/state/workbenchSolvedModel.ts), [playwright/portal.workbench-fixture.spec.ts](../playwright/portal.workbench-fixture.spec.ts).

### 2026-06-01 - Workbench Rendering - Pergola Diagnostic Fallbacks

Area: Workbench Rendering

Status: Active

Decision or mistake: suppressing unhealthy pergolas from committed body layers is not enough; unresolved pergolas need an explicit diagnostic fallback path.

Why it mattered: after committed-body gating, an unresolved gable pergola could either disappear from 3D or paint as a dark Plan body if its `pergola_reference` outline re-entered the generic committed-body graph. Both outcomes made the fixture look broken even though the health gate was correct.

Current guardrail: unresolved pergola references flow through `projectPergolaFallbackPlanShapes` and the 3D `project_pergola_fallbacks` reference-line layer. They may be visible/selectable as transparent context outlines or reference lines with owner diagnostics, but must never use normal pergola roof/panel/post committed body styling.

Promoted to: None

Related docs/tests: [apps/portal/lib/drawings/state/projectObjectRenderPipeline.ts](../apps/portal/lib/drawings/state/projectObjectRenderPipeline.ts), [apps/portal/lib/drawings/state/projectPergolaViewerScene.ts](../apps/portal/lib/drawings/state/projectPergolaViewerScene.ts), [apps/portal/lib/drawings/views/plan/planRenderGraph.test.ts](../apps/portal/lib/drawings/views/plan/planRenderGraph.test.ts), [playwright/portal.workbench-fixture.spec.ts](../playwright/portal.workbench-fixture.spec.ts).

### 2026-06-01 - Workbench Rendering - First-Class Diagnostic Fallbacks

Area: Workbench Rendering

Status: Active

Decision or mistake: diagnostic fallbacks are first-class render outputs. They must not live in committed body layers, hit-target paint, selection/hover chrome, or generic context overlays.

Why it mattered: invalid/custom house roof projection fallbacks and unresolved pergola references were visually ambiguous. A `house_reference` fallback could look like selected-object chrome, while unresolved pergolas could either disappear or borrow generic context styling that was too faint to diagnose.

Current guardrail: Plan render graph exposes `diagnosticFallbacks` separately from `committedBodies` and `hitTargets`; house reference fallbacks render as muted outline-only diagnostics; unresolved pergola fallbacks render as diagnostic Plan outlines and non-committed 3D reference lines with owner/reason metadata. Healthy geometry remains the only source of committed bodies.

Promoted to: None

Related docs/tests: [apps/portal/lib/drawings/views/plan/planRenderGraph.ts](../apps/portal/lib/drawings/views/plan/planRenderGraph.ts), [apps/portal/lib/drawings/views/plan/planDiagnosticFallbacks.ts](../apps/portal/lib/drawings/views/plan/planDiagnosticFallbacks.ts), [apps/portal/components/drawings/viewports/PlanViewport/canvas/layers/PlanDiagnosticFallbackLayer.tsx](../apps/portal/components/drawings/viewports/PlanViewport/canvas/layers/PlanDiagnosticFallbackLayer.tsx), [apps/portal/components/drawings/viewports/Geometry3DViewport/renderers/ReferenceLineObject.tsx](../apps/portal/components/drawings/viewports/Geometry3DViewport/renderers/ReferenceLineObject.tsx).

### 2026-06-01 - Workbench Rendering - House Render Health By Form

Area: Workbench Rendering

Status: Active

Decision or mistake: house render health is owned per `houseFormId` before Plan or 3D consume project render data. The mixed project render pipeline may orchestrate houses and pergolas, but it must not infer house failure stages from the final merged projection.

Why it mattered: custom and edited house forms could degrade to a large `house_reference` diagnostic fallback, but the old diagnostics only counted shapes after project composition. That made it unclear whether the failing stage was reference geometry, model construction, roof planes, roof-material projection, Plan body classification, or 3D scene output.

Current guardrail: `projectHouseRenderPipeline` emits pre-classified house Plan shapes plus per-house stage diagnostics (`referencePresent`, model/wall/roof counts, roof/roof-material ids, 3D body counts, `failureStage`, `diagnosticCode`). `buildProjectPlanProjection` consumes those house shapes and does not rebuild house projection inline.

Promoted to: None

Related docs/tests: [apps/portal/lib/drawings/state/projectHouseRenderPipeline.ts](../apps/portal/lib/drawings/state/projectHouseRenderPipeline.ts), [apps/portal/lib/drawings/state/projectObjectRenderPipeline.ts](../apps/portal/lib/drawings/state/projectObjectRenderPipeline.ts), apps/portal/lib/drawings/state/projectHouseRenderPipeline.test.ts, apps/portal/lib/drawings/sanctuaryWorkbenchFixtures.test.ts.

### 2026-06-01 - Workbench Rendering - House Fixture Health Ownership

Area: Workbench Rendering

Status: Active

Decision or mistake: house render health should have one implementation (`projectHouseRenderPipeline`) and custom/multi-object repro fixtures should live in focused fixture modules, not in the registry entrypoint.

Why it mattered: the custom-house screenshot debugging was obscured by a growing fixture registry and a duplicate post-composition health helper. Once health assertions were tightened, the baked custom fixture reported healthy houses through Plan and 3D, which means that fixture does not reproduce the visible failure and future bug work needs a more exact state fixture/export before changing render policy again.

Current guardrail: add new house/pergola repros in focused fixture modules, assert `failureStage`, Plan/3D body counts, and fallback ids in fixture tests, and keep `projectHouseRenderPipeline` as the single source for per-house render health before Plan/3D consume it.

Promoted to: None

Related docs/tests: [apps/portal/lib/drawings/sanctuaryWorkbenchFixtureBuilders.ts](../apps/portal/lib/drawings/sanctuaryWorkbenchFixtureBuilders.ts), [apps/portal/lib/drawings/sanctuaryWorkbenchMultiObjectFixtures.ts](../apps/portal/lib/drawings/sanctuaryWorkbenchMultiObjectFixtures.ts), [apps/portal/lib/drawings/state/projectHouseRenderPipeline.ts](../apps/portal/lib/drawings/state/projectHouseRenderPipeline.ts), apps/portal/lib/drawings/sanctuaryWorkbenchFixtures.test.ts, [playwright/portal.workbench-fixture.spec.ts](../playwright/portal.workbench-fixture.spec.ts).

### 2026-06-01 - Workbench Rendering - Project 3D Preview Ownership

Area: Workbench Rendering

Status: Active

Decision or mistake: project 3D preview must never use the active module preview as committed geometry for suppressed or unresolved project objects. A ready module may only act as a preview carrier for config/camera metadata when the scene is rebuilt from project-owned house geometry and diagnostic fallbacks.

Why it mattered: unresolved Pergola 2 could be suppressed by project render health but still appear as committed roof geometry in 3D through the active-module preview escape hatch. That made Plan and 3D disagree about whether the pergola was healthy, and it obscured the remaining house projection issue.

Current guardrail: superseded by the 2026-06-11 breakaway. Project 3D preview assembly now flows from the solved project artifact and live workbench runtime must not carry active-module preview fallbacks. Diagnostic/reference geometry is explicit and must not be committed as healthy geometry.

Promoted to: None

Related docs/tests: [docs/design-workbench-architecture.md](design-workbench-architecture.md), [apps/portal/lib/workbenchBreakawayImportGuards.test.ts](../apps/portal/lib/workbenchBreakawayImportGuards.test.ts), [apps/portal/lib/drawings/state/projectPergolaViewerScene.ts](../apps/portal/lib/drawings/state/projectPergolaViewerScene.ts), [playwright/portal.workbench-fixture.spec.ts](../playwright/portal.workbench-fixture.spec.ts).

### 2026-06-01 - Workbench Geometry - House Form Input Boundary

Area: Workbench Geometry

Status: Active

Decision or mistake: house geometry must cross one object-id-addressed input boundary before Plan or 3D consume it. Render pipelines must not infer a house form from the first form, `house-main`, active module input, or active pergola state.

Why it mattered: the remaining house-form screenshots looked like Plan overlays, but the persistent symptom was missing or invalid roof geometry for a specific object. Without a per-house input boundary, diagnostics could name final render fallout but not the first failing stage.

Current guardrail: use `buildHouseFormGeometryInput({ projectModel, houseFormId })` for project house render assembly. It resolves exactly one form and reports typed stages (`missing_house_form`, `invalid_footprint`, `missing_geometry_input`, `missing_model`, `missing_roof_model`, `missing_plan_body`, `missing_3d_body`, `none`) with no fallback to any other house or module. Gated debug exports include `houseGeometryInputsById` so live failures can be captured as fixtures.

Promoted to: None

Related docs/tests: [apps/portal/lib/drawings/state/houseFormGeometryInput.ts](../apps/portal/lib/drawings/state/houseFormGeometryInput.ts), [apps/portal/lib/drawings/state/projectHouseRenderPipeline.ts](../apps/portal/lib/drawings/state/projectHouseRenderPipeline.ts), [apps/portal/lib/drawings/workbenchDebugExport.ts](../apps/portal/lib/drawings/workbenchDebugExport.ts), apps/portal/lib/drawings/state/houseFormGeometryInput.test.ts.

### 2026-06-02 - Geometry Tests - Stage-Owned House Model Coverage

Area: Geometry Tests

Status: Active

Decision or mistake: house-model solver coverage should be owned by geometry stage or family. `houseModel.test.ts` should remain a small public-entry smoke suite, not the place for every roof topology, attachment, solids, and preset assertion.

Why it mattered: the 3,700+ line house-model integration test hid the failing house-form roof path inside broad coverage and made future solver fixes harder to review safely.

Current guardrail: add new package house solver tests under `packages/geometry/src/house/` by stage/family. Shared fixtures can live in `houseModelTestSupport.ts`, but stage-specific behavior should not grow `houseModel.test.ts`.

Promoted to: None

Related docs/tests: [packages/geometry/src/houseModel.test.ts](../packages/geometry/src/houseModel.test.ts), [packages/geometry/src/house/houseModelTestSupport.ts](../packages/geometry/src/house/houseModelTestSupport.ts), [packages/geometry/src/house/roofPresetCoverage.test.ts](../packages/geometry/src/house/roofPresetCoverage.test.ts), [packages/geometry/src/house/roofJoinedTopologyIntegration.test.ts](../packages/geometry/src/house/roofJoinedTopologyIntegration.test.ts), [packages/geometry/src/house/roofOpenEndsIntegration.test.ts](../packages/geometry/src/house/roofOpenEndsIntegration.test.ts).

### 2026-06-02 - Workbench Geometry - Captured Fixture Gate For Solver Fixes

Area: Workbench Geometry

Status: Active

Decision or mistake: screenshot-only house roof failures are not enough evidence for geometry solver changes. A solver fix must be driven by an exact captured debug fixture payload from the real staff workbench.

Why it mattered: repeated approximation fixtures improved ownership and diagnostics but did not reproduce the user's visible failure. Without the live payload, changing the roof solver risks fixing synthetic cases while the real object-first state still fails at a different stage.

Current guardrail: bake captured live failures through `sanctuaryWorkbenchCapturedFixtures.ts` using the gated `Copy debug fixture payload` output. If no exact payload is available, land only fixture/import/harness improvements and do not change solver behavior.

Promoted to: None

Related docs/tests: [apps/portal/lib/drawings/sanctuaryWorkbenchCapturedFixtures.ts](../apps/portal/lib/drawings/sanctuaryWorkbenchCapturedFixtures.ts), [apps/portal/lib/drawings/workbenchDebugExport.ts](../apps/portal/lib/drawings/workbenchDebugExport.ts), apps/portal/lib/drawings/sanctuaryWorkbenchFixtures.test.ts.

### 2026-06-02 - Workbench Geometry - Roof Stage Diagnostics Must Be Render-Critical

Area: Workbench Geometry

Status: Active

Decision or mistake: roof-stage diagnostics must report the first missing render-critical stage, not an optional intermediate collection when valid committed roof bodies already exist.

Why it mattered: the first exact captured staff-workbench payload showed a mono roof with valid roof planes, valid QA, Plan roof-material bodies, and 3D roof-material scene bodies, but diagnostics still reported `eave_polygon_construction_failed` because the separate eave polygon arrays were empty. That made a healthy render path look like a solver failure and obscured real remaining house-form issues.

Current guardrail: package roof-stage diagnostics may classify eave construction as failed only when the missing eave output prevents downstream roof body/material generation. Mono roofs with valid roof planes and committed roof body/material output are eave-stage healthy even if they do not populate a separate eave polygon list.

Promoted to: None

Related docs/tests: [packages/geometry/src/houseRoofDiagnostics.ts](../packages/geometry/src/houseRoofDiagnostics.ts), [packages/geometry/src/house/roofModelPipeline.test.ts](../packages/geometry/src/house/roofModelPipeline.test.ts), [apps/portal/lib/drawings/sanctuaryWorkbenchCapturedFixtures.ts](../apps/portal/lib/drawings/sanctuaryWorkbenchCapturedFixtures.ts), apps/portal/lib/drawings/sanctuaryWorkbenchFixtures.test.ts.

### 2026-06-02 - Workbench Debugging - Multi-House Capture Verifier

Area: Workbench Debugging

Status: Active

Decision or mistake: a valid workbench debug export is not automatically a valid solver fixture for the multi-house roof failure. The capture must match the bug class before it is baked or used to justify geometry changes.

Why it mattered: the first agent-access capture of the provided staff workbench URL produced no object-first house assembly and only healthy `house-main` diagnostics. Baking that payload as a multi-house repro would repeat the previous failure mode: improving diagnostics while not fixing the visible multi-house bug.

Current guardrail: run `npm run workbench:capture:verify` for this lane. It requires object-first state, at least two house forms, per-house diagnostics, and at least one non-healthy or inconsistent house roof/render stage. If the verifier rejects the page, land tooling/evidence improvements only and do not change solver behavior.

Promoted to: None

Related docs/tests: [playwright/support/workbenchCaptureVerifier.ts](../playwright/support/workbenchCaptureVerifier.ts), [playwright/workbench.capture-verify.spec.ts](../playwright/workbench.capture-verify.spec.ts), [docs/workbench-captured-repro-workflow.md](workbench-captured-repro-workflow.md), [docs/testing-and-qa.md](testing-and-qa.md).

### 2026-06-02 - Agent Tooling - Shared Page Debug Exports

Area: Agent Tooling

Status: Active

Decision or mistake: complex portal page bug reports should capture the shared gated page debug export before implementation changes. Screenshots are useful evidence, but they are not enough for routes with server state, client state, local drafts, scenario data, or render diagnostics.

Why it mattered: recent workbench debugging improved architecture but did not visibly fix the bug until the exact failing state could be captured. The same pattern should apply across project, estimate, quote, schedule, running jobs, design list, and future complex pages.

Current guardrail: use `PortalPageDebugExport` for local/staging/debug-only page diagnostics, expose it with `data-portal-debug-export="true"`, and read it in browser specs through `readPortalPageDebugExport` / `expectPortalDebugExport`. Routine browser gates may read debug exports but must not mutate app data.

Promoted to: None

Related docs/tests: [apps/portal/lib/debug/portalPageDebugExport.ts](../apps/portal/lib/debug/portalPageDebugExport.ts), [playwright/support/portalAgent.ts](../playwright/support/portalAgent.ts), [docs/portal-route-catalog.md](portal-route-catalog.md), [docs/testing-and-qa.md](testing-and-qa.md).

### 2026-06-02 - Agent Tooling - Portal Agent Scorecard

Area: Agent Tooling

Status: Active

Decision or mistake: portal-agent quality should be catalog/report driven through a shared scorecard, not manually inferred from screenshots, one-off browser specs, route lists, or local memory.

Why it mattered: PR-Agent.1-5 created authenticated access, route cataloging, seeded scenarios, page debug exports, and shared browser evidence. Without one concise report, agents still had to inspect scattered files to decide whether the next best lane was route coverage, scenarios, debug exports, evidence adoption, or general repo health.

Current guardrail: use `npm run portal:agent-scorecard` before choosing agent-readiness or strictness PRs. The command reads existing catalogs/reports only, supports JSON output for automation, and must not run browsers, provision users, seed scenarios, or expose credentials.

Promoted to: None

Related docs/tests: [docs/portal-agent-scorecard.md](portal-agent-scorecard.md), [playwright/support/portalAgentScorecard.ts](../playwright/support/portalAgentScorecard.ts), [scripts/portal-agent-scorecard.ts](../scripts/portal-agent-scorecard.ts), [playwright/support/portalAgentScorecard.test.ts](../playwright/support/portalAgentScorecard.test.ts).

### 2026-06-02 - Agent Tooling - Portal Agent Strictness Ratchet

Area: Agent Tooling

Status: Active

Decision or mistake: strictness ratchets must start with stable, changed-safe coverage baselines and must not block broad legacy pressure or unrelated repo-health debt.

Why it mattered: PR-Agent.1-6 created real portal-agent tooling, but immediately making broad repo-health metrics strict would create noisy failures from existing debt. The first useful strict check is "do not go backwards" on the agent-readiness baseline that was just established.

Current guardrail: use `npm run portal:agent-scorecard:strict` to protect route catalog coverage, scenario coverage, exported debug-route coverage, seeded scenario coverage, and shared browser evidence adoption. Keep `npm run portal:agent-scorecard` advisory and keep repo-health metrics advisory until a later changed-file-safe ratchet explicitly owns them.

Promoted to: None

Related docs/tests: [docs/portal-agent-scorecard.md](portal-agent-scorecard.md), [playwright/support/portalAgentScorecard.ts](../playwright/support/portalAgentScorecard.ts), [scripts/portal-agent-scorecard.ts](../scripts/portal-agent-scorecard.ts), [playwright/support/portalAgentScorecard.test.ts](../playwright/support/portalAgentScorecard.test.ts).

### 2026-06-02 - Workbench Debugging - Captured Repro Workflow

Area: Workbench Debugging

Status: Active

Decision or mistake: workbench captured repros must be validated and attached through the shared Playwright helper before any exact payload is baked into the captured fixture lane. Browser specs may read and attach payloads as evidence, but must not write captured payloads to tracked files.

Why it mattered: repeated screenshot-driven workbench PRs improved architecture but did not reliably reproduce the live failure. PR-Agent.8 makes the live payload itself executable evidence by validating the required snapshot, object-first state, selected state, house geometry inputs, project house health, pergola health, and project preview source before solver or render changes begin.

Current guardrail: use `readWorkbenchCapturedReproPayload(page)` / `attachWorkbenchCapturedReproPayload(testInfo, page)` for workbench browser evidence. Keep `CAPTURED_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES` limited to exact copied staff-workbench payloads intentionally pasted through `buildCapturedSanctuaryGeometryWorkbenchFixture`; screenshot approximations do not belong in the captured lane.

Promoted to: None

Related docs/tests: [docs/workbench-captured-repro-workflow.md](workbench-captured-repro-workflow.md), [playwright/support/workbenchCapturedRepro.ts](../playwright/support/workbenchCapturedRepro.ts), [playwright/support/workbenchCapturedRepro.test.ts](../playwright/support/workbenchCapturedRepro.test.ts), [playwright/portal.workbench-fixture.spec.ts](../playwright/portal.workbench-fixture.spec.ts), [apps/portal/lib/drawings/sanctuaryWorkbenchCapturedFixtures.ts](../apps/portal/lib/drawings/sanctuaryWorkbenchCapturedFixtures.ts).

### 2026-06-03 - Design Workbench - Durable Object-First Draft Save

Area: Design Workbench

Status: Active

Decision or mistake: object-first workbench state must be durable before live multi-house geometry bugs can be captured or fixed reliably. IndexedDB-only drafts are useful for local editing, but they are not enough for agent-access repros because leaving and reopening the workbench can recreate the legacy snapshot-only `house-main` state.

Why it mattered: the multi-house roof failure could not be baked from the provided staff workbench URL because the reloaded project had no saved `objectFirst` assembly. Without a server-backed object-first draft save, agents and browser tests would keep debugging transient UI states that cannot survive reload.

Current guardrail: persist `EstimateDrawingDraft.objectFirst` through authenticated staff estimate boundaries, keep it out of legacy `inputs.modules[]`, and make saved object-first state the reload source of truth. Legacy `house-main` synthesis is allowed only when no saved object-first draft exists.

Promoted to: None

Related docs/tests: [docs/design-workbench-phase-2-plan.md](design-workbench-phase-2-plan.md), [apps/portal/lib/estimates/drawingEdits.ts](../apps/portal/lib/estimates/drawingEdits.ts), [apps/portal/app/staff/projects/[projectId]/design-workbench/DesignWorkbenchEstimateClient.tsx](../apps/portal/app/staff/projects/[projectId]/design-workbench/DesignWorkbenchEstimateClient.tsx).

### 2026-06-03 - Design Workbench - House Roof Intent Provenance

Area: Design Workbench

Status: Active

Decision or mistake: unauthored object-first house roof defaults must not silently determine roof topology. The saved multi-house repro showed persisted `roofIntent.form: "mono"` values that were not authored design choices, so Plan and 3D could render mono-like roofs while diagnostics still looked healthy.

Why it mattered: house roof topology is object-owned state. Without provenance, a legacy/default mono value can leak into a specific `houseFormId` and make the rendered roof disagree with the user's expected default, while authored mono roofs still need to remain supported.

Current guardrail: resolve house roof intent through the object-first authorship boundary before status, raw geometry input, project Plan, or 3D render health consume it. Unauthored mono repairs to the canonical house default (`hipped`); authored mono is preserved. Diagnostics must expose raw form, resolved form, authorship, source, and repair code per `houseFormId`.

Promoted to: None

Related docs/tests: [docs/design-workbench-phase-2-plan.md](design-workbench-phase-2-plan.md), [apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts](../apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts), [apps/portal/lib/drawings/state/houseFormGeometryInput.ts](../apps/portal/lib/drawings/state/houseFormGeometryInput.ts), [apps/portal/lib/drawings/state/objectWorkbenchStatusModel.ts](../apps/portal/lib/drawings/state/objectWorkbenchStatusModel.ts).

### 2026-06-03 - Workbench House Forms - Custom Hipped Eave Topology Repair

Area: Workbench House Forms

Status: Active

Decision or mistake: custom hipped house roofs with narrow returns can fail package roof QA after footprint/eave topology solving while the selected house status still reports only a generic approximate state. Render code must not paper over this by fabricating roof bodies or borrowing another house; the package roof solve must classify and repair the first failing eave topology stage when a constrained roof-only repair is possible.

Why it mattered: House 4-style custom footprints kept their wall geometry in Plan/3D but lost the 3D roof because `roofQaStatus` was invalid (`overlapping_boundary_fragments`). Plan could look clean after the house-owned projection fix, but 3D still dropped roof solids and the inspector trust chip hid the package QA failure.

Current guardrail: custom hipped eave repair is package-owned and render-only. The saved wall footprint and user eave setting remain unchanged; repaired models expose `roofEaveOffsetRepairStatus`, `roofEaveOffsetRepairCode`, and requested/effective eave metadata. Plan projection consumes the repaired eave package from the same `HouseModel3D` that produces 3D roof solids. Workbench status must use final package roof QA, not selection validation alone.

Promoted to: None

Related docs/tests: [docs/costing-and-geometry.md](costing-and-geometry.md), [docs/design-workbench-architecture.md](design-workbench-architecture.md), [packages/geometry/src/house/eaveOffsetRepair.ts](../packages/geometry/src/house/eaveOffsetRepair.ts), [packages/geometry/src/house/roofPresetCoverage.test.ts](../packages/geometry/src/house/roofPresetCoverage.test.ts), apps/portal/lib/drawings/state/projectHouseRenderPipeline.test.ts, apps/portal/lib/drawings/state/objectWorkbenchStatusModel.test.ts, [playwright/portal.workbench-fixture.spec.ts](../playwright/portal.workbench-fixture.spec.ts).

### 2026-06-11 - Workbench House Forms - Topology-Aware Eave Offset Boundary

Area: Workbench House Forms

Status: Active

Decision or mistake: some fully hipped custom orthogonal house roofs fail before roof topology because adjacent-edge miter eave offset can self-overlap on edited narrow recesses. Treating this as a roof-topology or Plan-paint issue hides the first failing geometry stage.

Why it mattered: House 4-style footprints could be valid wall shapes with the requested eave overhang, but the legacy eave offset boundary collapsed before semantic roof QA had a clean polygon to solve. Reducing the eave overhang can make a roof visible, but that is an approximate render repair and should not be the first north-star path.

Current guardrail: eave-offset recovery belongs in `@sp/geometry`. For fully hipped custom orthogonal roofs, keep the existing adjacent-edge eave path for already-healthy cases, but when package QA fails with eave-offset self-overlap, try `orthogonal_cell_union` at the requested overhang before any reduced-overhang/narrow-return repair. Commit the exact boundary only if downstream roof QA is valid; otherwise remain invalid or fall through to the approximate repair path with `roofEaveOffsetRepair*` metadata. Do not add Plan paint fallbacks, first-house fallbacks, or active-module fallbacks.

Promoted to: None

Related docs/tests: [docs/costing-and-geometry.md](costing-and-geometry.md), [docs/design-workbench-architecture.md](design-workbench-architecture.md), [packages/geometry/src/house/orthogonalEaveOffset.ts](../packages/geometry/src/house/orthogonalEaveOffset.ts), [packages/geometry/src/house/eaveOffsetRepair.ts](../packages/geometry/src/house/eaveOffsetRepair.ts), [packages/geometry/src/houseModel.ts](../packages/geometry/src/houseModel.ts), [packages/geometry/src/house/roofPresetCoverage.test.ts](../packages/geometry/src/house/roofPresetCoverage.test.ts).

### 2026-06-03 - Workbench House Forms - Custom Footprint Numeric Canonicalization

Area: Workbench House Forms

Status: Active

Decision or mistake: tiny floating-point residue from object-first custom footprint editing can make a valid custom hipped house look degenerate to package roof topology, surfacing as `roof_topology_face_count_mismatch` even though the same footprint rounded to sub-visible precision solves correctly.

Why it mattered: the live House 4 repro was not another Plan projection bug or eave-overhang collapse. The wall outline was valid, but one local footprint edge carried near-zero metre residue. Without a package boundary cleanup, Plan, 3D, status, and diagnostics could disagree or report invalid geometry for an authored shape that is valid at modelling precision.

Current guardrail: numeric stabilization belongs at the `@sp/geometry` house solve boundary. Canonicalize solved footprint coordinates to `0.001 mm`, collapse duplicate consecutive points, and remove residue-only collinear points before wall/eave/roof solving; do not round or rewrite saved workbench values. Surface additive `footprintCanonicalization*` metadata per `houseFormId`, and keep Plan/3D consuming the same `HouseModel3D.footprint` rather than adding portal-only render workarounds.

Promoted to: None

Related docs/tests: [docs/costing-and-geometry.md](costing-and-geometry.md), [docs/design-workbench-architecture.md](design-workbench-architecture.md), [packages/geometry/src/house/footprintMath.ts](../packages/geometry/src/house/footprintMath.ts), [packages/geometry/src/house/roofPresetCoverage.test.ts](../packages/geometry/src/house/roofPresetCoverage.test.ts), apps/portal/lib/drawings/state/projectHouseRenderPipeline.test.ts, apps/portal/lib/drawings/sanctuaryWorkbenchFixtures.test.ts, [playwright/portal.workbench-fixture.spec.ts](../playwright/portal.workbench-fixture.spec.ts).

### 2026-06-03 - Workbench House Forms - Custom Hipped Eave Graph Topology

Area: Workbench House Forms

Status: Active

Decision or mistake: custom orthogonal hipped roofs should not depend on the old rectilinear region-dissolve stage for fully hipped topology. The live House 4 break surfaced as `house-eave-edge-5:unclosed_boundary_graph`: the eave polygon was solvable, but one post-dissolve roof-face boundary failed to close.

Why it mattered: after Plan projection and numeric canonicalization were fixed, the remaining failure was a package roof-topology stage, not a visual layer bug. Adding Plan paint fallbacks or active-module fallbacks would have hidden the first failing geometry stage and kept House 4 visually untrustworthy in 3D.

Current guardrail: fully hipped non-rectangular orthogonal house footprints route through `eave_graph_source_edge_envelope`, which commits one semantic roof facet per source eave edge and rejects/coalesces duplicate lower-envelope fragments before they can be committed as healthy geometry. Open-end/gable variants may continue using the existing joined path until retired separately. Diagnostics must expose `roofTopologySolver`, semantic QA, failure edge/reason, closed/expected face counts, and gap/overlap/dangling counts; invalid roofs still render diagnostics/reference geometry only.

Promoted to: None

Related docs/tests: [docs/costing-and-geometry.md](costing-and-geometry.md), [docs/design-workbench-architecture.md](design-workbench-architecture.md), [packages/geometry/src/house/roofEaveGraphHipped.ts](../packages/geometry/src/house/roofEaveGraphHipped.ts), [packages/geometry/src/house/roofPrimary.ts](../packages/geometry/src/house/roofPrimary.ts), [packages/geometry/src/house/roofJoinedTopologyIntegration.test.ts](../packages/geometry/src/house/roofJoinedTopologyIntegration.test.ts), [packages/geometry/src/house/roofPresetCoverage.test.ts](../packages/geometry/src/house/roofPresetCoverage.test.ts), apps/portal/lib/drawings/state/projectHouseRenderPipeline.test.ts.

### 2026-06-03 - Workbench House Forms - Semantic Hipped Topology QA

Area: Workbench House Forms

Status: Active

Decision or mistake: a custom hipped roof can have finite roof planes and matching projected area while still being visually untrustworthy if the committed planes are lower-envelope fragments instead of semantic eave-owned faces.

Why it mattered: House 4 could show `Geometry ready` while Plan/3D rendered a huge fragmented roof with dangling/internal feature lines and a broken 3D surface. The renderer was exposing bad committed package geometry; it was not the first failing stage.

Current guardrail: fully hipped custom orthogonal roofs must pass semantic topology QA before normal roof solids/materials are committed. Healthy output uses `eave_graph_source_edge_envelope`, one semantic face per required eave edge, zero internal eave-height seams, no duplicate lower-envelope fragments, no fallback valley features, and feature lines backed by final facet adjacency. Lower-envelope fragments may exist only as diagnostics, never as healthy committed roof bodies.

Promoted to: None

Related docs/tests: [docs/costing-and-geometry.md](costing-and-geometry.md), [docs/design-workbench-architecture.md](design-workbench-architecture.md), [packages/geometry/src/house/roofEaveGraphHipped.ts](../packages/geometry/src/house/roofEaveGraphHipped.ts), [packages/geometry/src/house/roofQa.ts](../packages/geometry/src/house/roofQa.ts), [packages/geometry/src/house/roofJoinedTopologyIntegration.test.ts](../packages/geometry/src/house/roofJoinedTopologyIntegration.test.ts), [packages/geometry/src/house/roofPresetCoverage.test.ts](../packages/geometry/src/house/roofPresetCoverage.test.ts), [packages/geometry/src/viewer.test.ts](../packages/geometry/src/viewer.test.ts).

### 2026-06-03 - Workbench House Forms - Status Uses Resolved Geometry

Area: Workbench House Forms

Status: Active

Decision or mistake: multi-house preset forms can have empty object-first draft polygons even though the house geometry input boundary can resolve a valid physical footprint. Status, rail subtitles, inspector trust, and selected-house invalidity must validate against the addressed form's resolved geometry, not the empty draft polygon.

Why it mattered: the Plan/3D render pipeline could show healthy or diagnostic per-house geometry by id while the rail and inspector still labelled preset houses as `Invalid geometry`. That made a status-boundary bug look like a Plan or 3D visual failure and risked triggering paint-layer workarounds.

Current guardrail: `objectWorkbenchStatusModel` derives roof validation from `buildHouseFormRawGeometryInput(houseForm)` whenever a form's side-local polygon is empty, preserving authored invalid choices while avoiding first-house or active-module fallback. New multi-house status tests should cover preset forms with empty draft polygons.

Promoted to: None

Related docs/tests: [apps/portal/lib/drawings/state/objectWorkbenchStatusModel.ts](../apps/portal/lib/drawings/state/objectWorkbenchStatusModel.ts), apps/portal/lib/drawings/state/objectWorkbenchStatusModel.test.ts, [apps/portal/lib/drawings/state/houseFormRawGeometry.ts](../apps/portal/lib/drawings/state/houseFormRawGeometry.ts).

### 2026-06-03 - Workbench House Forms - Single-Pergola 3D Uses Project Houses

Area: Workbench House Forms

Status: Active

Decision or mistake: project 3D preview composition must replace legacy active-module house layers whenever object-owned project house geometry exists, even when there is only one pergola/module.

Why it mattered: the single-pergola fast path returned the active module's legacy 3D preview directly. Multi-house projects could therefore show object-owned house forms in Plan diagnostics while 3D still rendered the active module's wall-only/legacy house layer, making the same `houseFormId` visually disagree across Plan and 3D.

Current guardrail: superseded by the 2026-06-11 breakaway. Live workbench runtime no longer has an active-module preview path; Plan and 3D consume the solved project artifact and expose object-owned diagnostics per `houseFormId`.

Promoted to: None

Related docs/tests: [docs/design-workbench-architecture.md](design-workbench-architecture.md), [apps/portal/lib/workbenchBreakawayImportGuards.test.ts](../apps/portal/lib/workbenchBreakawayImportGuards.test.ts), [apps/portal/components/drawings/viewports/Geometry3DViewport/index.tsx](../apps/portal/components/drawings/viewports/Geometry3DViewport/index.tsx), apps/portal/components/drawings/viewports/Geometry3DViewport/Geometry3DViewport.test.tsx.

### 2026-06-03 - Workbench House Forms - Coverage Solver Quarantine

Area: Workbench House Forms

Status: Active

Decision or mistake: the source-edge coverage partition is the right package-owned recovery path for custom hipped roofs whose older source-edge envelope path fails with area/coverage mismatch, but forcing all existing custom hipped footprints through it immediately regresses older U/L fixtures with raised boundary fragments.

Why it mattered: House 4 needs a coverage-owned fix at the first failing roof stage, but replacing every custom hipped path at once would trade one visible bug for another. The north-star move is to quarantine legacy behavior while retiring it in provable slices, not to pretend a partly proven solver is universally ready.

Current guardrail: fully hipped custom roofs first use the existing validated source-edge envelope path when it proves valid. When that path fails, `@sp/geometry` can commit `source_edge_coverage_partition` only if it proves non-empty source-edge coverage and zero coverage delta/gap/overlap within tolerance; otherwise the roof remains invalid with package diagnostics. Coverage metadata (`roofTopologyCoverage*`) must be surfaced through package, Plan, and 3D diagnostics so the next retirement slice can target exact failing topology without Plan paint or active-module fallbacks.

Promoted to: None

Related docs/tests: [packages/geometry/src/house/roofEaveGraphHipped.ts](../packages/geometry/src/house/roofEaveGraphHipped.ts), [packages/geometry/src/house/roofPresetCoverage.test.ts](../packages/geometry/src/house/roofPresetCoverage.test.ts), [packages/geometry/src/houseRoofDiagnostics.ts](../packages/geometry/src/houseRoofDiagnostics.ts), [packages/geometry/src/viewer.ts](../packages/geometry/src/viewer.ts), [playwright/support/workbenchFixture.ts](../playwright/support/workbenchFixture.ts).

### 2026-06-11 - Workbench House Forms - Exact Hipped Partition Diagnostics

Area: Workbench House Forms

Status: Active

Decision or mistake: a pure source-edge exact lower-envelope partition is useful package-owned topology evidence, but it must not become the first failure diagnostic when another committed candidate passes semantic QA. Infinite source-edge roof-plane clipping can erase legitimate short-edge faces on concave custom forms, so replacing every custom hipped roof with that exact attempt in one slice would regress known-valid fixtures.

Why it mattered: the north-star move is to retire the brittle rectilinear/dissolve path by proving cleaner package geometry, not by making healthy roofs look invalid or adding portal paint fallbacks. Exact partition QA now surfaces as metadata for captured payloads, while committed geometry still has to pass semantic and coverage gates.

Current guardrail: fully hipped custom roofs try `source_edge_exact_envelope_partition` first and expose `roofTopologyExactPartition*` metadata. If exact semantic QA fails, known-good `eave_graph_source_edge_envelope` may still commit only when semantic QA passes; `source_edge_coverage_partition` may recover split source-edge faces only when every source edge is represented and coverage/semantic QA are valid. Do not use failed exact-attempt metadata as `diagnosticCode` for a roof that committed valid geometry.

Promoted to: None

Related docs/tests: [docs/costing-and-geometry.md](costing-and-geometry.md), [docs/design-workbench-architecture.md](design-workbench-architecture.md), [packages/geometry/src/house/roofEaveGraphHipped.ts](../packages/geometry/src/house/roofEaveGraphHipped.ts), [packages/geometry/src/house/roofPresetCoverage.test.ts](../packages/geometry/src/house/roofPresetCoverage.test.ts), [packages/geometry/src/houseRoofDiagnostics.ts](../packages/geometry/src/houseRoofDiagnostics.ts), [packages/geometry/src/viewer.ts](../packages/geometry/src/viewer.ts), [playwright/support/workbenchFixture.ts](../playwright/support/workbenchFixture.ts).

### 2026-06-11 - Design Workbench - Breakaway From Calculator Runtime

Area: Design Workbench

Status: Active

Decision or mistake: live Design Workbench runtime is now a separate object-first product path. It accepts persisted `WorkbenchProjectModel` state and solves to `WorkbenchSolvedGeometryArtifact`; it no longer reads or synthesizes calculator module state, house-first carriers, raw module house context, active module indexes, legacy plan/section models, or workbench costing payloads.

Why it mattered: compatibility bridges kept reintroducing first-house and per-module assumptions while roof geometry bugs were being debugged. Keeping calculator and workbench coupled made visual trust depend on hidden fallback paths instead of object-owned package geometry diagnostics.

Current guardrail: workbench runtime roots must pass the breakaway import guard. Snapshot-only calculator designs should load as unsupported/empty workbench designs, not be synthesized. Workbench repricing remains unavailable until a downstream artifact/takeoff-to-commercial adapter is introduced outside geometry/render/runtime decisions. Marketing enquiry and calculator V1 pricing remain protected as a separate path.

Promoted to: None

Related docs/tests: [docs/design-workbench-architecture.md](design-workbench-architecture.md), [docs/costing-and-geometry.md](costing-and-geometry.md), [apps/portal/lib/workbenchBreakawayImportGuards.test.ts](../apps/portal/lib/workbenchBreakawayImportGuards.test.ts), `npm run test:portal:workbench`.

### 2026-06-12 - Design Workbench - Remaining Runtime Cleanup Guard

Area: Design Workbench

Status: Active

Decision or mistake: after the breakaway, live workbench roots still carried cleanup-only calculator-era names and fixture pricing diagnostics that could invite new compatibility work.

Why it mattered: the workbench should stay object-first and geometry-owned. Pricing/readiness belongs to estimates/calculator/commercial paths until a downstream solved-artifact takeoff adapter exists.

Current guardrail: live workbench runtime roots must not import `@sp/costing`, expose `data-workbench-pricing*`, or reintroduce `activeModule`, `moduleLabel`, `legacy_plan_m`, or `geometry_plan_fallback`. Sheet labels, object-outline diagnostic coordinates, and diagnostic plan references are the workbench names.

Promoted to: None

Related docs/tests: [docs/design-workbench-architecture.md](design-workbench-architecture.md), [apps/portal/lib/workbenchBreakawayImportGuards.test.ts](../apps/portal/lib/workbenchBreakawayImportGuards.test.ts).

### 2026-06-12 - Design Workbench - Module Vocabulary Retirement

Area: Design Workbench

Status: Active

Decision or mistake: after the calculator breakaway, live workbench runtime still exposed solved-module wrappers and module-shaped pergola render/status names even though project solving was already object-first.

Why it mattered: leaving empty `modules` arrays, `moduleInput`, `moduleId`, and module-state terms in the runtime made future work likely to rebuild per-module assumptions around an object-first artifact.

Current guardrail: live workbench roots must use object/pergola artifact vocabulary. Pergola render diagnostics are keyed by `pergolaId`/`artifactId`; `WorkbenchSolvedModel` must not expose solved-module arrays; pergola inspector and rail state must not reintroduce module selection/status names. Calculator/public-export module vocabulary remains outside the workbench boundary only.

Promoted to: None

Related docs/tests: [docs/design-workbench-architecture.md](design-workbench-architecture.md), [apps/portal/lib/workbenchBreakawayImportGuards.test.ts](../apps/portal/lib/workbenchBreakawayImportGuards.test.ts), [apps/portal/lib/drawings/state/workbenchSolvedModel.ts](../apps/portal/lib/drawings/state/workbenchSolvedModel.ts), [apps/portal/lib/drawings/state/projectObjectRenderPipeline.ts](../apps/portal/lib/drawings/state/projectObjectRenderPipeline.ts).

### 2026-06-12 - Design Workbench - Docs Current-State Reset

Area: Design Workbench

Status: Active

Decision or mistake: after the breakaway and module-vocabulary cleanup, the workbench docs still mixed current architecture, historical cull PR sequences, and roof incident notes in ways that could be mistaken for active implementation guidance.

Why it mattered: stale campaign language can pull future work back toward compatibility tasks, module-era problem framing, or visual bug history instead of the current object-first artifact boundary.

Current guardrail: `docs/design-workbench-architecture.md` is the current contract, `docs/design-workbench-multi-object-goal.md` tracks active product milestones, and `docs/design-workbench-legacy-cull.md` is archived history plus Gate 0 row references only. Do not use old PR history as a next-task list. The next architecture cleanup is the `WorkbenchSolvedProjectArtifact` UI-consumption boundary.

Promoted to: `docs/design-workbench-architecture.md`

Related docs/tests: [docs/design-workbench-architecture.md](design-workbench-architecture.md), [docs/design-workbench-multi-object-goal.md](design-workbench-multi-object-goal.md), [docs/design-workbench-legacy-cull.md](design-workbench-legacy-cull.md), [apps/portal/lib/workbenchBreakawayImportGuards.test.ts](../apps/portal/lib/workbenchBreakawayImportGuards.test.ts).

### 2026-06-12 - Design Workbench - Project Artifact UI Boundary

Area: Design Workbench

Status: Active

Decision or mistake: the live workbench shell now consumes one `WorkbenchSolvedProjectArtifact` bundle for project-level Plan layers, 3D preview, drawing-surface geometry, snap sources, and diagnostics. Route clients should not rebuild or pass loose project geometry/status prop arrays.

Why it mattered: the breakaway removed calculator-era inputs, but loose render props still made it easy to create view-specific geometry truth. The bundled artifact makes the current UI contract match the north-star solved-geometry spine without changing solver behavior.

Current guardrail: `DrawingWorkbench` callers pass `projectArtifact`; `WorkbenchViewportHost` is the single allowed place to unpack it for existing lower-level viewport props. Loose-field aliases on `WorkbenchSolvedModel` were retired in the follow-up artifact alias slice and should not be reintroduced.

Promoted to: `docs/design-workbench-architecture.md`

Related docs/tests: [docs/design-workbench-architecture.md](design-workbench-architecture.md), [docs/design-workbench-multi-object-goal.md](design-workbench-multi-object-goal.md), [apps/portal/lib/drawings/state/workbenchSolvedModel.ts](../apps/portal/lib/drawings/state/workbenchSolvedModel.ts), [apps/portal/lib/workbenchBreakawayImportGuards.test.ts](../apps/portal/lib/workbenchBreakawayImportGuards.test.ts).

### 2026-06-12 - Design Workbench - Solved Model Alias Retirement

Area: Design Workbench

Status: Active

Decision or mistake: `WorkbenchSolvedModel` no longer exposes temporary loose project geometry/status aliases such as project preview, viewport geometry, plan projection, projection health, pergola render health, house geometry inputs, or project reference shapes. Those values are available only through `WorkbenchSolvedProjectArtifact`, whose construction now lives in a focused artifact owner.

Why it mattered: the artifact boundary was useful only if callers could not keep reading parallel loose fields. Removing the aliases prevents future work from recreating view-specific geometry truth or bypassing object-owned diagnostics.

Current guardrail: live workbench code should read solved project geometry, plan layers, snap sources, and render diagnostics from `projectArtifact`. The breakaway guard forbids direct `solvedModel.*` alias reads. Lower-level Plan/3D viewport prop names may remain until a separate internal naming cleanup.

Promoted to: `docs/design-workbench-architecture.md`

Related docs/tests: [docs/design-workbench-architecture.md](design-workbench-architecture.md), [apps/portal/lib/drawings/state/workbenchSolvedProjectArtifact.ts](../apps/portal/lib/drawings/state/workbenchSolvedProjectArtifact.ts), [apps/portal/lib/drawings/state/workbenchSolvedModel.ts](../apps/portal/lib/drawings/state/workbenchSolvedModel.ts), [apps/portal/lib/workbenchBreakawayImportGuards.test.ts](../apps/portal/lib/workbenchBreakawayImportGuards.test.ts).

### 2026-06-12 - Design Workbench - Pergola Artifacts Before Project Composition

Area: Design Workbench

Status: Active

Decision or mistake: project-level Plan/3D composition was still called with `pergolaArtifacts: []`, so solved pergola output could not reach `WorkbenchSolvedProjectArtifact` even when the project model contained pergolas.

Why it mattered: the multi-object workbench goal depends on every project object contributing an object-id-keyed solved artifact before Plan, 3D, snap, and diagnostics are composed. An empty artifact set silently turns pergolas into missing geometry rather than object-owned diagnostics.

Current guardrail: `buildWorkbenchSolvedModel` must build project house geometry first, then project pergola render artifacts, then pass the same pergola artifact list into `buildProjectObjectRenderPipeline` and project viewer scene composition. Package geometry owns pergola solving through a neutral solve boundary; portal workbench roots adapt object-first pergolas but must not reintroduce calculator/raw wrapper contracts.

Promoted to: `docs/design-workbench-architecture.md`

Related docs/tests: [docs/design-workbench-architecture.md](design-workbench-architecture.md), [apps/portal/lib/drawings/state/workbenchSolvedModel.ts](../apps/portal/lib/drawings/state/workbenchSolvedModel.ts), [apps/portal/lib/drawings/state/projectPergolaRenderArtifacts.ts](../apps/portal/lib/drawings/state/projectPergolaRenderArtifacts.ts), [packages/geometry/src/solvePergolaGeometry.ts](../packages/geometry/src/solvePergolaGeometry.ts), [apps/portal/lib/workbenchBreakawayImportGuards.test.ts](../apps/portal/lib/workbenchBreakawayImportGuards.test.ts).

### 2026-06-16 - Portal Lists - Explicit Fetch Ceiling Plus Visibility Banner

Area: Portal List Pages

Status: Active

Decision or mistake: every staff list fetch (`contacts`, `projects`, `design_package_requests`, the running-jobs top-level `projects`, and the schedule legacy fallback's `estimates`) was relying on PostgREST's silent 1000-row default. The 1001st row was dropped on the floor with no UI signal, so staff at any growing org would silently lose data without knowing it. PR-PG1 closes that by setting an explicit ceiling at every list-fetch boundary and surfacing a `ListCountBanner` on the contacts and projects pages when the row count crosses 80% of the ceiling.

Why it mattered: the silent default was the same shape as the appendage and elevation-mode bugs we keep refactoring out (PR-T8 / PR-T9) — implicit upstream behaviour acting as a meaningful constraint. The fix has to make the constraint explicit AND visible, not just lift it higher.

Current guardrail:
- Top-level list selects (no `.eq()` / `.in()` / `.single()` filter) MUST set `.range(0, MAX_LIST_FETCH_ROWS - 1)` and either `count: 'exact'` (when the count needs to feed a banner) or no count opt. Lives at [`apps/portal/lib/list/listLimits.ts`](../apps/portal/lib/list/listLimits.ts).
- Hitting the warning is the signal to graduate that list to cursor pagination (PR-PG2 / PR-PG3 in the [list-pagination plan](list-pagination-plan.md)) — a higher cap would just hide the next problem the same way the silent PostgREST default did.
- For the banner UX: site-wide `ToastProvider` policy ([`ToastProvider.tsx:56-57`](../apps/portal/components/ui/toast/ToastProvider.tsx#L56-L57)) silently suppresses non-error toasts. The PR-PG1 banner uses an inline `ListCountBanner` instead — that's the right surface anyway (truncation is a STATE, not an EVENT), but worth flagging that the "toast" instinct fails here.

Behavioural impact: zero at current scale (the highest-count list in the live data is well below 4000). The change is preparation, not a bug fix.

Promoted to: None

Related docs/tests: [docs/list-pagination-plan.md](list-pagination-plan.md), [docs/pr-pg1-plan.md](pr-pg1-plan.md), [apps/portal/lib/list/listLimits.ts](../apps/portal/lib/list/listLimits.ts), [apps/portal/components/ui/listBanner/ListCountBanner.tsx](../apps/portal/components/ui/listBanner/ListCountBanner.tsx), [apps/portal/lib/contacts/serverContactsIndex.ts](../apps/portal/lib/contacts/serverContactsIndex.ts), [apps/portal/lib/projects/serverProjectsIndex.ts](../apps/portal/lib/projects/serverProjectsIndex.ts).
