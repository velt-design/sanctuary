# Appendage Feature Removal — Plan (PR-T8)

**Drafted**: 2026-05-29. **Status**: shipped; retained as a retrospective plan.

This plan records the PR-T8 removal of the roof "appendage band" feature. The active guardrail is in `docs/decision-log.md`; do not treat this file as an active execution request.

---

## Read First

- Treat this as shipped history for PR-T8.
- Use `docs/decision-log.md` for the current no-appendage guardrail.
- Use this file only when checking why the feature was removed and what acceptance gates were used.

## 1. Goal

Remove every line of code that exists to support `appendage` / `HouseRoofAppendage*` / "appendage band". After this PR, `rg appendage` against the repo's production source should return zero results.

---

## 2. Architectural fit

### Which north-star invariant or principle does this serve?

`docs/code-retirement-and-bloat-control.md` § "delete dead features completely, not partially". The current state is the worst-of-both: the user doesn't want the feature, but its geometry submodule (~300 LOC in `packages/geometry/src/house/roofAppendages.ts`), validation codes, inspector diagnostic surface, and 7 dedicated test cases stay alive maintaining themselves. Partial removal would leave the same code in worse shape (hidden behind a flag or unreferenced from any caller); atomic removal is the only stable end-state.

Also serves `docs/design-workbench-architecture.md` § "Product North Star" — the design workbench is converging on a small set of CAD-style primitives. Appendage was a roof-form variant that the user has now explicitly scoped out of the product surface.

### What alternatives were considered, and why rejected?

1. **Phased deletion: UI → types → geometry → tests** across multiple PRs. Rejected — every intermediate state is half-deleted (e.g. types exist but no UI sets them, or geometry exists but no caller invokes it). Each interim is harder to review than the atomic end-state because reviewers have to mentally track "what's left vs. removed". A removal PR's review surface is "is this gone, and did anything else break?" — that's a single question.
2. **Keep types + geometry, just hide the UI.** Rejected — leaves ~300 LOC of `roofAppendages.ts` plus the support analysis in `houseRoofValidation.ts` running on every solve for no consumer. Both bloat and a future "what is this?" trap.
3. **Feature flag the appendage UI off, defer removal.** Rejected — flag overhead is real (env handling, conditional render, test variants) and there's no user/customer who wants it on. The decision is "feature is gone", not "feature is experimental".
4. **Treat appendage as a "Phase 2 cleanup" — wait until the geometry layer rewrites.** Rejected — every solver change between now and then has to keep `appendage` working, which costs more than removing it now.

### What does this consciously NOT try to do?

- **NOT migrate persisted estimate data.** Saved estimates may have `roofIntent.appendage = { enabled: true, ... }` lurking in JSON. The normaliser will silently drop the field on read (Phase 1 "workbench can break temporarily" permission covers any visual regression on those rows).
- **NOT remove `attachmentSourceEdgeId` or other house-model fields that share lines of code with appendage.** Surgical cull — only `appendage*` named fields go. If a helper function services both appendage AND something we keep, the helper stays.
- **NOT change the cost engine or `RawHouseInput` shape used by `calculateCostV1`.** Recon confirmed cost engine doesn't read appendage; the cull stays inside the workbench/geometry layer's "what shape do we offer?" decision.
- **NOT rewrite tests** that happen to mention appendage in a non-load-bearing way. Delete the dedicated test cases; trim assertions from cases that test multiple things.
- **NOT update `supabase/migrations/`.** No DB schema for appendage.

### Net tech debt: pay down or add?

**Massive pay-down.** Removes a whole feature surface that's actively being maintained for no consumer:
- 1 entire geometry submodule (`packages/geometry/src/house/roofAppendages.ts`) — ~300 LOC
- 2 validation codes + their derivation logic in `houseRoofValidation.ts` — ~80 LOC
- 4 UI fields in `HouseFormRoofSections.tsx` + associated helpers — ~60 LOC
- 7 dedicated test cases across 2 test files — ~200 LOC
- Type fields + fixture entries scattered across ~10 more files — ~50 LOC

Total deletion: **~700 LOC removed**, ~30 LOC added (mostly migration-default fallbacks for orphaned saved data + commented deletion markers).

