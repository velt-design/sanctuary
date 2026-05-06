# House Geometry Composition

This directory exists to decompose `packages/geometry/src/houseModel.ts` (~7700 lines, 247 functions) into focused per-concern modules. The goal is one orchestrator (`houseModel.ts`) that composes named, testable parts.

See `docs/design-workbench-architecture.md` — section "Direction: Free-Floating Objects With Snap-Derived Connections" — for why this split is a prerequisite for the larger architecture migration. The current house model is too large to safely refactor data shape inside; splitting first reduces the risk of every subsequent change.

## Operating rule

When extracting helpers as part of this decomposition pass, **copy the body byte-for-byte**. Do not rename, retype, or "tidy" while moving. Behaviour-preserving improvements belong in a separate PR with their own tests. See [`docs/file-decomposition-and-ownership.md`](../../../../../docs/file-decomposition-and-ownership.md) for the full rationale.

## Target file layout

| File | Responsibility | Status |
|------|----------------|--------|
| `_internal.ts` | Foundational helpers shared across multiple split files: `point`, `line`, `boundingBox`, `axisRange`, `rectangleCornersFromBox`, `lineIntersectionT2D`, `lineIntersection2`, `signedAreaXY`, `pointInPolygon2D`, `distanceToSegment2D`, `polygonCentroid2D`, `uniqueSorted`, `finiteVectorLength`, `translatePointByVector`, `negateVector`, `pointOnRoofSegment2D`, `edgeOutwardVector`, `miterCornerPoint`, `polygonArea3D`, `finiteRoofQaPoint`, `RoofPoint2`, `BentSpineTerminalGableClosure`, `HouseRoofBuildResult`, perimeter type family (`HouseRoofPerimeterEdge` etc.), `finiteNumber`, `positiveNumber`, `clamp`, `midpoint2`, `distanceSquared2`, `swap*Axes`, `reflect*AcrossX`. Internal to the house/ folder; not exported from the package. Will grow as further splits move shared helpers in (`planeFromBoundary`, etc.). | ✅ shipped |
| `constants.ts` | `DEFAULT_*` numeric constants (eave height, roof pitch, soffit depth, fascia thickness, etc) plus `WORLD_Z`, `RIDGE_COLLAPSE_EPSILON_MM`, `ROOF_JOIN_EPSILON_MM`, `ROOF_JOIN_FEATURE_MIN_LENGTH_MM`, `ROOF_REGION_MIN_AREA_MM2`. Pure data, no functions. | ✅ shipped |
| `footprintMath.ts` | Footprint polygon utilities: `isOrthogonalFootprint`, `offsetFootprintPolygon`, `clearanceToPolygon`, `findInteriorRoofNode`, `polygonLineInterval`, `closestPointOnLineSegment2D`, `isRectanglePolygon`. | ✅ shipped |
| `walls.ts` | Wall segment construction: `buildWallTopProfile`, `wallBoundaryHasFlatTop`, `buildWallSegments`. | ✅ shipped |
| `perimeterEdges.ts` | House perimeter edge classification + builders: `classifyHousePerimeterEdges`, `buildHouseRoofPerimeterEdges`, `buildMonoAppendagePerimeterEdges`, `buildAppendagePerimeterEdges`, `roofPlaneTouchesPerimeterEdge`, `roofPlanePerimeterOverlapSegment`. | ✅ shipped |
| `eave.ts` | Eave/fascia/soffit/gutter polygons: `isEavePackageEdge`, `buildPolygonGutterLines`, `buildPolygonGutterBoundaries`, `buildPolygonFasciaPolygons`, `buildPolygonSoffitPolygons`, `buildPerimeterOffsetStripFootprints`. | ✅ shipped |
| `roofPlane.ts` | Roof plane primitives + height-at-XY math: `buildRoofPlane`, `roofPlaneHeightAtXY`, `roofPlaneEquationHeightAtXY`, `roofFeatureHeightAtXY`, `roofHeightAtXY`, plus `RoofSolidPlaneEquation` type, `roofSolidPlaneEquationFromPlane`, `roofSolidBottomPlaneEquation`, `pointOnRoofPolygonBoundary`, `pointInOrOnRoofPolygon`. | ✅ shipped |
| `roofRectangleHipped.ts` | Rectangle-specific hipped roof: `buildRectangleRoofFeatures`, `buildRectangleHippedRoof`. | ✅ shipped |
| `roof2D.ts` | 2D polygon helpers used by joined-roof topology: `point2FromPoint3`, `roofPointDistance2`, `signedArea2D`, `cleanRoofPolygon2D`, `roofPoint3Key`, `roofPoint2Key`, `canonicalRoofSegmentKey`, `compareRoofPoints`, `orientRoofFeatureLine`, `clipRoofPolygonByScalar`, `roofPolygonArea`, `roofPolygonCentroid`, `segmentInsideRoofPolygon`, `roofSegmentOverlapLength2D`, `roofSegmentsProperlyIntersect2D`, `roofPolygonIsSimple`, `roofSegmentInsidePolygonStrict`, `roofRegionInsideEave`, `roofPointOnEaveBoundaryAtWrongHeight`, plus 2D segment helpers: `roofPoint2FromKey`, `pointOnRoofSegment2`, `roofSegmentParam`, `addRoofDissolveSplitPoint`, `roofSegmentIntersectionPoint`. Foundational 2D layer for joined-roof slices. | ✅ shipped |
| `roofJoinedWavefront.ts` | Active rectilinear wavefront subsystem: vertex/loop/segment helpers, edge collapse + split distance computation, sweep regions, segment splitting, polygonization, loop advancement, and the public `buildJoinedRoofWavefrontRegions` entry point. | ✅ shipped |
| `roofJoinedDissolve.ts` | Region-dissolve subsystem: split/intersect dissolve segments, polygonize boundary fragments, and the public `mergeAssignedRoofRegions`, `validateJoinedRoofRegionFootprint`, `sortJoinedRoofRegions`. | ✅ shipped |
| `roofJoinedRegions.ts` | Eave-edge construction + roof-region assignment: `buildJoinedRoofEdges`, `roofHeightFromEdge`, `buildRectilinearRoofBaseRegions`, `splitRoofRegionsByPlaneIntersections`, `assignRoofRegion`. | ✅ shipped |
| `roofJoinedFacets.ts` | Facet construction + feature classification: `buildJoinedRoofFacetFromRegion`, `buildJoinedRoofFacets`, `buildJoinedRoofFeatures`, `countJoinedRoofInternalEaveHeightSegments`, plus eave-vertex / segment helpers. | ✅ shipped |
| `roofJoinedHipped.ts` | Hipped joined-roof variant: `buildJoinedRectilinearHippedRoof`, plus topology helpers `ridgeGraphTerminalNodes`, `roofFeaturesAreAxisAligned`, `edgeLiesOnConvexHull`, `outwardNormalForEdge`. | ✅ shipped |
| `roofJoinedGableTerminals.ts` | Gable terminal subsystem: `deriveHouseFootprintOpenSide`, `intersectTerminalRayWithFootprint`, `deriveBentSpineTerminalIntersectionsX`, `buildBentSpineGableTerminalEndsX`, `deriveBentSpineTerminalGableClosures`, `applyBentSpineTerminalGableClosures`, plus the legacy + ray-detail helpers. | ✅ shipped |
| `roofJoined.ts` | Joined gable + complex builders: `buildLegacyJoinedRectilinearGableRoof`, `buildBentSpineJoinedGableRoofX`, `buildJoinedRectilinearGableRoof`, `buildComplexFootprintRoof`, plus reflect/swap helpers (`reflectRoofBuildResultAcrossX`, `swapRoofBuildResultAxes`) and the public `deriveHouseGableTerminalEndsFromFootprint`. | ✅ shipped |
| `roofQa.ts` | Roof-validation subsystem: `applyRoofQa`, `validateHouseRoofQa`, plus internal helpers and `RoofQa*` types/constants. Validates roof plane finiteness, plan-area, eave-containment, and area parity. | ✅ shipped |
| `roofPrimary.ts` | Per-form roof orchestrators: `buildPrimaryHouseRoof`, plus the per-form builders `buildFlatHouseRoof`, `buildMonoHouseRoof`, `buildRectangularGableRoof`, `buildGabledHouseRoof`, `buildHippedHouseRoof`, and the failure helper `invalidHouseRoof`. Wraps each result through `applyRoofQa`. | ✅ shipped |
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
2. ✅ `_internal.ts` + `constants.ts` (foundational helpers, used by most subsequent files)
3. ✅ `footprintMath.ts` (depends on `_internal.ts`)
4. ✅ `roofPlane.ts` (moved before `walls.ts` because walls depends on `roofHeightAtXY`/`roofFeatureHeightAtXY`)
5. ✅ `walls.ts`
6. ✅ `perimeterEdges.ts` (moved before `eave.ts` because eave consumes the perimeter type family)
7. ✅ `eave.ts`
8. ✅ `roofRectangleHipped.ts`
9. ✅ `roof2D.ts` (intermediate helper file, prerequisite for `roofJoined.ts`)
10. ✅ `roofJoinedWavefront.ts` (wavefront subsystem extracted from joined-roof)
11. ✅ `roofJoinedDissolve.ts` (region-dissolve subsystem extracted from joined-roof)
12. ✅ `roofJoinedRegions.ts` (eave edges + region assignment subsystem)
13. ✅ `roofJoinedFacets.ts` (facet construction + feature classification)
14. ✅ `roofJoinedHipped.ts` (hipped variant + topology helpers)
15. ✅ `roofJoinedGableTerminals.ts` (gable terminal/bent-spine subsystem)
16. ✅ `roofJoined.ts` (joined gable + complex builders + reflect/swap helpers) — joined-roof family complete
17. ✅ `roofQa.ts` (roof QA validators — prerequisite for `roofPrimary.ts`)
18. ✅ `roofPrimary.ts` (per-form roof orchestrators)
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