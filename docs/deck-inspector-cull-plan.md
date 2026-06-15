# Deck Inspector Cull Plan (PR-T9)

**Status**: shipped; retained as a retrospective plan.

Companion to [`docs/house-inspector-cull-plan.md`](house-inspector-cull-plan.md) and PR-T8 [appendage cull](appendage-removal-plan.md). Records the PR-T9 cleanup of the deck right rail to match the CAD-style direction: dead/derived fields removed (not hidden), snap is the authority for placement, future shape edits go through the gumball.

## Read First

- Treat this as shipped history for PR-T9.
- Use `docs/decision-log.md` for the current deck inspector guardrail.
- Do not re-execute the CTA-style sections below; use the file as archaeology for the cull.

## 1. Goal

Strip the deck right-rail inspector of unused and derived fields so it exposes only the editable identity of a deck (shape + dimensions + surface material), and remove the supporting backend (`deck.label`, `deck.kind`, `deck.elevationMode`) that no consumer branches on.

## 2. Architectural fit

### Which north-star invariant or principle does this serve?

`docs/design-workbench-architecture.md` "Direction: Free-Floating Objects With Snap-Derived Connections" — the snap engine is the source of truth for placement; inspector dropdowns that duplicate snap state mislead users (recon confirmed `deck.hostEdgeId` is written by `buildDeckCommitPatch` during drag release, not by the dropdown). Also the standing "Dead/derived UI fields → REMOVE not hide" rule from PR-T7 ([`docs/decision-log.md` 2026-05-29 House Inspector cleanup](decision-log.md)).

### What alternatives were considered, and why rejected?

1. **Hide the fields behind an ADVANCED disclosure.** Rejected: same drift problem as the appendage band — fields with no consumer accumulate maintenance load whether visible or not. The PR-T7/T8 precedent is delete-don't-hide.
2. **Keep `elevationMode` as a dropdown but reduce to two options (`ground` / `floating`).** Rejected: the recon found the geometry only branches on `'ground'` vs not-ground (one clamp: `Math.max(0, levelOffsetMm)`); a two-option dropdown is still inspector ceremony for a 1-line guard the user said does nothing visible.
3. **Delete the `levelOffsetMm` clamp entirely (Option A) vs replace `elevationMode` with a `sitsOnGround: boolean` (Option B).** Picking **A** (drop the clamp). Negative offsets just translate the deck below ground; if a user ever does this and it bites, a boolean comes back as a one-line addition. The current 3-option dropdown is a lot of surface for a single branch on negative input the user has likely never tested.

### What does this consciously NOT try to do?

- **Not rewriting the deck snap engine.** `hostEdgeId` stays in the model; only the inspector dropdown that lets the user override the snap-derived value is removed. Snap stays authoritative.
- **Not touching the helper-text paragraphs.** Recon confirmed every line references a real constraint (snap behaviour, projection direction, clearance rules). Tightening UI density without losing the constraint hints is a separate W-series polish PR.
- **Not removing `Reset position`.** It's the recovery action for "I dragged my deck off-canvas" — low cost, high value when needed. Stays.
- **Not splitting into multiple PRs.** Same shape as PR-T8 — atomic delete is easier to review than a phased one.

### Net tech debt: pay down or add?

Net pay-down. Removes one type literal (`DeckKind` shrinks to nothing), one type alias (`DeckElevationMode`), one field from the geometry input (`elevationMode`), three inspector controls, and the associated commit handlers + helper text. Adds nothing.

## 3. The new model