---

## 3. The new model

### Type contract before / after

```ts
// BEFORE — packages/geometry/src/contracts.ts
export type HouseRoofAppendageForm = 'flat' | 'mono';

export type HouseRoofAppendageSupport = {
  supported: boolean;
  supportedHostEdges: AttachmentSide[];
  reason: string | null;
};

// AFTER — both types deleted.
```

```ts
// BEFORE — apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts
export type HouseFormRoofIntentModel = {
  form: HouseRoofForm;
  primaryPitchDeg: string;
  primaryFallDirection: HouseRoofPrimaryFallDirection | null;
  ridgeAxis: HouseRoofRidgeAxis | null;
  openGableEndIds: string[];
  material: CalculatorHouseRoofMaterial | null;
  appendage: {                                  // ← REMOVED
    enabled: boolean;
    form?: HouseRoofAppendageForm;
    hostEdge?: AttachmentSide;
    pitchDeg?: string;
    dropMm?: string;
  } | null;
};

// AFTER — `appendage` field gone from the model.
```

### Solver contract change

`packages/geometry/src/houseModel.ts` currently branches inside the perimeter-edge builder on `appendageJoinSourceEdgeId`. After the cull, the branch becomes unconditional (no appendage = always build perimeter edges normally).

`packages/geometry/src/house/roofAppendages.ts` deleted in full. All importers (currently just `houseModel.ts` and `houseRoofValidation.ts`) lose their imports.

`packages/geometry/src/houseRoofValidation.ts` loses two validation codes (`'invalid_appendage_topology'`, `'invalid_appendage_host_edge'`) and their derivation helpers — net ~80 LOC down.

### UI contract change

`HouseFormRoofIntentModel.appendage` going away means `HouseFormRoofSections.tsx` can delete:
- The `Appendage band` select (Off/On)
- The `Appendage host edge` select
- The `Appendage pitch (deg)` number field
- The `Appendage drop (mm)` number field
- The `canShowAppendageControls` / `appendageHelperText` derivations
- The `appendageSupportedHostEdges` derivation

Inspector model (`objectWorkbenchInspectorModel.ts`) loses ~6 appendage* derived fields.

---

## 4. PR sequence

Single PR (PR-T8). Removal-only changes are easier to review atomically than split across multiple half-states.

---

## 5. Per-PR file map

Grouped by layer; each file's change line is "delete the appendage refs" unless otherwise noted.

### Geometry package (5 files)

| File | Change | LOC delta |
|---|---|---|
| [packages/geometry/src/contracts.ts](packages/geometry/src/contracts.ts) | Delete `HouseRoofAppendageForm` + `HouseRoofAppendageSupport` types | -20 |
| `packages/geometry/src/house/roofAppendages.ts` | **DELETE FILE** (load-bearing `buildSharedHouseRoof` lifted into [sharedHouseRoof.ts](../packages/geometry/src/house/sharedHouseRoof.ts) first) | -300 |
| [packages/geometry/src/houseModel.ts](packages/geometry/src/houseModel.ts) | Drop appendage branches (lines 401, 417, 445-446, 548, 551). Perimeter-edge builder becomes unconditional. | -40 |
| [packages/geometry/src/houseRoofValidation.ts](packages/geometry/src/houseRoofValidation.ts) | Drop `appendage` from capabilities config. Delete `appendageFootprintRequirement`/`appendageSupported`. Delete `deriveHouseRoofAppendageSupportedHostEdges`. Drop validation codes `invalid_appendage_topology`/`invalid_appendage_host_edge`. | -80 |
| [packages/geometry/src/normalize.ts](packages/geometry/src/normalize.ts) | Drop appendage field from `RawHouseInput` normaliser | -25 |

### Portal state (6 files)

| File | Change | LOC delta |
|---|---|---|
| [objectFirstWorkbenchModel.ts](apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts) | Remove `appendage` from `HouseFormRoofIntentModel` | -10 |
| houseFirstWorkbenchModel.ts | Remove appendage from roof intent | -10 |
| houseRoofFormAdapter.ts | Drop appendage field mapping | -15 |
| [houseRoofFormNormalize.ts](apps/portal/lib/drawings/state/houseRoofFormNormalize.ts) | Drop appendage normalisation (silently drops field on read from persisted data) | -20 |
| houseFirstWorkbenchAdapter.ts | Drop `appendageAllowed` derivation | -10 |
| [buildHouseFormReferenceGeometry.ts](apps/portal/lib/drawings/state/buildHouseFormReferenceGeometry.ts) | Drop appendage in geometry handling | -10 |

