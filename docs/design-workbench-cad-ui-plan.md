# Design Workbench — CAD-style UI Plan

**Status**: drafted 2026-05-23. Historical source mockup path: `public/images/sanctuary_pergola_workbench.png`. That file is not present in the repository as of 2026-07-28; owner validation is required before restoring it or naming a replacement. Originated from a Codex-ready handoff (full text in `docs/decision-log.md` if archived later).

**Goal**: get the Design Workbench to match the CAD-style mockup. 9 PRs, ordered low-risk → high-risk. Each PR is independently shippable; the workbench is usable after every one (degraded UX is acceptable per Phase 1 acceptance).

**Alignment with north star** (see `docs/design-workbench-architecture.md` § "Product North Star"): this entire plan is UI/presentation. It does not modify the data model, the solved geometry artifact, or the cost engine. It honors the load-bearing decisions: 3D is read-only · Plan is the editor · object-first model · snap-derived attachments. Gumball is plan-only.

## Read First

- Treat this as the CAD-style UI planning spine, not a current-state contract.
- Check shipped markers before assuming a PR section is still pending.
- Current workbench architecture still lives in `docs/design-workbench-architecture.md`.

## Architectural guardrails baked in

1. **Viewport filtering goes through `lib/drawings/views/plan/planRenderGraph.ts`** — not new render conditionals inside SVG components. Filter is a layer-pass decision at the render-graph boundary.
2. **Gumball commits go through existing `lib/drawings/commits/` modules + the Command bus** — typed input ("+750mm") and drag-release both end at the same `commit*Transform()`. Undo/redo + snap come for free.
3. **Gumball state machine lives as a controller in `lib/drawings/interactions/`** — same pattern as `objectInteractionEngine`. Component is a thin renderer; state machine is testable in isolation.

---

## Phase A — presentation cleanup (PRs W1–W4)

Low-risk visual rearrangement. No render-graph or commit-bus changes.

### PR-W1: Header cleanup

**Goal**: top bar shows project name + mode switch + back + overflow. Remove the "Saved locally · Geometry ready" status text.

