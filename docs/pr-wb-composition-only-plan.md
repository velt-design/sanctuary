# PR-WB-COMPOSITION-ONLY — Retire the footprint sub-object

**Drafted**: 2026-06-19. **Revised**: 2026-06-19. **Status**: planning. Architectural cleanup that removes `footprint.mode`, `footprint.preset`, `footprint.polygon`, and the preset-shape params from `HouseFormModel`. `houseForm.composition` becomes the single authoring representation. Sits on top of PR-WB-RETIRE-PRESET-DROPDOWN (which removed the UX surfaces; this PR removes the data model behind them).

## 1. Goal

Delete `footprint.mode`, `footprint.preset`, `footprint.polygon`, and `footprint.params` from `HouseFormModel`. Migrate every downstream consumer to derive what it needs from `composition`. Leave `footprint.attachmentSide` (different concept; stays for now).

## 2. Architectural fit

### Which north-star invariant or principle does this serve?

[`docs/house-composition-vision.md`](house-composition-vision.md) "make the input space match what we can solve". Post PR-WB-RETIRE-PRESET-DROPDOWN, the workbench has zero authoring affordances that write `footprint.mode` / `preset` / `polygon` / `params`. These fields are vestigial. Every code path that branches on them is dead complexity that obscures the real model — `composition` is the authoring truth, and consumers should read from it directly.

### What alternatives were considered, and why rejected?

1. **Leave footprint as a derived/vestigial field forever.** It's already inert post-PR-WB-RETIRE-PRESET-DROPDOWN. Why touch it? *Rejected:* every future feature touching house-form code will face the question "should I read `footprint.X` or `composition.Y`?" That cognitive tax accumulates. Better to delete now while the consumer mapping is fresh and we have all four composition followups in our heads.

2. **Migrate consumers one PR at a time, leaving the field in place until the last consumer migrates, then delete it.** Smaller PRs, easier gates. *Rejected:* the type model is the lever. Until the type is removed, consumers can still drift back to reading `footprint.X` in new code, undoing the migration. Removing the type forces an atomic migration via typecheck errors.

3. **Delete the whole footprint sub-object including attachmentSide.** *Rejected:* attachmentSide is a separate concept (which pergola side the house attaches to, not shape data). It still has authoring UI in the rail (the Attachment Side dropdown). Removing it is a separate decision; bundling it here muddles the scope.

### What does this consciously NOT try to do?

- **NOT add or change designer-facing UX.** All UI changes shipped in earlier PRs. This is pure type + data migration.
- **NOT migrate openings / decks / pergolas.** They reference the host house form's `composition` (or will after this PR), not its preset specifics.
- **NOT change the geometry pipeline's roof solving.** Phase 4a.3 already routes via composition. This PR just removes the parallel path's input fields.
- **NOT migrate the persisted draft eagerly.** Defensive normalisation on read: legacy `footprint.X` → derived `composition` if not already present. New writes use the post-PR shape.

### Net tech debt: pay down or add?

Major pay-down. The exact LOC depends on how many consumers turn out to need re-derivation logic vs. straight field rename. Conservative estimate: ~600 LOC deleted across ~25 files, ~300 LOC added (replacement derivations + tests). Net -300 LOC. The win is conceptual: one shape representation instead of two.

## 3. The new model

### `HouseFormModel` after this PR

```ts
type HouseFormFootprintModel = {
  attachmentSide: WorkbenchAttachmentSide;
  position?: HouseFormPosition | null;
  // mode, preset, params, polygon: DELETED
};

type HouseFormModel = {
  id: string;
  label: string;
  transform: HouseFormTransformModel;
  footprint: HouseFormFootprintModel;  // shrunk
  composition: HouseComposition;  // ← now REQUIRED, not optional
  roofIntent: HouseFormRoofIntentModel;
  // ...envelope dimensions unchanged
};
```

### Normaliser handles legacy data defensively

