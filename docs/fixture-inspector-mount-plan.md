# Fixture Inspector Mount — Plan (PR-T5)

**Drafted**: 2026-05-26. **Status**: shipped; retained as a retrospective plan.

This plan records the fixture-inspector mount that now supports the workbench visual snapshot loop. For the current operating instructions, use `docs/workbench-visual-snapshot-loop.md`.

---

## Read First

- Treat this as history for PR-T5, not as an active proposal.
- Current snapshot-loop behavior lives in `docs/workbench-visual-snapshot-loop.md`.
- Do not re-execute the CTA-style sections below; use them only to understand why the fixture mirrors production inspector code.

## 1. Goal

Mount `WorkbenchInspectorHost` inside `DesignWorkbenchFixtureClient` so visual snapshots taken via `/qa/design-workbench-fixture?fixture=<slug>` render the real inspector content (PRIMARY / CONNECTIONS / MEMBER SIZES / ADVANCED) for whatever family is selected — not just the empty "No selection" placeholder.

---

## 2. Architectural fit

### Which north-star invariant or principle does this serve?

`docs/maintainability-principles.md` § "snapshots must reflect reality". The whole point of the fixture route's existence (per its `data-workbench-context="fixture_ready"` marker) is to mount a real workbench shell with deterministic data for QA + visual iteration. Currently the fixture stops short — it mounts the rail and chrome but not the inspector body. PR-T5 finishes the job.

A second principle this serves: the snapshot dev loop I just built (PR-T4-snapshot) is *only* valuable if the rendered output matches what users see. Bypassing `WorkbenchInspectorHost` and mounting per-family inspectors directly (Option B from the prior discussion) would create a fixture render path that diverges from production — exactly the kind of "fixture lies" problem that erodes trust in test snapshots over time.

### What alternatives were considered, and why rejected?

1. **Option B — direct mount of `PergolaInspector` (and similar per-family inspectors) with stub handlers.** Rejected: forces me to re-implement family-dispatch in fixture code (the same `if (activeFamily === 'pergolas') ... else if ('decks') ...` logic `WorkbenchInspectorHost` already owns). Fixture drift risk: when the host adds a new prop, wrapper element, or context provider, the direct mount silently goes stale. Type system doesn't catch it.
2. **Option C — no fixture coverage; iterate blind from mockups.** Rejected: that's what produced the T4 over-flatten followed by T4-revision under-pill — two wasted iterations. The blind-iteration tax exceeds the cost of a one-time fixture extension.
3. **Use the real `/staff/projects/[id]/design-workbench` route with auth bypass.** Rejected: requires either a Supabase fixture backend or an auth-state file that points at a real project with seed data. Heavier setup, more brittle (storage state expires), and the fixture route already exists for exactly this use case.

### What does this consciously NOT try to do?

- **NOT make the inspector editable in fixture mode.** All commit handlers are no-ops returning `{ ok: true }`. Edits update local UI state at most; nothing persists. The fixture stays read-only in behaviour even though it renders the editable UI.
- **NOT cover every family snapshot in this PR.** Spec extension to take family-specific snapshots (pergola-selected, deck-selected, house-form-selected, opening-selected) is a follow-up. PR-T5 just unlocks the capability.
- **NOT touch the real `DesignWorkbenchEstimateClient` or the action hooks themselves.** This is fixture-only code. The production path is unchanged.
- **NOT use the real `useObjectWorkbenchActions` / `useObjectWorkbenchSelection` hooks with stub data.** The hooks expect a real `EstimateDetail` with DB-backed fields; fabricating that is more code than just writing the stub-action objects. Stub objects also make the no-op behaviour obvious at the call site.

### Net tech debt: pay down or add?

**Net add, justified.** Adds ~30-50 LOC of fixture-only stub code. The justification: the snapshot dev loop's value compounds with every visual iteration. Even one avoided "ship wrong, screenshot, fix" cycle pays for the stub setup. TypeScript also turns the stubs into a forced-update alarm — every time production adds a new action function, the stub object becomes invalid and the fixture refuses to compile until updated. That's not debt, that's a maintenance signal.

---

## 3. The new model

### Stub action objects

Two objects matching the existing types `ObjectWorkbenchSelectionActions` and `ObjectWorkbenchActions` (both inferred via `ReturnType<typeof useObjectWorkbench*>`).

