# PR-WB-COMPOSITION-ONLY — Retire Presets + Mode + Polygon + Params

**Drafted**: 2026-06-19. **Status**: planning. Cleanup pass that consolidates everything since PR-COMP-PHASE3 onto a single source of truth: `houseForm.composition`. Replaces the previously-planned PR-WB-RETIRE-MODE-FIELD with a wider sweep that also retires the preset shapes.

## 1. Goal

Make `houseForm.composition` the only authoring representation of a house form's shape. Delete every parallel representation that's still in the model — `footprint.mode`, `footprint.preset`, `footprint.polygon`, the L/U/recess/wrap-shape params, and every dual-mode branch downstream.

## 2. Architectural fit

### Which north-star invariant or principle does this serve?

[`docs/house-composition-vision.md`](house-composition-vision.md) "make the input space match what we can solve". The remaining presets + mode + polygon fields are a parallel input space that nothing authors anymore (Draw outline retired in Phase 3.3) and that no shape can be expressed in that the composition can't (Phase 3.1 / PR-WB-PRESETS-AS-COMPOSITIONS covered every preset shape). They're vestigial. Every code path that branches on `mode` or reads `params.returnRunM` is now a piece of dead complexity that obscures the real model.

### What alternatives were considered, and why rejected?

1. **Keep the preset dropdown but ship "composition is computed, params are display-only".** Tempting because the UX of "select an L preset" is familiar. *Rejected:* the user has explicitly said the presets are more hassle than they're worth, and once Add structure + Join + Detach are the authoring affordances, the dropdown is a redundant entry point — the same shapes can be authored as compositions and renamed in the rail.
2. **Land PR-WB-RETIRE-MODE-FIELD first, then a separate PR-WB-RETIRE-PRESETS later.** Smaller PRs, easier gates. *Rejected:* the two are tightly coupled — `mode: 'preset'` only makes sense if presets exist. Splitting produces an awkward in-between where `mode` is the only mode (always `'preset'`) for one PR, then both go away. The two pieces really need to land together.
3. **Migrate every existing legacy draft to a composition.** Aggressive: zero-data-loss conversion that walks every persisted form and rebuilds it as a composition. *Rejected for v1:* defensive normalisation on read is enough. Most legacy forms already get a composition (preset / rectangle-polygon inference). Truly free-form polygons (probably zero in production) get a bounding-box single-rectangle composition with a recorded `approximationReasons: 'legacy_polygon_bounding_box'`. Lossy, but bounded.

### What does this consciously NOT try to do?

- **NOT change Add structure.** The button still creates a single-rectangle composition with default 6m × 4m dimensions. UX unchanged from the designer's perspective.
- **NOT add a rectangle-resize gizmo.** The existing edge-drag resize works as long as the composition has a single rectangle. Multi-rectangle composite resize is a separate UX problem (Phase 4 followup).
- **NOT touch openings / decks / pergolas.** They're independent of the house footprint shape.
- **NOT retire `footprint.attachmentSide`.** That's a separate concept (which side the pergola attaches to) and stays for now. May be retired later if it's also redundant with pergola attachment metadata.
- **NOT migrate any persisted draft.** The normaliser DEFENSIVELY handles legacy data on read. New writes use the post-PR shape. Cohabitation works because the workbench normalises on every load.

### Net tech debt: pay down or add?

Major pay-down. ~800 LOC of net deletes across ~30 files. Five+ branches of dual-mode handling collapse (`if (mode === 'custom_polygon')`, the inference fallbacks I just added in PR-WB-CUSTOM-POLY-COMPOSITION, the preset polygon builder dispatch, etc.). Every future feature touching house-form shape now has ONE shape to reason about.

## 3. The new model

### `HouseFormModel` after this PR