`normalizeObjectFirstHouseFormDraft` reads any persisted shape and emits the new shape:

1. If `value.composition` present and valid → use it.
2. Else if legacy `footprint.mode === 'preset'` → synthesise via `buildPresetCompositionFromHouseForm` (handles every preset).
3. Else if legacy `footprint.mode === 'custom_polygon'` and polygon is a 4-vertex axis-aligned rectangle → synthesise via `buildSingleRectangleCompositionFromCustomPolygonForm`.
4. Else (truly free-form legacy polygon) → bounding-box single-rectangle composition stamped `approximationReasons: ['legacy_polygon_bounding_box']`.
5. If even the bounding-box fallback fails → drop the form.

Result: every form in every loaded draft has a composition. New writes emit the slim shape (no mode / preset / params / polygon).

### Every consumer reads from composition

The 25 production files referencing `.footprint.{mode, preset, polygon, params}` migrate to read from composition:

- `houseFormRawGeometry.ts`: `buildHouseFormFootprintPolygonMm` becomes `composeFootprintFromComposition(form.composition)`. One line.
- `houseFormRoofIntentForFootprint.ts`: reconciles roof intent based on composition primitive count + shape (single rect vs composite). The existing branches on preset go away.
- `objectWorkbenchDeckGeometry.ts`: derives deck attachment from composition's union polygon.
- `WorkbenchDiagnosticsPanel.tsx`: surfaces composition data instead of preset name.
- `drawingWorkbenchRailModel.ts`: rail labels derived from composition (single-rect → "Rectangle"; multi-rect → "Composite (N rectangles)") instead of from `mode === 'custom_polygon' ? 'Custom footprint' : 'Footprint ready'`.
- ...and so on for the other 20 files.

The translation is mostly mechanical:
- `form.footprint.mode === 'custom_polygon'` → `form.composition.approximationReasons?.includes('legacy_polygon_bounding_box')` (the only remaining "this was a freeform thing" signal)
- `form.footprint.polygon` → `composeFootprintFromComposition(form.composition).map(p => ...)` (with the alongM/depthM ↔ x/y conversion the call sites already do)
- `form.footprint.preset` → composition shape classifier (single rect, L, U, etc., derived structurally from the composition)
- `form.footprint.params.widthM` → first primitive's widthMm / 1000 (for single-rect forms; for multi-rect, the field doesn't have a meaningful equivalent)

### Edit types reduced to the ones that still make sense

In `EstimateDrawingFootprintEdit`:
- DELETE: `'mode'`, `'preset'`, `'preset_resize'`, `'polygon'`, `'custom_polygon'`, `'param'`
- KEEP: `'attachment_side'`, `'rotate'`, `'position'`
- ADD: `'composition_resize'` — atomic update of a single primitive's dimensions + origin, used by the edge-drag commit for single-primitive forms.

`commitOutlineEdit.ts` for house forms becomes: single-primitive composition + axis-aligned drag → `'composition_resize'`. Multi-primitive → reject for v1 (separate UX problem).

## 4. File map