```ts
// apps/portal/app/staff/projects/[projectId]/design-workbench/fixtureWorkbenchActionStubs.ts

import type { ObjectWorkbenchSelectionActions } from './useObjectWorkbenchSelection';
import type { ObjectWorkbenchActions } from './useObjectWorkbenchActions';

const ok = async () => ({ ok: true as const });

export function buildFixtureSelectionActions(
  setUi: Dispatch<SetStateAction<DrawingWorkbenchUiState>>,
): ObjectWorkbenchSelectionActions {
  return {
    selectHouseFormsWorkbenchMode: () => setUi(/* state-only */),
    selectPergolaWorkbenchMode: () => setUi(/* state-only */),
    selectRailTab: (tab) => setUi(/* state-only */),
    selectObjectRef: (ref) => setUi((current) => ({ ...current, activeObjectRef: ref })),
    startDrawOutlineEditor: ok,
    startDeckOutlineEditor: ok,
    selectDeckObject: () => setUi(/* state-only */),
    selectOpeningObject: () => setUi(/* state-only */),
    selectObjectWorkbenchTarget: () => setUi(/* state-only */),
    selectPergolaObject: () => setUi(/* state-only */),
    clearActiveWorkbenchSelection: () => setUi(/* state-only */),
  };
}

export function buildFixtureWorkbenchActions(): ObjectWorkbenchActions {
  return {
    addSharedHouseDeck: ok,
    addSharedHouseForm: ok,
    addSharedHouseOpening: ok,
    commitHouseFormTransformDelta: ok,
    commitDrawingField: ok,
    commitDeckDimension: ok,
    commitGeometryIntent: ok,
    commitHouseFormFootprintDimension: ok,
    commitOpeningDimension: ok,
    commitSharedPergolaAttachment: ok,
    commitSharedPergolaEdgeDragResult: ok,
    commitSharedDeckCustomPolygon: ok,
    commitSharedHouseDeckPatch: ok,
    commitSharedHouseFootprintEdit: ok,
    commitSharedHouseOpeningPatch: ok,
    commitSharedHouseRoofDraft: ok,
    removeSharedHouseDeck: ok,
    removeSharedHouseForm: ok,
    removeSharedHouseOpening: ok,
    // Compile error here if production adds a new function — that's intended.
  };
}
```

### Fixture client mount

```tsx
// In DesignWorkbenchFixtureClient.tsx, replace the read-only inspector
// shell with the real host wrapped in stub actions.

<aside className={styles.inspectorColumn}>
  <div className={styles.inspectorScroll}>
    <RightInspectorPanel
      selectionLabel={store.derived.railModel.selectedInspector.selectedObjectLabel}
      trustStatusLabel={store.derived.railModel.selectedInspector.selectedObjectTrustLabel}
    >
      <WorkbenchInspectorHost
        activeModuleInput={activeModuleInput}
        geometryEditState={null}
        isLocked
        objectSelectionActions={fixtureSelectionActions}
        objectWorkbenchActions={fixtureWorkbenchActions}
        setUi={setUi}
        store={store}
        supportsSanctuaryEditing
      />
    </RightInspectorPanel>
  </div>
</aside>
```

`isLocked = true` is the safety belt — the inspector renders all controls but they appear disabled, conveying the read-only nature visually without us having to police each commit handler.

---

## 4. PR sequence

Single PR (PR-T5). One coherent change, no contract dependencies.

### Source changes inside PR-T5

1. Add stub-action helpers.
2. Wire them into the fixture client.
3. Replace the empty inspector shell with the real host.
4. Extend snapshot spec to take 1-2 inspector-populated snapshots (pergola selected).

### Test plan inside PR-T5

