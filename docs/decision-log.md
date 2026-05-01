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

Use `Status: Active` when the entry is still only a decision-log guardrail. Use `Status: Promoted` when the durable behavior is now represented in `docs/agent-playbook.md`, `AGENTS.md`, `docs/README.md`, or another canonical doc. Use `Status: Superseded` only when a newer entry or canonical doc replaces the rule.

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
| 2026-05-01 | Deck Interaction | Promoted | Projection-backed deck snapping must use top-projection frames live and object frames only at the commit boundary. |
| 2026-05-01 | Plan Detail | Promoted | Geometry-ready plan detail and deck snap edges must come from scene-backed projected wall segments, not legacy footprint overlays or roof outlines. |
| 2026-05-01 | Deck Interaction | Promoted | Floating deck releases are valid projection placements and must not be failed by snapped-settle geometry checks. |
| 2026-05-01 | Deck Interaction | Promoted | Projection-backed deck drag sessions must use committed top-projection polygons for live drag math, not SVG-projected or legacy overlay objects. |
| 2026-05-01 | Quotes/Invoices/Job Packs | Promoted | High-risk side-effect workflows need a canonical doc before future behavior changes. |
| 2026-05-01 | Docs | Promoted | Read the agent playbook for non-trivial portal work; promote durable lessons from this log into the playbook. |
| 2026-05-01 | Docs | Promoted | Do not delete active guardrail docs without confirming usage or replacing the rule. |
| 2026-05-01 | Docs | Promoted | Distinguish current-state references from active operating rules. |

## Entries

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
