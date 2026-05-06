# House Geometry Composition

This directory exists to decompose `packages/geometry/src/houseModel.ts` (~7700 lines, 247 functions) into focused per-concern modules. The goal is one orchestrator (`houseModel.ts`) that composes named, testable parts.

See `docs/design-workbench-architecture.md` — section "Direction: Free-Floating Objects With Snap-Derived Connections" — for why this split is a prerequisite for the larger architecture migration. The current house model is too large to safely refactor data shape inside; splitting first reduces the risk of every subsequent change.

## Operating rule

When extracting helpers as part of this decomposition pass, **copy the body byte-for-byte**. Do not rename, retype, or "tidy" while moving. Behaviour-preserving improvements belong in a separate PR with their own tests. See [`docs/file-decomposition-and-ownership.md`](../../../../../docs/file-decomposition-and-ownership.md) for the full rationale.

## Target file layout

| File | Responsibility | Status |
|------|----------------|--------|
| `_internal.ts` | Foundational helpers shared across multiple split files: `point`, `line`, `pointInPolygon2D`, `polygonCentroid2D`, `signedAreaXY`, `boundingBox`, `finiteNumber`, `clamp`, etc. Internal to the house/ folder; not exported from the package. | pending |
| `constants.ts` | `DEFAULT_*` numeric constants (eave height, roof pitch, soffit depth, fascia thickness, etc). Pure data, no functions. | pending |
| `footprintMath.ts` | Footprint polygon utilities: `isOrthogonalFootprint`, `offsetFootprintPolygon`, `clearanceToPolygon`, `findInteriorRoofNode`, `polygonLineInterval`, `closestPointOnLineSegment2D`, `isRectanglePolygon`. | pending |
| `walls.ts` | Wall segment construction: `buildWallTopProfile`, `buildWallSegments`, wall-related helpers. | pending |
| `perimeterEdges.ts` | House perimeter edge classification + builders: `classifyHousePerimeterEdges`, `buildHouseRoofPerimeterEdges`, `buildAppendagePerimeterEdges`, etc. | pending |
| `eave.ts` | Eave/fascia/soffit/gutter polygons: `buildPolygonGutterLines`, `buildPolygonGutterBoundaries`, `buildPolygonFasciaPolygons`, `buildPolygonSoffitPolygons`, `buildPerimeterOffsetStripFootprints`. | pending |
| `roofPlane.ts` | Roof plane primitives + height-at-XY math: `buildRoofPlane`, `roofPlaneHeightAtXY`, `roofPlaneEquationHeightAtXY`, `roofHeightAtXY`. | pending |
| `roofRectangleHipped.ts` | Rectangle-specific hipped roof: `buildRectangleRoofFeatures`, `buildRectangleHippedRoof`. | pending |
| `roofJoined.ts` | Joined rectilinear roof topology (the largest section): wavefront regions, facets, features, hipped + gable variants. | pending |
| `roofPrimary.ts` | Primary house roof orchestrator: `buildPrimaryHouseRoof` and per-form builders (`buildFlatHouseRoof`, `buildMonoHouseRoof`, etc). | pending |
| `roofAppendages.ts` | Appendage band + support derivation + shared roof builder: `buildHouseRoofAppendageBand`, `buildSharedHouseRoof`, `deriveHouseRoofAppendageSupportFromPrimaryRoof`. | pending |
| `roofSolids.ts` | Render mesh + solid adjacency: `buildVerticalPrismRenderMesh`, `buildMiteredOffsetStripFootprints`, `buildRoofSolidAdjacency`, `buildRoofSolidBottomEdge`, `buildRoofSolidRenderMesh`. | pending |
| `roofFlashings.ts` | Roof feature + perimeter flashings: `buildHouseRoofFeatureFlashings`, `buildPerimeterFlashings`, related wing builders. | pending |
| `roofMaterial.ts` | Roof material visuals: `buildHouseRoofMaterialVisualForPlane`, `buildHouseRoofMaterialVisuals`. | pending |
| `decks.ts` | Deck composition: `buildHouseDecks`, `resolveHouseDeckBoundary`, `resolvePresetDeckBoundary`, `resolveDeckHostWallSegment`, related helpers. | pending |
| `openings.ts` | Opening composition: `buildHouseOpenings`. | ✅ shipped |
| `roofFrames.ts` | Open-gable frame features + related: `buildOpenGableFrameFeatures`, `houseWallIsOpenGableFrame`. | pending |
| `envelopeSolids.ts` | Envelope-solid orchestrator: `buildHouseEnvelopeSolids` and its helpers. | pending |
| `attachment.ts` | Attachment target + zone boundary + semantic attachment edge: `buildAttachmentTarget`, `buildZoneBoundary`, `buildSemanticHouseAttachmentEdge`, `buildAttachmentAwareMonoEavePolygon`. | pending |

After all splits land, `packages/geometry/src/houseModel.ts` becomes a slim orchestrator (~500 lines max) that composes the above:

- `buildHouseModel3D` — the top-level public function that orchestrates footprint normalisation, wall building, roof composition, deck/opening building, solid generation, etc.
- `buildHouseReferenceGeometry` — the wrapper that returns `HouseReferenceGeometry` (called from solvers).
- `deriveHouseGableTerminalEndsFromFootprint`, `deriveHouseRoofAppendageSupportFromFootprint` — derivation entry points called from outside the package.

## Split sequence

Order matters because some files depend on others. Recommended sequence:

1. ✅ `openings.ts` (no dependencies on internal helpers — first slice, validates the pattern)
2. `_internal.ts` + `constants.ts` (foundational helpers, used by most subsequent files)
3. `footprintMath.ts` (depends on `_internal.ts`)
4. `walls.ts`
5. `roofPlane.ts`
6. `eave.ts`
7. `perimeterEdges.ts`
8. `roofRectangleHipped.ts`
9. `roofJoined.ts`
10. `roofPrimary.ts`
11. `roofAppendages.ts`
12. `roofMaterial.ts`
13. `roofSolids.ts`
14. `roofFlashings.ts`
15. `roofFrames.ts`
16. `decks.ts`
17. `attachment.ts`
18. `envelopeSolids.ts`
19. Final pass: `houseModel.ts` keeps only orchestrator + public exports.

Each slice should land independently with all geometry tests passing. No behaviour change per slice.