```ts
type HouseFormModel = {
  id: string;
  label: string;
  transform: { offsetXM, offsetYM, rotationQuarterTurns };
  composition: HouseComposition;  // required, not optional
  attachmentSide: AttachmentSide;  // pergola side; moved up from footprint
  roofIntent: HouseFormRoofIntentModel;
  roofIntentAuthored?: boolean;
  storeyMode: 'single_storey' | 'two_storey';
  attachmentStrategy: ...;
  // dimension envelope (unchanged):
  eaveHeightM, wallHeightM, soffitDepthMm, fasciaHeightMm,
  gutterWidthMm, gutterDepthMm, gutterProjectionMm, eaveOverhangMm;
};
```

What disappears from the type:

- `footprint` (the whole sub-object goes; `attachmentSide` is the only field that moves up to the top level)

### Normaliser behaviour on legacy data

A read pass through `normalizeObjectFirstHouseFormDraft` with a legacy persisted form:

1. If `value.composition` present and valid → use it directly (multi-rectangle composites are preserved unchanged).
2. Else if legacy `value.footprint.mode === 'preset'` → synthesise via `buildPresetCompositionFromHouseForm` (already handles every preset). Always succeeds because every preset has a composition representation.
3. Else if legacy `value.footprint.mode === 'custom_polygon'` and polygon is a 4-vertex axis-aligned rectangle → synthesise via `buildSingleRectangleCompositionFromCustomPolygonForm`.
4. Else (truly free-form legacy polygon) → bounding-box fallback: build a single rectangle covering the polygon's bounding box. Stamp `composition.approximationReasons = ['legacy_polygon_bounding_box']` so we can surface a warning. The original polygon is discarded.
5. If even the bounding-box fallback fails (degenerate polygon) → drop the form (return null from the form normaliser). The assembly normaliser already filters nulls.

The legacy `footprint` sub-object is read for inference but NEVER written. Persisted forms post-PR have no `footprint`.

### `buildHouseFormFootprintPolygonMm` becomes composition-only

Today's function is a `mode === 'custom_polygon' ? stored polygon : preset polygon` dispatch. After this PR it's just `composeFootprintFromComposition(form.composition)`. Single line.

### Edge-drag resize updates the composition directly

`commitOutlineEdit.ts` no longer needs the preset_resize ↔ custom_polygon dispatch. The new path:
- Single-primitive composition → update the primitive's `widthMm` / `depthMm` / `originXMm` / `originYMm` from the dragged polygon's bounding box. Compensate the form's transform if the SW corner moved (same math as `rebasePartitionIntoOwnFrame` from PR-WB-DETACH-NO-MOVE).
- Multi-primitive composition → for v1, edge-drag is blocked (or handled by the existing rebase-to-bbox fallback). Multi-rectangle resize UX is a Phase 4 followup.

## 4. File map