### Portal inspector + UI (3 files)

| File | Change | LOC delta |
|---|---|---|
| [HouseFormRoofSections.tsx](apps/portal/components/drawings/rail/HouseFormRoofSections.tsx) | Delete 4 appendage fields + `canShowAppendageControls` / `appendageHelperText` / `appendageSupportedHostEdges` derivations + the `labelForAttachmentSideList` import if it becomes unused | -60 |
| [objectWorkbenchInspectorModel.ts](apps/portal/lib/drawings/state/objectWorkbenchInspectorModel.ts) | Drop ~6 appendage* fields from the derived inspector model | -25 |
| [WorkbenchDiagnosticsPanel.tsx](apps/portal/app/staff/projects/[projectId]/design-workbench/WorkbenchDiagnosticsPanel.tsx) | Drop appendage diagnostics block (lines 72-103) | -35 |

### Edit adapter + geometry input (2 files)

| File | Change | LOC delta |
|---|---|---|
| geometryEditAdapter.ts | Drop appendage-related re-exports if any | -5 |
| buildRawGeometryModuleInput.ts | Drop appendage in geometry input mapping | -15 |

### Fixtures (2 files)

| File | Change | LOC delta |
|---|---|---|
| houseFirstWorkbenchFixtures.ts | Drop appendage from fixture data | -15 |
| [objectFirstWorkbenchFixtures.ts](apps/portal/lib/drawings/state/objectFirstWorkbenchFixtures.ts) | Drop appendage from test data | -10 |

### Tests (4 files)

| File | Change | LOC delta |
|---|---|---|
| [houseModel.test.ts](packages/geometry/src/houseModel.test.ts) | Delete 4 dedicated appendage test cases (lines 2724, 2821, 2852, 2889) | -250 |
| [houseRoofValidation.test.ts](packages/geometry/src/houseRoofValidation.test.ts) | Delete 3 appendage validation tests (lines 80, 104, 134) | -100 |
| [resolveHouseTerminalEndToggleRoofDraft.test.ts](apps/portal/app/staff/projects/[projectId]/design-workbench/resolveHouseTerminalEndToggleRoofDraft.test.ts) | Drop appendage from test fixtures (lines 13, 58) | -10 |
| geometryEditAdapter.test.ts | Drop any appendage test cases | -15 |

### Docs (3 files)

| File | Change | LOC delta |
|---|---|---|
| [decision-log.md](docs/decision-log.md) | Add a removal entry citing this PR. Don't delete the 2026-05-XX appendage entry — history stays. | +15 |
| [design-workbench-legacy-cull.md](docs/design-workbench-legacy-cull.md) | Mark appendage feature as removed (cite PR-T8) | +5 |
| [house-inspector-cull-plan.md](docs/house-inspector-cull-plan.md) | Note that the appendage field removal originally proposed for PR-T7 was deferred to PR-T8 (this plan) and is now complete | +3 |

### Total

| Layer | Files | LOC |
|---|---|---|
| Geometry package | 5 | ~-465 |
| Portal state | 6 | ~-75 |
| Inspector + UI | 3 | ~-120 |
| Edit adapter | 2 | ~-20 |
| Fixtures | 2 | ~-25 |
| Tests | 4 | ~-375 |
| Docs | 3 | +23 |
| **Net** | **25** | **~-1057 LOC** |

---

## 6. Risk + mitigation