- Typecheck clean.
- HARD GATE: marketing email path 6/6 (this PR doesn't touch the email path, but the gate is mandatory for changes under `apps/portal/lib/drawings/` and `apps/portal/app/staff/projects/...`).
- Workbench unit tests: 54/54 (existing baseline; stubs are fixture-only).
- Playwright snapshot spec: 2-3 tests pass and produce non-empty PNGs in `tmp/`.
- Manual verification: I read each PNG and confirm the inspector body shows PRIMARY / CONNECTIONS / MEMBER SIZES fields for the pergola-selected snapshot.

---

## 5. Per-PR file map

| File | Change | LOC |
|---|---|---|
| [fixtureWorkbenchActionStubs.ts](apps/portal/app/staff/projects/[projectId]/design-workbench/fixtureWorkbenchActionStubs.ts) | NEW. Exports `buildFixtureSelectionActions(setUi)` + `buildFixtureWorkbenchActions()`. ~30 lines of mostly identical no-op functions. | +60 |
| [DesignWorkbenchFixtureClient.tsx](apps/portal/app/staff/projects/[projectId]/design-workbench/DesignWorkbenchFixtureClient.tsx) | Import stubs + `WorkbenchInspectorHost`. Replace empty inspector body with `<WorkbenchInspectorHost ... />`. Build `activeModuleInput` from store. | ~+25 |
| [portal.workbench-snapshot.spec.ts](playwright/portal.workbench-snapshot.spec.ts) | Add 1-2 more snapshot cases: select pergola in rail, screenshot full shell. The select-handler in the fixture client (already added in PR-T4-snapshot) sets activeObjectRef so the inspector mounts the right family. | ~+30 |

Total: ~115 LOC, all in fixture/dev surfaces.

---

## 6. Risk + mitigation

| Risk | Likelihood | Mitigation |
|---|---|---|
| Stub action object missing a property → TS compile error | High (intentional) | This is the *desired* outcome. Add the missing stub, recompile. Forces fixture to stay in sync with production. |
| Production hook adds a side effect at construction (event listener, ref, etc.) that the stub doesn't replicate → fixture renders differently | Low | Action hooks are pure function objects in this codebase; verified by reading `useObjectWorkbenchActions.ts` and `useObjectWorkbenchSelection.ts`. If this changes later, fixture render will diverge visibly and I'll catch it in the next snapshot. |
| `WorkbenchInspectorHost` requires non-null `geometryEditState` for some families → null prop crashes the render | Med | Real production sets this conditionally (null for most rail clicks). Verified in `WorkbenchInspectorHost.tsx` that all branches handle `null`. If a branch doesn't, that's a real bug; I'd file it. |
| Spec's `selectFirstPergola` click handler doesn't trigger the right state update in fixture → inspector still shows "No selection" | Low | The fixture client's `onSelectObjectRef` already sets `activeObjectRef` (added in PR-T4-snapshot). Worst case I add a brief `await page.waitForFunction(() => document.querySelector('[data-active-workbench-object^="pergolas:"]'))` to assert before screenshot. |
| Fixture-only code accidentally leaks into a production import path | Very Low | Stub helpers live in `design-workbench/` next to the hooks. Will be imported by `DesignWorkbenchFixtureClient.tsx` only. Real `DesignWorkbenchEstimateClient.tsx` uses the real hooks; no shared import. Easy `grep` confirms. |

---

## 7. Acceptance criteria

- `npx tsc -p apps/portal/tsconfig.json --noEmit --incremental false` — clean.
- `npx vitest run apps/marketing/lib/enquiryBudgets.test.ts apps/marketing/emails/templates/customerEstimateEmail.test.tsx` — 6/6 (HARD GATE).
- `npx vitest run apps/portal/components/drawings/rail apps/portal/components/drawings/inspector apps/portal/components/drawings/workbench` — same baseline as before (54/54, minus the 2 pre-existing `ModelSpaceViewport` failures).
- `npx playwright test playwright/portal.workbench-snapshot.spec.ts --project=portal-fixture --reporter=line` — all snapshot tests pass.
- Manual: I read `tmp/workbench-mono-plan-selected.png` and confirm the right column shows PRIMARY / CONNECTIONS / MEMBER SIZES sections with field rows visible. No "No selection" empty state.
- The real workbench at `/staff/projects/[id]/design-workbench` renders byte-identically — no diff from this PR (it doesn't import the stubs).

---

## 8. Estimates

| PR | LOC | Risk | Est time |
|---|---|---|---|
| PR-T5 (fixture inspector mount) | ~115 | low | 45-60 min |

Most of the time is enumerating stub functions and verifying their type signatures match. The wiring + spec extension is mechanical.

---

## 9. Sequencing diagram

Skipped — single PR with no dependencies.

---

## 10. What I'd push back on

Nothing in this plan — but a meta-note worth raising:

**The fixture route is becoming load-bearing for dev-loop work, and that should be reflected in how it's maintained.** Once PR-T5 lands, the fixture client is no longer just a "baked snapshot preview" — it's the canonical surface for AI-assisted visual iteration on the workbench. If future product PRs change `WorkbenchInspectorHost` props or the action types, the fixture client needs to update in lockstep. TypeScript will catch most of that, but it's worth a CLAUDE.md or AGENTS.md note that the fixture is intentionally tracking production and shouldn't be "simplified away" by anyone who reads it cold.

I'd add a one-line addition to `docs/agent-playbook.md` (or similar) after T5 lands: *"For visual iteration on the workbench, run `npx playwright test playwright/portal.workbench-snapshot.spec.ts --project=portal-fixture` and read PNGs in `tmp/`."* But that's a follow-up, not part of PR-T5.

---

## 11. Retrospective note

PR-T5 shipped. The fixture route now mounts the real inspector host with typed no-op action stubs, and `docs/workbench-visual-snapshot-loop.md` is the active guide for using it.