| File | Change | LOC delta |
|---|---|---|
| `apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts` | Shrink `HouseFormFootprintModel`. Make `composition` required. Rewrite the form normaliser with the legacy-read fallback. | -150 / +100 |
| `apps/portal/lib/drawings/state/houseFormCompositionAdapter.ts` | Add `buildBoundingBoxCompositionFromLegacyPolygon` for the free-form fallback. Mark the existing preset adapter as legacy-only (called by normaliser only). | -30 / +60 |
| `apps/portal/lib/drawings/state/houseFormCompositionFootprint.ts` | `deriveHouseFormFootprintPolygon` simplifies — composition is always present. | -30 / +10 |
| `apps/portal/lib/drawings/state/houseFormRawGeometry.ts` | `buildHouseFormFootprintPolygonMm` becomes one line. | -25 / +5 |
| `apps/portal/lib/drawings/state/houseFormGeometryInput.ts` | `deriveCompositionUnionPolygon3` simplifies. | -10 / +5 |
| `apps/portal/lib/drawings/state/houseFormRoofIntentForFootprint.ts` | Reconcile based on composition shape, not preset name. | -40 / +50 |
| `apps/portal/lib/drawings/state/objectWorkbenchDeckGeometry.ts` | Derive from composition. | -20 / +20 |
| `apps/portal/lib/drawings/state/objectWorkbenchInspectorModel.ts` | Drop `footprint.preset` reads. | -15 / +10 |
| `apps/portal/lib/drawings/state/projectHouseRenderPipeline.ts` | Composition for polygon source. | -10 / +10 |
| `apps/portal/lib/drawings/state/drawingWorkbenchRailModel.ts` | Rail label from composition. | -10 / +15 |
| `apps/portal/lib/drawings/state/objectWorkbenchStatusModel.ts` | Status derivation. | -10 / +10 |
| `apps/portal/lib/drawings/views/plan/objectWorkbenchPlanOverlay.ts` | Polygon from composition. | -10 / +10 |
| `apps/portal/lib/drawings/views/plan/planCommittedBodyVisualStack.ts` | Same. | -10 / +10 |
| `apps/portal/lib/drawings/sanctuaryWorkbenchFixtureBuilders.ts` | Fixtures emit new shape. | -50 / +30 |
| `apps/portal/lib/drawings/sanctuaryWorkbenchMultiObjectFixtures.ts` | Same. | -50 / +30 |
| `apps/portal/lib/estimates/drawingEdits.ts` | Edit type pruning. | -40 / +20 |
| `apps/portal/app/staff/projects/[projectId]/design-workbench/houseFormFootprintDraftActions.ts` | Switch narrows. | -60 / +30 |
| `apps/portal/app/staff/projects/[projectId]/design-workbench/objectWorkbenchDraftActions.ts` | Updates for new edit types. | -30 / +20 |
| `apps/portal/app/staff/projects/[projectId]/design-workbench/commitOutlineEdit.ts` | Edge-drag → composition_resize. Delete the tryConvert helper. | -40 / +30 |
| `apps/portal/app/staff/projects/[projectId]/design-workbench/tryConvertResizeToPresetParams.ts` (DELETED) | No longer needed. | -150 / 0 |
| `apps/portal/app/staff/projects/[projectId]/design-workbench/useObjectWorkbenchActions.ts` | Action signatures. | -30 / +20 |
| `apps/portal/app/staff/projects/[projectId]/design-workbench/objectWorkbenchActionContext.ts` | Drop footprint reads. | -10 / +10 |
| `apps/portal/app/staff/projects/[projectId]/design-workbench/WorkbenchDiagnosticsPanel.tsx` | Read composition. | -15 / +15 |
| `apps/portal/lib/drawings/exportRoofFailureRepro.ts` | Bug-report dump from composition. | -20 / +20 |
| `apps/portal/lib/types/calculator.ts` | Drop `normalizeHouseFootprintParams` + related if no remaining consumer. | -50 / 0 |
| Tests (~15 files) | Update fixture builders + remove obsolete preset tests. | -300 / +180 |
| `docs/decision-log.md` | Entry + index row. | +40 |

**Total**: ~30 files. ~1200 LOC removed, ~800 added. Net -400.

## 5. Risk + mitigation