| File | Change | LOC delta |
|---|---|---|
| `apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts` | Remove `footprint` from `HouseFormModel` + `ObjectFirstHouseFormDraft`. Add `attachmentSide` at top level. Rewrite normaliser to handle legacy data on read + emit new shape on write. | -200 / +120 |
| `apps/portal/lib/drawings/state/houseFormCompositionAdapter.ts` | Rename `buildSingleRectangleCompositionFromHouseForm` → `buildSingleRectangleComposition` (no longer reads form params). Add `buildBoundingBoxCompositionFromLegacyPolygon`. The preset adapter `buildPresetCompositionFromHouseForm` becomes legacy-only (read path). | -50 / +80 |
| `apps/portal/lib/drawings/state/houseFormRawGeometry.ts` | `buildHouseFormFootprintPolygonMm` becomes `composeFootprintFromComposition(form.composition)`. Delete the preset / custom_polygon dispatch. | -40 / +5 |
| `apps/portal/lib/drawings/state/houseFormGeometryInput.ts` | `deriveCompositionUnionPolygon3` always returns non-null now. Simplify the substitution gate. | -10 / +5 |
| `apps/portal/lib/drawings/state/houseFormCompositionFootprint.ts` | `deriveHouseFormFootprintPolygon` and `deriveCompositionUnionPolygon3` collapse — every form has a composition; legacy polygon-from-mode-check disappears. | -50 / +20 |
| `apps/portal/lib/estimates/drawingEdits.ts` | Delete `EstimateDrawingFootprintEdit` variants `'mode'`, `'preset'`, `'preset_resize'`, `'param'`, `'polygon'`, `'custom_polygon'`. Keep `'attachment_side'`, `'rotate'`, `'position'`. Replace with `'composition_resize'` (atomic primitive update). | -50 / +30 |
| `apps/portal/app/staff/projects/[projectId]/design-workbench/houseFormFootprintDraftActions.ts` | Update applier to handle new edit types only. | -100 / +60 |
| `apps/portal/app/staff/projects/[projectId]/design-workbench/commitOutlineEdit.ts` | Edge-drag commit writes a `'composition_resize'` for single-primitive forms; rebase-with-transform-shift if SW corner moved. Multi-primitive → reject for v1. | -30 / +80 |
| `apps/portal/app/staff/projects/[projectId]/design-workbench/tryConvertResizeToPresetParams.ts` (DELETED) | No longer needed — direct composition update replaces it. | -150 / 0 |
| `apps/portal/app/staff/projects/[projectId]/design-workbench/useObjectWorkbenchActions.ts` | Delete `commitHouseFormFootprintDimension`. `commitHouseFormFootprintEdit` simplifies. Detach action uses composition directly (already does). | -40 / +20 |
| `apps/portal/components/drawings/rail/HouseFormFootprintSections.tsx` | Delete the preset dropdown + all preset-specific NumberFields. Keep only the legacy-form badge for forms whose composition was inferred from a free-form polygon (approximationReasons). | -120 / +30 |
| `apps/portal/components/drawings/rail/objectRailShared.tsx` | Delete `FOOTPRINT_OPTIONS`, `FOOTPRINT_MODE_OPTIONS`. | -25 / 0 |
| `packages/geometry/src/footprints.ts` | Don't actually need to delete — the legacy polygon builders stay because non-house code (decks, pergolas) might still use them. Just unused from the workbench. | 0 / 0 |
| `apps/portal/lib/drawings/state/houseFormRoofIntentForFootprint.ts` | Currently reads `footprint.mode` etc. for the gable-end derivation. Switch to reading from composition. | -30 / +40 |
| `apps/portal/app/staff/projects/[projectId]/design-workbench/objectWorkbenchActionContext.ts` | Reads `footprint` in places. Update. | -10 / +5 |
| `apps/portal/lib/drawings/state/*.test.ts` (multiple) | Remove preset/mode-specific tests. Add composition-coverage tests (legacy migration paths). | -300 / +200 |
| Various component tests | Update fixtures that constructed `HouseFormModel` with the old shape. | -80 / +50 |
| `docs/decision-log.md` | New PR-WB-COMPOSITION-ONLY entry + index row. | +50 |

**Total**: ~1100 LOC removed, ~700 added. Net -400 LOC. ~30 files touched.

## 5. Risk + mitigation