| Risk | Likelihood | Mitigation |
|---|---|---|
| Persisted estimate JSON contains `appendage: { enabled: true, ... }`; on read the workbench shows the user's appendage configuration vanished | Med | Phase 1 "workbench can break temporarily" permission covers this. The normaliser silently drops the field on read — no error, no orphan. If a stakeholder complains, the field was always workbench-only so no production output (quote / invoice / cost) changes. |
| Geometry solver test fixtures rely on appendage being present for a non-appendage assertion (e.g. perimeter edge count happens to be N because there's an appendage) | Med | Run `npx vitest run packages/geometry` after the cull. Any test that breaks because the perimeter edge count changed needs a fixture update — that's expected work. The four DEDICATED appendage test cases are deleted outright; non-dedicated tests that mention appendage trivially get their assertions updated. |
| Cost engine quietly reads appendage via some indirection the recon missed | Low | Recon used `grep -r "appendage"` across all packages and confirmed zero hits in `packages/costing/` or `apps/marketing/`. Cost-engine HARD GATE (marketing email path 6/6) runs as part of acceptance, so any miss surfaces immediately. |
| A non-test consumer of `HouseRoofAppendageForm` / `HouseRoofAppendageSupport` types still exists | Low-Med | TypeScript will fail the build the instant the type is deleted from `contracts.ts` if any consumer remains. Read the error, delete the consumer. This is the same "compile-error-as-alarm" pattern we used for the fixture stubs in PR-T5. |
| `roofAppendages.ts` re-exports utility functions used outside the appendage context | Low | Re-read the file before deletion. The recon's quick scan showed only `buildAppendageSupportAnalysisFromPerimeterEdges` and `buildAppendageBands` — both appendage-specific by name. If a generic helper hides in there, lift it into a shared file before deleting. |
| `validation_code` enum on `houseRoofValidation.ts` is consumed by a UI surface that switches on it (e.g. an error toast) | Low | After deleting the two validation codes, TS will fail any exhaustive switch. Mechanical fix — delete the unreachable case. |

---

## 7. Acceptance criteria

- `npx tsc -p apps/portal/tsconfig.json --noEmit --incremental false` — clean.
- `npx tsc -p packages/geometry/tsconfig.typecheck.json --noEmit --incremental false` — clean.
- HARD GATE: `npx vitest run apps/marketing/lib/enquiryBudgets.test.ts apps/marketing/emails/templates/customerEstimateEmail.test.tsx` — 6/6.
- `npx vitest run packages/geometry` — green (with fixture updates as needed).
- `npx vitest run apps/portal/components/drawings apps/portal/lib/drawings apps/portal/app/staff/projects/[projectId]/design-workbench` — green (with the 7 dedicated appendage test cases removed, not failing).
- `npx playwright test playwright/portal.workbench-snapshot.spec.ts --project=portal-fixture` — passes. Snapshot read: no "Appendage band" field in house inspector.
- `rg "[Aa]ppendage" packages/ apps/portal/lib apps/portal/components apps/portal/app/staff` — returns ZERO matches (other than removal-marker comments).
- Live portal at `/staff/projects/[id]/design-workbench` — house form selected, no Appendage band visible. 3D viewport renders houses identically to pre-cull (since no fixture had appendage enabled).

---

## 8. Estimates

| PR | LOC delta | Risk | Est time |
|---|---|---|---|
| PR-T8 (appendage cull) | ~-1057 net | low-med | 2-3 hours |

Time mostly spent on:
- Reading + verifying each touch site (~30 min)
- Test fixture updates after solver changes (~45 min — the dominant variable)
- Doc updates + decision-log entry (~15 min)
- Snapshot + verification (~15 min)

---

## 9. Sequencing diagram

Skipped — single PR.

---

## 10. What I'd push back on

The plan deletes `roofAppendages.ts` outright. If the file contains generic geometry helpers that any future feature (e.g. roof valleys, secondary roofs) might want, those should be lifted to a shared location BEFORE deletion. **Mitigation in the plan**: explicit re-read of `roofAppendages.ts` before deletion, with the instruction to lift generic helpers — not a blocker, just a discipline check.

Also: the 7 dedicated test cases being deleted aren't all *purely* dedicated. The houseModel.test.ts cases at lines 2724/2821/2852/2889 are 4 distinct cases but some may share helpers/setups. Deleting one might leave dead setup code. **Mitigation**: after deletion, `npm run dead-code:changed` to catch any orphaned helpers.

---

## 11. Retrospective note

PR-T8 shipped. The appendage feature is removed from production code, and persisted legacy appendage data is intentionally dropped at the workbench draft normalize boundary.
