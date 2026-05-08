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
| 2026-05-01 | Quotes/Invoices/Job Packs | Promoted | High-risk side-effect workflows need a canonical doc before future behavior changes. |
| 2026-05-01 | Docs | Promoted | Read the agent playbook for non-trivial portal work; promote durable lessons from this log into the playbook. |
| 2026-05-01 | Docs | Promoted | Do not delete active guardrail docs without confirming usage or replacing the rule. |
| 2026-05-01 | Docs | Promoted | Distinguish current-state references from active operating rules. |
| 2026-05-06 | Decomposition / Refactor Hygiene | Active | Extracting helpers during a decomposition refactor must be byte-for-byte; rewriting "while I'm there" introduces subtle behavioural drift that escapes typecheck. |
| 2026-05-08 | PlanViewport / Pointer Events | Active | Pointer-driven tools require `touch-action: none`, `setPointerCapture` on primary-button down, `pointerCancel` -> `cancelActiveTool` (not `pointerUp`), and a pure dispatch helper that NEVER invents coords on null. |
| 2026-05-08 | Debugging Hygiene | Active | When live-runtime symptoms don't match any of the current hypotheses, instrument the boundary with logs before iterating fixes; root-cause from real data, not theory chains. |
| 2026-05-08 | House Roof Topology | Active | "Click hip triangle to open as gable" needs a Dutch-hip / half-hip topology in the geometry pipeline -- hipped + `openGableEndIds` is currently a no-op (gated to gable form). Multi-session work: rectangle Dutch-hip first, joined Dutch-hip second, UI third. |

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

Current guardrail: the migration is multi-session work. Sequence:

1. **Session A (rectangle Dutch-hip):** extend `buildRectangleHippedRoof` ([packages/geometry/src/house/roofRectangleHipped.ts](../packages/geometry/src/house/roofRectangleHipped.ts)) to accept open-ridge-end information. Topology rules:
   - Ridge axis = X (widthX >= widthY): terminal ends are at min-x and max-x. Each open end skips the corresponding `house-roof-{min,max}-x` plane, extends the ridge endpoint to the end face, and adjusts the `house-roof-{min,max}-y` plane corners. Skip the 2 hip features at that end's corners.
   - Ridge axis = Y (widthY > widthX): mirror with X/Y swapped.
   - Ridge axis = pyramid (square-ish): no terminal ends to open; ignore.
   - Both ends open: equivalent to existing `gable` form; useful for the migration step (retire `gable` form).
   - Plumb `openTerminalEndIds` through `buildHippedHouseRoof` -> `buildPrimaryHouseRoof` -> `buildSharedHouseRoof`.
   - Tests: 0/1/2 ends open round-trip; QA still passes; matches `gable` form output when both open.

2. **Session B (joined / L-shape Dutch-hip):** same treatment for `roofJoinedHipped.ts`. More terminal ends per project (each wing has its own ridge); each independently open-able. More test combinations.

3. **Session C (UI plumbing):**
   - Migrate at load: `roofForm: 'gable'` -> `roofForm: 'hipped'` + `openGableEndIds: [<all terminal ids>]` (visually identical post-session-B).
   - Remove `'gable'` from `HOUSE_ROOF_FORM_ORDER` (keep type union for back-compat storage).
   - Inspector: lift the `roofForm === 'gable'` gate in `HouseFormRoofSections.tsx:165` so terminal-end toggles show for hipped form too.
   - Plan-view click target: emit terminal-end triangles as new top-projection shapes (`kind: 'house_terminal_end'`); on click, toggle id in `openGableEndIds` via `commitSharedHouseFormRoof` action.
   - Hover affordance: cursor + light halo on hover.

4. **Slice 2 follow-up (after slice 1 ships):** smart pergola-attachment prompt -- when a hip end is opened on a wall a pergola is attached to (or when a pergola is dragged onto an open-gable wall), prompt "convert pergola to gable form to match house gable height + pitch?" Auto-copies gable parameters.

Terminal-end ID format: `house-gable-end-x-{N}` or `house-gable-end-y-{N}` (`packages/geometry/src/house/roofJoinedGableTerminals.ts:67`). The `sourceEdgeId` field on each terminal end maps it to a footprint edge index.

Promoted to: None

Related docs/tests: `packages/geometry/src/houseModel.ts` (gating at line 428), `packages/geometry/src/house/roofRectangleHipped.ts`, `packages/geometry/src/house/roofJoinedHipped.ts`, `packages/geometry/src/house/roofPrimary.ts`, `packages/geometry/src/house/roofJoinedGableTerminals.ts`, `apps/portal/components/drawings/rail/HouseFormRoofSections.tsx:165`, `apps/portal/lib/drawings/state/objectWorkbenchStatusModel.ts:336`.