| Risk | Likelihood | Mitigation |
|---|---|---|
| Existing user drafts with truly free-form polygons end up as bounding-box rectangles, visibly different from before. | High (if any such forms exist) | Stamp `composition.approximationReasons = ['legacy_polygon_bounding_box']` so the rail can show a banner: "This form was a freeform outline; recreate it if the bounding-box doesn't match what you intended." Data loss is bounded — the form still exists, just as a rectangle. |
| Geometry pipeline regression: some code path I missed still reads `footprint.mode` and crashes on undefined. | Med | TypeScript catches every reference at compile time once the type is removed. Comprehensive typecheck + the workbench's existing test suite (300+ tests) flag missing call sites. Playwright MCP can drive the workbench to catch runtime issues the tests miss. |
| Pergola attachment metadata that referenced house form `footprint.attachmentSide` breaks when the field moves to the top level. | Med | Rename access path consistently. The `attachmentSide` reads are localised; grep + replace finds them. |
| Tests that constructed `HouseFormModel` with `footprint: {...}` no longer compile. | Very High (this is by design) | Update fixture builders in a sweep. Centralised fixture helpers in `objectFirstWorkbenchModel.test.ts` minimise duplication. |
| Pricing / estimate paths that depended on `footprint.preset` for line-item categorisation break. | Med | grep for `.preset` accesses in `apps/portal/lib/estimates/` and pricing modules. If anything pricing-relevant turns out to depend on preset, the cleanup MUST address it before shipping — pricing regressions are worse than UX bugs. Worst case, expose `composition.primitives.length` or `compositionTopology` as a categorical signal. |
| Edge-drag resize commit on a multi-primitive composite has no defined behaviour. | Low for v1 (no UX to create such resizes yet) | Reject the commit with a clear error message. Multi-rectangle resize UX comes later. |

## 6. Acceptance criteria

- Portal typecheck clean.
- ESLint clean.
- Docs-guard clean.
- vitest: every existing lane stays green. Some test counts will drop (preset-specific tests removed); some lanes will grow (new legacy-migration test coverage).
- Playwright MCP verification: navigate to the workbench, confirm:
  - Existing forms with preset+straight still render correctly.
  - Existing forms with preset+L/U/etc. still render correctly.
  - Existing custom_polygon forms still render correctly.
  - Rail no longer shows a preset dropdown.
  - Add structure produces a fresh 6m × 4m form with composition.
  - Edge-drag resize on a single-primitive form updates the primitive.
- Marketing build clean (HARD GATE).
- Decision-log entry.

## 7. Sequencing

Single commit (deletion-heavy refactors are clearer atomically). Within the commit:

1. Add the new `attachmentSide` field at the top level of `HouseFormModel`.
2. Update the normaliser to write the new shape AND defensively read legacy data.
3. Update geometry pipeline (`buildHouseFormFootprintPolygonMm` and downstream).
4. Update edge-drag commit path.
5. Update rail UI (drop preset dropdown + NumberFields).
6. Sweep tests + fixtures.
7. Remove the now-unused dispatch code, edit types, and helpers.
8. Typecheck + lint + tests + Playwright drive.

I'll work through these in order in a single commit, but the code review path follows the same order so reviewers can read top-down.

## 8. What I'd push back on

- **The temptation to keep the preset dropdown "for power users who like dialling in specific shapes."** Composition-only authoring means designers compose visually via Add structure + drag + Join. The preset dropdown's value-add is "type a number, get a complex shape" — which is exactly the muscle memory we want to move away from. If a designer really wants a quick L, two Add structures + a Join is faster than picking L from a dropdown + adjusting params anyway.

- **The temptation to migrate every persisted draft eagerly on the first load post-deploy.** Defensive normalisation on every read is fine. Eager migration adds risk (a migration bug bricks the workbench) without measurable benefit.

- **The temptation to keep `mode: 'composition'` as a placeholder for future shape kinds (rotated rectangles, octagons, freeforms).** Premature. The composition's polymorphic primitive type already leaves room for that — `kind: 'rotatedRectangle' | 'octagon' | ...` slots in without a mode field at the form level.

## 9. CTA

This PR is the cleanup pass on top of the three composition followups we just shipped (CUSTOM-POLY, RESIZE-KEEPS-PRESET, PRESETS-AS-COMPOSITIONS). It's the right architectural endpoint of the composition vision.

Say **"go composition-only"** to execute the full sweep in one commit.

Or say **"smaller bites"** if you'd rather see this land in 2-3 smaller PRs (e.g., normaliser change first, then UI cleanup, then unused-code removal) — I'd take a small UX regression risk during the in-between but it'd be easier to review.