```ts
// apps/portal/lib/drawings/state/houseFirstWorkbenchModel.ts
export type DeckModel = {
  id: string;
  // label: REMOVED — auto-derive "Deck 1", "Deck 2" from index in the left-rail list.
  // kind: REMOVED — was 'deck' | 'landing'; no consumer branched on it.
  shape: DeckShape;
  presetType: DeckPresetType | null;
  presetRect: DeckPresetRect | null;
  floatingRect?: DeckFloatingPresetRect | null;
  outline: CalculatorHouseFootprintPolygonPoint[];
  // elevationMode: REMOVED — was 'ground' | 'stepped' | 'aligned_to_threshold'.
  // The only branch was `mode === 'ground' ? Math.max(0, offset) : offset`;
  // dropping the clamp. Negative offsets translate the deck below ground.
  levelOffsetMm: string;
  hostEdgeId: string | null;            // ← snap-derived, kept in model, hidden from inspector
  attachmentMode?: DeckAttachmentMode;
  // ...rest unchanged
  surfaceMaterial: DeckSurfaceMaterial;
  topSurfaceElevationMm: number;        // ← now always = Number(levelOffsetMm)
  // supportContext, validation: unchanged
};
```

Persisted-draft compatibility: `label` / `kind` / `elevationMode` on legacy storage are silently dropped at the workbench draft normalize boundary (`normalizeObjectFirstDeckDraft` in [`objectFirstWorkbenchModel.ts`](../apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts)). Same pattern as PR-T8 appendage removal — no migration script needed.

## 4. File map

| File | Change | LOC |
|---|---|---|
| [DeckInspectorSections.tsx](../apps/portal/components/drawings/rail/DeckInspectorSections.tsx) | Drop `Deck name`, `Deck kind`, `Host edge / Witness edge`, `Elevation mode` controls + their commit handlers. Drop the top-row `Add deck` + `Custom outline` action buttons (duplicates of left-rail + Shape dropdown). Drop `DECK_KIND_OPTIONS` / `DECK_ELEVATION_OPTIONS` imports. | ~-110 |
| [objectFirstWorkbenchModel.ts](../apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts) | Drop `DeckKind` type, `DeckElevationMode` type. Drop `kind` / `label` / `elevationMode` fields from `ObjectFirstDeckDraft`, `DeckObjectModel`, `HouseFirstDeckDraft`. Drop normalisation in `normalizeObjectFirstDeckDraft`. | ~-40 |
| houseFirstWorkbenchModel.ts | Drop `DeckKind` re-export. Drop matching fields from `DeckModel` + `HouseFirstDeckDraft`. | ~-15 |
| houseFirstDeckAdapter.ts | Replace `topSurfaceElevationMm = (mode === 'ground' ? Math.max(0, offset) : offset)` with `topSurfaceElevationMm = Number.isFinite(Number(levelOffsetMm)) ? Number(levelOffsetMm) : 0`. Drop `kind`/`label`/`elevationMode` reads. | ~-20 |
| buildRawGeometryModuleInput.ts | Drop `kind`/`label`/`elevationMode` from the `decks[]` payload (line ~405-420). Costing input shape change. | ~-8 |
| `packages/costing/src/**` | Recon confirmed costing has no `deck.kind` / `deck.elevationMode` reads (zero hits for either name). No costing-side change needed. | 0 |
| legacyObjectFirstCompatibilityAdapter.ts | Drop the dropped fields from compat passthroughs. | ~-12 |
| [objectWorkbenchInspectorModel.ts](../apps/portal/lib/drawings/state/objectWorkbenchInspectorModel.ts) | Drop dropped fields from `ObjectWorkbenchDeckInspectorModel`. | ~-8 |
| Left-rail deck list (SanctuaryWorkbenchRail.tsx or wherever the list renders) | Replace `deck.label ?? deck.id` with `\`Deck ${index + 1}\``. Audit: is the label shown anywhere else (PDFs, quote output)? If yes, keep auto-name path consistent. | ~+3 |
| Test fixtures (`objectFirstWorkbenchFixtures.ts`, `houseFirstWorkbenchFixtures.ts`, ~6 inline test fixtures) | Drop dropped fields from every fixture. | ~-30 |
| Tests touching the dropped surface (estimate: ~5 files — `DeckInspectorSections.test.tsx`, `deckCommitAdapter.test.ts`, `buildRawGeometryModuleInput.test.ts`, etc.) | Drop assertions + fixture entries. Remove the dropped controls from `not.toContain` checks where they exist. | ~-50 |
| [docs/decision-log.md](decision-log.md) | Append PR-T9 entry mirroring PR-T8 — what was removed, the elevation-mode behaviour change (clamp gone), the snap-authority guardrail for `hostEdgeId`. | +30 |
| [docs/design-workbench-legacy-cull.md](design-workbench-legacy-cull.md) | Mark deck inspector cull complete. | +3 |