| Risk | Likelihood | Mitigation |
|---|---|---|
| A consumer I haven't catalogued breaks. | High (this is the biggest unknown) | TypeScript: removing fields from `HouseFormFootprintModel` produces compile errors at every callsite. I work through the errors top-to-bottom until typecheck passes. No silent skips. |
| Pricing path depends on `preset` for line-item categorisation. | Med | Grep for `.preset` in `apps/portal/lib/estimates/` and pricing modules BEFORE starting. If pricing uses preset names, expose a `compositionTopology` enum on the composition (`'rectangle' \| 'L' \| 'U' \| 'recess' \| 'wrap' \| 'composite'`) as a structural derivation, and update pricing reads to use that. |
| A persisted draft with truly free-form polygon becomes a bounding-box rectangle visually. | Low (very few such forms exist in practice; the Draw outline tool was retired weeks ago) | Stamp `approximationReasons: ['legacy_polygon_bounding_box']` and surface a banner in the rail: "This form was a freeform outline before composition; the rectangle approximates the original bounding box. Recreate it if needed." Data isn't lost — just simplified. |
| Test fixtures throughout the codebase break because they construct `HouseFormModel` with the old shape. | Very High (by design) | Centralise a `buildTestHouseForm` helper that returns the new shape. Migrate fixtures in waves; the typecheck errors guide the sweep. |
| Marketing build picks up changes through a transitive dependency. | Low | Marketing is the HARD GATE. Run the marketing build explicitly. Roll back if it breaks. |

## 6. Acceptance criteria

- Portal typecheck clean.
- Geometry typecheck unchanged (113 pre-existing errors, no new ones).
- ESLint clean.
- Docs-guard clean.
- vitest: every existing lane stays green or has its tests updated. Some test counts will drop (preset-specific tests removed); none should fail.
- Marketing build clean (HARD GATE).
- Playwright MCP verification after the typecheck loop closes:
  - Existing forms still render correctly in plan + 3D.
  - Add structure produces a fresh composition-only form.
  - Edge-drag resize updates composition.
  - Join + Detach still work.
  - The rail no longer references mode / preset / preset-params.
- Decision-log entry.

## 7. Sequencing

Single commit, but I'll work in waves within it:

1. **Add `composition: HouseComposition` required** + `buildBoundingBoxCompositionFromLegacyPolygon` (the new helper).
2. **Update the normaliser** to write the new shape + read the legacy shape with the fallback.
3. **Remove `mode`, `preset`, `params`, `polygon`** from `HouseFormFootprintModel`.
4. **Fix typecheck errors top-to-bottom.** Each file becomes a small migration.
5. **Add `'composition_resize'` edit type** + update `commitOutlineEdit.ts`.
6. **Delete the old edit types** (`'mode'`, `'preset'`, `'preset_resize'`, etc.) + the `tryConvertResizeToPresetParams` helper.
7. **Sweep tests** for typecheck + behavioural changes.
8. **Drive the workbench in Playwright** to confirm no runtime surprises.
9. **Decision log + commit.**

Honest time estimate: 4-6 hours, possibly more if the pricing-path investigation surfaces dependencies I haven't seen.

## 8. What I'd push back on

- **The temptation to also retire `footprint.attachmentSide` while we're here.** It's a separate concept (pergola attachment, not house shape). Bundling it muddles scope. If we want it gone, it's a follow-up PR.

- **The temptation to add a "composition shape classifier" enum for fine-grained downstream use.** Pricing might want `'rectangle' | 'L' | 'U' | ...` as a categorical signal. If so, derive it on demand at the consumer rather than persisting it on the form. Persisting derived data creates the same divergence problem the preset field had.

- **The temptation to migrate persisted drafts eagerly.** Defensive normalisation on read covers it. Eager migration adds a migration bug surface for no measurable win.

## 9. CTA

This is the deep cleanup. It bites the bullet on the type model refactor that the four composition followups built toward.

Say **"go composition-only"** to execute. I'll work through it in one continuous session and commit when it's all green.

Say **"break it up"** if you'd rather see this land in 2-3 smaller PRs (e.g., type model + normaliser first, then consumer migrations, then unused-code removal). I'd add a tiny UX regression risk during the in-between states but each PR would be more reviewable.

Say **"defer"** if you'd rather not touch this until a future feature concretely needs it. The current code works; the cruft is invisible to designers.