**Files**:
- `apps/portal/components/drawings/workbench/WorkbenchChrome.tsx` — primary
- First task: `grep -r "Saved locally" apps/portal` (Explore agent didn't find it — may already be removed)
- `apps/portal/app/staff/projects/[projectId]/design-workbench/DesignWorkbenchEstimateClient.tsx` — likely owns the status surface

**HARD GATE**: N/A (net new UI cleanup) · REMOVE legacy (top-right status text) · no Phase 2 deps · no consolidation.

**Acceptance**: header reads `Exan - Tuakau / Design Workbench  [3D Review][Plan Editor][Sheet Output]  [Back Project][...]`. Geometry-ready status moves to right inspector pill + bottom status bar.

**Risk**: low. **Size**: small (~50 LOC).

---

### PR-W2: Remove in-canvas chrome

**Goal**: strip the floating vertical toolbar (if it exists) and the bottom-right canvas caption.

**Files**:
- `apps/portal/components/drawings/viewports/PlanViewport/PlanViewport.tsx`
- `apps/portal/components/drawings/viewports/PlanViewport/canvas/PlanCanvas.tsx`
- First task: `grep -r "Viewport shows" apps/portal` and `grep -r "CAD-style" apps/portal` to locate

**HARD GATE**: N/A · REMOVE legacy · no Phase 2 deps · no consolidation.

**Acceptance**: PlanCanvas has zoom/pan controls bottom-left, Pan/Measure buttons bottom-centre, and no other floating chrome.

**Risk**: low. **Size**: small.

---

### PR-W3: Left rail = visibility + object tree only (no inputs)

**Goal**: restructure left rail into two sections — VISIBILITY toggles and a FLAT OBJECTS TREE. Remove ALL input fields. Tree lists every object under its family heading, all simultaneously visible.

**Split into 4 sub-PRs** to keep blast radius small and each step independently verifiable.

#### PR-W3a — extract shared field/section primitives ✅ SHIPPED

Decomposed `SanctuaryWorkbenchRail.tsx` (1337 → 1193 LOC) by extracting `SelectField`, `NumberField`, `ToggleField`, `RailSection`, `renderRailField`, `withCurrentOption` into `apps/portal/components/drawings/rail/fields/`. Pure refactor, no behaviour change.

#### PR-W3b — scaffold right-inspector slot ✅ SHIPPED

Added a third grid column to `DesignWorkbenchEstimateClient.module.css` (left rail · workspace · right inspector). New `<RightInspectorPanel>` empty placeholder under `apps/portal/components/drawings/inspector/`. Mounted in both Estimate + Fixture clients.

#### PR-W3c — move inspector content to right panel ✅ SHIPPED

New `WorkbenchInspectorHost.tsx` (sibling to `ObjectWorkbenchRailHost`) selects + renders inspector content for the active rail tab. Mounts inside `RightInspectorPanel` via children. `ObjectWorkbenchRail.tsx` slimmed: inspector panel rendering removed (~150 LOC stripped), rail now renders Visibility · Object Navigator (tabbed) · Selected Object summary only. 5 ObjectWorkbenchRail tests skipped with TODOs pointing at the new home (follow-up: create `WorkbenchInspectorHost.test.tsx`).

#### PR-W3d — flat OBJECTS TREE, delete Object Navigator tabs

**Goal**: make the left rail match the mockup's CAD-style flat outliner — every family always visible, each object as its own row with subtitle and selection signal.

**What changes** (target shape per the mockup):

```
VISIBILITY
  House          [Shown]
  Pergolas       [Shown]
  Decks          [Hidden in viewport]
  Openings       [Shown]

OBJECTS
  House Forms
    House Form 1     Gable roof · hidden in viewport
  Pergolas
    Pergola 1        Mono · acrylic · selected
  Decks
    Deck 1           Timber · hidden in viewport
    Deck 2           Future deck · hidden
  Openings
    No openings      Add from inspector
```

**Required moves**:

1. **Delete the Object Navigator tab strip entirely.** Not "collapse" — physically remove the `<button role="tab">` cluster that switches between House Forms / Decks / Openings / Pergolas / Diagnostics. The flat tree replaces it.

2. **Render a flat tree where every family is a section header with its own object rows always visible.** Section header is the family label (`House Forms`, `Pergolas`, `Decks`, `Openings`); each child row is one object. Order is fixed (matches the mockup).

3. **Each object row exposes**: icon (small family glyph) · label · subtitle. Subtitle is family-specific status derived from existing store data:
   - Pergola: `{style} · {roofMaterial} · {selected ? 'selected' : visibility/trust hint}`
   - House form: `{roofForm} · {visibility/trust hint}`
   - Deck: `{material} · {visibility/trust hint}`
   - Opening: `{kind} · {wall location hint}`

   Subtitles derive from `derived.objectWorkbench.*` shapes that already exist; no new store fields needed in this PR.

4. **Selection signal is the highlighted tree row.** Clicking a row sets `ui.activeObjectRef` (existing mechanism). The selected row gets the primary-button styling that the current Object Navigator tab uses. Right inspector header continues to show the trust pill (already wired in PR-W3c) — that's the detail surface.

5. **Remove the standalone "Selected Object" summary section.** The summary currently sits below the family list (rail line ~167-190); it duplicates information now carried by the row highlight in the tree + the header pill in the right inspector. Delete it.

6. **Add-affordance policy**: inline `+` button at the end of each family section. Disabled when the family can't add via this surface. Single source of truth: `objectWorkbenchActions.addSharedHouse{Form,Deck,Opening}` and `addSharedPergola`.

7. **Empty-family copy**: standardised "No <family>" + faint helper hint underneath. Match the mockup's "No openings — Add from inspector" style.

**Diagnostics tab — locked decision**: removed from the rail entirely (option a). Diagnostics is debug content and doesn't belong in the primary object navigator. Future access via the top bar's `…` overflow menu (the placeholder button added in PR-W1); wiring real menu items into it is a separate follow-up not blocking W3d. Until the overflow menu lands, Diagnostics has no UI entry point — acceptable per Phase 1 "workbench UI can break temporarily" and the user is the only daily workbench user.

**Files**:
- [ObjectWorkbenchRail.tsx](apps/portal/components/drawings/rail/ObjectWorkbenchRail.tsx) — major rewrite: delete Object Navigator tab strip, delete Selected Object summary section, replace family-list-for-active-tab with flat tree of all four families. Currently ~150 LOC; after this PR likely ~200 LOC (more tree rows, but no tab strip).
- New `<ObjectTreeSection>` component per family — encapsulates header + row list + add affordance. Small (~80 LOC). Lives under `apps/portal/components/drawings/rail/`.
- New `<ObjectTreeRow>` component — single row with icon · label · subtitle. Small (~50 LOC).
- [WorkbenchInspectorHost.tsx](apps/portal/app/staff/projects/[projectId]/design-workbench/WorkbenchInspectorHost.tsx) — inspector family derives from `ui.activeObjectRef.family` rather than the now-deleted rail tab. Small wiring update.
- [drawingWorkbenchUiState.ts](apps/portal/lib/drawings/state/drawingWorkbenchUiState.ts) — `activeRailTab` is retired from live UI state and stripped as opaque legacy input. Current selection resolves from `activeObjectRef`, not the old rail-tab vocabulary.
- ObjectWorkbenchRail.test.tsx — strip tab-strip assertions; add tree-shape assertions (every family heading present, object rows visible, selected row highlighted).
- New `objectTreeRowSubtitles.ts` helper (or extension of existing inspector model) — pure functions that map per-family objects to subtitle strings. Testable in isolation.

**HARD GATE**:
- Audit row: N/A (net new UI structure)
- REMOVE legacy (Object Navigator tab strip; Selected Object summary section; per-family "show only this family" behaviour)
- No Phase 2 deps
- Consolidation: 5 sources of "active object info" (tab → list → summary → inspector → row state) collapse to 2 (tree row + right inspector). Document which existing fields die.

**Acceptance**:
- Left rail shows VISIBILITY block + flat OBJECTS TREE; no tabs, no summary
- All four family sections render simultaneously regardless of selection
- Each row shows label + subtitle; selected row has primary-button styling
- Clicking a row updates `ui.activeObjectRef` and the right inspector content
- Empty-family sections show standardised "No <family>" + hint
- Add affordances inline per family (or absent where not applicable)
- Diagnostics no longer in rail
- Tree-shape tests cover all 4 families + empty states + selection

**Risk**: medium-high. Restructures a fundamental UI surface and changes the click-through model (no more tab indirection). Behavior change is large but contained to one component.

**Size**: medium (~300 LOC of net change: ~150 LOC removed from existing rail + ~250 LOC added for tree components and tests).

---

### PR-W4: Right inspector = input owner

**Goal**: paired with W3. The inspector components mount in a new right-side panel. Compact inline rows (`Label  [value/dropdown]`), grouped Primary / Connections / Member Sizes / Advanced.

**Files**:
- New `RightInspectorPanel.tsx` under `apps/portal/components/drawings/inspector/` (or similar new directory)
- Hosts the existing inspector components, routing by `derived.activePergola`/`activeHouseForm`/`activeObjectFirstDeck`/`activeObjectFirstOpening`
- Compact row primitives: `<InspectorRow label="Pergola type" value={...}>`, `<InspectorSection title="PRIMARY" collapsible>`
- Each existing inspector gets a "compact row" rendering mode — likely a refactor of layout, not behavior

**HARD GATE**: N/A · BUILD-ON (existing inspectors retained, repackaged) — fine, they're not legacy · no Phase 2 deps · no consolidation.

**Acceptance**:
- Right side shows selected object's inputs
- Grouped sections collapse/expand with state preserved per object family
- Inline rows ~32px tall, no oversized form fields
- Inspector pill top: object name + trust status (`Pergola 1 / Geometry ready`)

**Risk**: medium. **Size**: large (~500 LOC).

---

## Phase B — render graph extensions (PRs W5–W7)

Guardrail #1 territory.

### PR-W5: ~~Viewport filter via plan render graph~~ **SCRAPPED 2026-05-26**

Reason: the existing per-family visibility toggles (House / Pergolas / Decks / Openings on the left rail) already give the user enough control over what the canvas shows. A dedicated "pergola only" mode would duplicate that surface and add a second source of truth for what's visible. The mockup's "Pergola only" pill is interpreted as an aesthetic decoration only; not implementing it.

### PR-W6: ~~Double-line rafter rendering~~ **SCRAPPED 2026-05-26**

Reason: pergolas already render with double-line rafters in the current plan view (the user confirmed visually). No work needed.

### PR-W7: Selection visual treatment

**Goal**: selected pergola reads as "outlined + measured", not "highlighted color block".

**Files**:
- `apps/portal/lib/drawings/views/plan/planRenderGraph.ts` — adjust `selectionOutlines` styling
- Theme tokens for selection treatment
- `committedBodies`: drop or reduce fill for selected object

**HARD GATE**: N/A · REMOVE legacy (heavy fills) · no Phase 2 deps · no consolidation.

**Risk**: low. **Size**: small.

---

## Phase B′ — visual polish to match mockup (PRs W8–W11)

Added 2026-05-26. After PR-W3d shipped the rail and PR-Bug1–4 closed correctness gaps, the user reviewed the result against `public/images/sanctuary_pergola_workbench.png` and asked for several pixel-level pieces still missing. These are pure presentation work — no render-graph or commit-bus changes.

### PR-W8: Visibility section completeness

**Goal**: left rail VISIBILITY section matches the mockup's 6 toggles (House, Pergolas, Decks, Openings, **Dimensions**, **Snap guides**). Row labels read "Hidden in viewport" / "Shown" with subtle status colour.

**Files**:
- `apps/portal/lib/drawings/state/drawingWorkbenchUiState.ts` — extend `DrawingWorkbenchVisibilityState` with `dimensions: boolean` and `snapGuides: boolean`
- `apps/portal/components/drawings/rail/ObjectWorkbenchRail.tsx` — render two extra toggles, update label copy
- `WorkbenchRail.module.css` — tighten row style + status colour
- Consumers of the visibility state (PlanCanvas dimension layer, snap indicator layer) read the new flags

**HARD GATE**: N/A · additive · no Phase 2 deps · no consolidation.

**Risk**: low. **Size**: small (~80 LOC + tests).

### PR-W9: Canvas chrome — bottom toolbar + corner pills

**Goal**: canvas bottom-centre toolbar `- 78% + Pan Measure` and a small `Plan Editor` pill in the top-left of the canvas area. (The mockup also shows a `Pergola-only view` pill in the top-right — skipped because PR-W5 is scrapped.)

**Files**:
- `apps/portal/components/drawings/viewports/PlanViewport/canvas/PlanCanvas.tsx` — relocate toolbar, render pills
- `PlanCanvas.module.css` — toolbar layout + pill styling
- Hook into the PlanViewport pan/zoom transform helpers for the zoom buttons.

**HARD GATE**: N/A · purely presentation · no Phase 2 deps · no consolidation.

**Risk**: low. **Size**: small (~120 LOC).

### PR-W10: Bottom status bar

**Goal**: thin bar pinned to the bottom of the workbench shell. Left: green-dot status pill + descriptor (e.g. "Plan editor / Object tree includes house/decks · selected pergola drawn with double-line rafters"). Right: scale + coordinate-frame indicator (`Scale 1:100 · World XY`).

**Files**:
- `apps/portal/components/drawings/workbench/WorkbenchChrome.tsx` OR a new `WorkbenchStatusBar.tsx` (TBD during impl — likely new file so chrome stays a top-bar)
- `DrawingWorkbench.tsx` — slot the status bar into the layout
- `DrawingWorkbench.module.css` — flex layout adjustment to reserve bottom row

**HARD GATE**: N/A · additive · no Phase 2 deps · no consolidation.

**Risk**: low. **Size**: small (~150 LOC).

### PR-W11: Top chrome "ready" pill

**Goal**: status indicator (green dot + "ready") between the mode tabs and the Back-Project link in the top chrome. Reads `WorkbenchTrustStatus`.

**Files**:
- `apps/portal/components/drawings/workbench/WorkbenchChrome.tsx`
- May need to thread `trustGate` from `DrawingWorkbench` (already available on the store)

**HARD GATE**: N/A · additive · no Phase 2 deps · no consolidation.

**Risk**: low. **Size**: small (~60 LOC).

---

## Phase C — gumball (PRs G1–G3)

Guardrails #2 and #3 territory.

### PR-G1: Gumball controller

**Goal**: pure controller for the gumball state machine. No React, no DOM. Events → state → derived view model.

**Architectural shape**:
- New: `apps/portal/lib/drawings/interactions/gumballToolController.ts`
- State: `idle | hovered | dragging | typing | committing | cancelled`
- Events: `selectObject(ref)`, `hoverAxis(axis)`, `startAxisDrag(axis, startPoint)`, `dragMove(currentPoint)`, `endDrag()`, `startTypedInput(axis)`, `typeValue(string)`, `commitTypedInput()`, `cancel()`
- Output: `GumballViewModel { activeAxis, dragDelta, typedInput, anchor, ... }`
- Pattern reference: `objectInteractionEngine.ts`

**Files**:
- `gumballToolController.ts` (new)
- `gumballToolController.test.ts` (new) — all state transitions, no React

**Acceptance**:
- All transitions covered by unit tests
- Typed move never produces ghost
- Drag move produces drag-preview events
- Esc cancels from any non-idle state
- Controller is pure — no DOM, no React, no command bus calls (PR-G3 wires commits)

**Risk**: low. **Size**: medium (~200 LOC + ~200 LOC tests).

---

### PR-G2: Gumball widget (renderer)

**Goal**: Plan-only React component. X/Y arrows + rotation arc anchored at selected object's visual centre.

**Architectural shape**:
- Visual centre = `position + (outline bbox centre - origin)` at render time. **Not stored.** Likely lives on the plan view model.
- Component: `<GumballOverlay />` under `apps/portal/components/drawings/viewports/PlanViewport/overlays/`
- Mounted by PlanViewport when selection has gumball-eligible family (pergolas, decks, house forms — NOT openings)
- Visual states from controller view model:
  - Idle: X olive, Y muted blue-grey, rotation arc faint bronze (equal arm lengths)
  - Hover: highlighted axis pops weight
  - Active drag: faint dashed original + live preview at cursor (drag preview via existing `dragPreview` layer)
  - Active typed: input pill attached to active axis handle; original stays in place; bottom status reads "Type +750mm then Enter to apply · Esc cancels"

**Files**:
- `GumballOverlay.tsx` + `gumballOverlay.test.tsx`
- `useGumballController()` hook bridging controller events to DOM events
- Plan view model: add `gumballAnchor` derivation
- `PlanViewport.tsx` mounts the overlay

**Acceptance**:
- Selecting a pergola renders the gumball at its visual centre
- Hovering an axis highlights it
- Drag X/Y handle creates a ghost preview (via existing `dragPreview` layer)
- Click X/Y handle (no drag) shows typed input pill
- Esc cancels in either mode
- Openings show no gumball

**Risk**: medium. **Size**: medium-large (~400 LOC + tests).

---

### PR-G3: Gumball commits via command bus

**Goal**: typed and drag commits route through existing `lib/drawings/commits/` + Command bus. Add missing `commitHouseFormTransform`.

**Files**:
- `apps/portal/lib/drawings/commits/commitPergolaTransform.ts` — verify the existing API accepts a world-XY delta
- `apps/portal/lib/drawings/commits/commitDeckTransform.ts` — same
- New `commits/commitHouseFormTransform.ts` + tests (pattern after `commitDeckTransform.test.ts`)
- Wire gumball controller's commit events to the appropriate `commit*Transform()` via `apps/portal/lib/drawings/commands/commandBus.ts`

**HARD GATE**:
- Audit row: N/A
- BUILD-ON existing commit infrastructure — fine
- No Phase 2 deps
- Consolidation: none — per-family commit math differs

**Acceptance**:
- Typed gumball move → `commit*Transform` → project model updated → solve rebuilds → plan re-renders
- Drag gumball move → same final state, with drag-preview shown during gesture
- Undo/redo works (Command bus gives this for free if commits return reversible commands)
- Snap engine fires on drag (existing snap infrastructure consumes drag-preview deltas)

**Risk**: medium. **Size**: medium (~300 LOC + tests).

---

## Sequencing

```
W1 (header) ─┐
W2 (chrome) ─┼─ pure removals, ship in any order
             │
W3 (rail split) ──→ W4 (right inspector)  — pair: W3 alone leaves the workbench unusable
             │
W5 (viewport filter) — depends on W3 for the filter UI control surface
             │
W7 (selection treatment) — independent
W6 (double-line rafters) — independent of W5; do W7 first so fills don't mask
             │
G1 (gumball controller) — independent of W5/W6/W7
G2 (gumball widget) — depends on G1
G3 (gumball commits) — depends on G2
```

Suggested order: **W1, W2, W3+W4 (paired), W5, W7, W6, G1, G2, G3**.

## Estimates

| PR | LOC | Risk | Days |
|---|---|---|---|
| W1 | ~50 | low | 0.25 |
| W2 | ~80 | low | 0.25 |
| W3 + W4 | ~900 | medium | 2–3 |
| W5 | ~250 | medium | 1 |
| W6 | ~350 | medium-high | 1.5 |
| W7 | ~80 | low | 0.5 |
| G1 | ~400 (with tests) | low | 1 |
| G2 | ~400 | medium | 1.5 |
| G3 | ~300 | medium | 1 |
| **Total** | **~2800** | — | **~9 days** |

## Phase 1 acceptance check

Every PR touches ONLY `apps/portal/components/drawings/` + `apps/portal/lib/drawings/`. None touch:
- `@sp/costing/calculateCostV1`
- `CostInputsV1`
- `EnquiryPayload`
- The form contract at `apps/marketing/app/contact/page.tsx`

Marketing email path is structurally protected. Quick-check after each PR:
```
npx vitest run apps/marketing/lib/enquiryBudgets.test.ts apps/marketing/emails/templates/customerEstimateEmail.test.tsx
```

## Relationship to in-flight Phase 2 work

PR-2B.1b.3 (migrate 8 consumer files off `activeModuleIndex` → `activePergolaId`) and PR-2B.1b.4 (delete legacy `WorkbenchSolvedModule[]`) are **deferred**. They don't block any work in this plan. As gumball-driven UX matures and consumer files get touched for inspector/gumball reasons, they'll naturally migrate to the per-object spine. The two shapes (`solvedModel.modules` + `solvedProject.pergolas`) coexist safely.