**Total: ~1 file deleted? No. ~12 files touched, net ~-270 LOC.**

## 5. Risk + mitigation

| Risk | Likelihood | Mitigation |
|---|---|---|
| Costing contract change (`kind`/`elevationMode` dropped from `decks[]` payload) cascades into `packages/costing` quote output. | Med | Recon flagged these as passed-but-not-branched-on. Verify with `rg 'kind|elevationMode' packages/costing/src` before deleting. If a SKU formula does read either, it's a follow-up to migrate the formula first. |
| Dropping the `elevationMode === 'ground'` clamp lets users sink decks below ground via negative `levelOffsetMm`. | Low | The default is 0; users have to actively type a negative number. If it bites, the boolean comes back as a one-line addition. Documented in the decision-log entry as a known behaviour change. |
| `deck.label` is rendered in a place I haven't found (PDF, quote, legacy spreadsheet adapter). | Med | `rg 'deck.*label\|\.label\b'` across portal + marketing before deletion. Auto-name fallback (`Deck ${index+1}`) is a one-line addition wherever it's read. |
| Tests reference the dropped surfaces in unexpected places. | Med | Same approach as PR-T8: run typecheck first, walk the error list, fix in dependency order. |
| Marketing email path (HARD GATE) somehow touches deck shape. | Very Low | PR-T8 cleared this path with the same level of geometry-touching changes. Re-run the 6/6 marketing gate at acceptance. |

## 6. Acceptance criteria

- `rg '\bDeckKind\b\|deck\.kind\|deck\.label\|elevationMode'` returns zero hits in production source (`apps/portal/lib`, `apps/portal/components`, `apps/portal/app/staff`, `packages/`), excluding tombstone PR-T9 comments and negative-assertion tests.
- Portal typecheck (`npx tsc --noEmit` from `apps/portal`): clean.
- Geometry typecheck: zero NEW errors vs the pre-PR baseline (56 pre-existing `houseId` errors are unrelated, same as PR-T8).
- Portal drawings vitest (`npx vitest run lib/drawings`): all green.
- Geometry vitest: zero new failures vs baseline.
- **HARD GATE: marketing email path 6/6** (`npm --prefix apps/marketing run build` clean, marketing email test green).
- Manual verification via the Playwright snapshot loop:
  - `mono-standard` fixture with one preset deck attached → renders identically to pre-PR snapshot (no visual regression).
  - Inspector right rail for that deck shows ONLY: Shape, dimension fields (width/depth/center offset), Level offset, Surface material, Redraw outline, Reset position, Remove deck. No `Deck name`, no `Deck kind`, no `Host edge`, no `Elevation mode`, no duplicated `Add deck` / `Custom outline` buttons.
  - Drag a preset deck near a different house edge → `hostEdgeId` updates automatically (snap-derived path works without the inspector dropdown).

## 7. What I'd push back on

The user's framing said "elevation mode doesn't change anything." The recon found it DOES branch — but only on negative `levelOffsetMm` (clamps to 0 for `'ground'`). So the user is right in practice (they likely never typed a negative number), and the dropdown is overwrought UI for a single branch on an edge case. Going with delete-the-clamp (Option A) instead of preserving it as a boolean (Option B) because the user has never observed it behaving — meaning the clamp's protective value is unproven, and a boolean later costs one line.

## 8. Retrospective note

PR-T9 shipped. The deck inspector now relies on snap-derived host identity and derived list labels instead of the removed manual deck name, kind, elevation mode, and host-edge controls.
