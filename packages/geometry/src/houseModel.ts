import type {
  AssemblyPosition,
  AttachmentSide,
  ConnectionType,
  DatumFrame3,
  GeometryConfig,
  GeometryMetadata,
  HouseDeck3D,
  HouseDeckConfig,
  HouseAttachmentStrategy,
  HouseAttachmentTarget3D,
  HouseModel3D,
  HouseModelConfig,
  HouseReferenceGeometry,
  HouseRoofFeature3D,
  HouseRoofFeatureKind,
  HouseRoofForm,
  HouseRoofMaterial,
  HouseRoofMaterialProfileKind,
  HouseRoofPrimaryFallDirection,
  HouseRoofRidgeAxis,
  HouseRoofMaterialVisual3D,
  HouseWallSegment3D,
  Line3,
  Plane3,
  Point3,
  Polygon3,
  RawHouseInput,
  RenderMesh3D,
  RoofFlashing3D,
  RoofPlane3D,
  Vector3,
} from './contracts';
import { buildHouseModelConfig, resolveHouseAttachmentStrategy } from './normalize';
import {
  normalizeHouseRoofPitchDegForForm,
  validateHouseRoofSelection,
} from './houseRoofValidation';
import {
  crossProduct,
  dotProduct,
  lineLength,
  normalizeVector,
  planeFromOriginAxes,
  planeFromPoints,
  scaleVector,
  subtractPoints,
} from './math3d';
import { buildHouseSideAttachmentLine } from './footprints';
import {
  DEFAULT_DECK_SURFACE_THICKNESS_MM,
  DEFAULT_EAVE_HEIGHT_MM,
  DEFAULT_EAVE_OVERHANG_MM,
  DEFAULT_FASCIA_HEIGHT_MM,
  DEFAULT_FASCIA_SOLID_THICKNESS_MM,
  DEFAULT_GUTTER_DEPTH_MM,
  DEFAULT_GUTTER_PROJECTION_MM,
  DEFAULT_GUTTER_WIDTH_MM,
  DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_GIRTH_MM,
  DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_SURFACE_OFFSET_MM,
  DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_THICKNESS_MM,
  DEFAULT_HOUSE_ROOF_FEATURE_FLASHING_WING_MM,
  DEFAULT_HOUSE_ROOF_MATERIAL,
  DEFAULT_HOUSE_ROOF_MATERIAL_SURFACE_OFFSET_MM,
  DEFAULT_ROOF_PITCH_DEG,
  DEFAULT_ROOF_SOLID_THICKNESS_MM,
  DEFAULT_SOFFIT_DEPTH_MM,
  DEFAULT_SOFFIT_SOLID_THICKNESS_MM,
  DEFAULT_WALL_SOLID_THICKNESS_MM,
  RIDGE_COLLAPSE_EPSILON_MM,
  ROOF_JOIN_EPSILON_MM,
  ROOF_JOIN_FEATURE_MIN_LENGTH_MM,
  ROOF_REGION_MIN_AREA_MM2,
  WORLD_Z,
} from './house/constants';
import {
  axisRange,
  boundingBox,
  clamp,
  distanceSquared2,
  finiteNumber,
  finiteVectorLength,
  line,
  lineIntersection2,
  lineIntersectionT2D,
  midpoint2,
  point,
  pointInPolygon2D,
  pointOnRoofSegment2D,
  polygonCentroid2D,
  positiveNumber,
  rectangleCornersFromBox,
  reflectPointAcrossX,
  reflectVectorAcrossX,
  signedAreaXY,
  swapPointAxes,
  swapVectorAxes,
  edgeOutwardVector,
  finiteRoofQaPoint,
  miterCornerPoint,
  negateVector,
  planeFromBoundary,
  polygonArea3D,
  samePoint3WithinTolerance,
  translatePointByVector,
  uniqueSorted,
  vertexFeatureKind,
  type BentSpineTerminalGableClosure,
  type HouseFootprintOpenSide,
  type HouseGableTerminalEnd,
  type HouseGableTerminalIntersection,
  type HouseRoofBuildResult,
  type HouseRoofPerimeterEdge,
  type HouseRoofPerimeterEdgeKind,
  type HouseRoofPerimeterFlashingRole,
  type HouseRoofPerimeterLine,
  type HouseRoofPerimeterPolygon,
  type JoinedRoofEdge,
  type JoinedRoofFacet,
  type JoinedRoofFacetBuildResult,
  type JoinedRoofFeatureDraft,
  type JoinedRoofRegion,
  type JoinedRoofWavefrontLoop,
  type JoinedRoofWavefrontResult,
  type JoinedRoofWavefrontSegment,
  type RoofPoint2,
} from './house/_internal';
import {
  buildHouseRoofPerimeterEdges,
  classifyHousePerimeterEdges,
  roofPlanePerimeterOverlapSegment,
  roofPlaneTouchesPerimeterEdge,
} from './house/perimeterEdges';
import { buildWallSegments, wallBoundaryHasFlatTop } from './house/walls';
import {
  buildRoofPlane,
  pointInOrOnRoofPolygon,
  pointOnRoofPolygonBoundary,
  roofFeatureHeightAtXY,
  roofHeightAtXY,
  roofPlaneEquationHeightAtXY,
  roofPlaneHeightAtXY,
  roofSolidBottomPlaneEquation,
  roofSolidPlaneEquationFromPlane,
  type RoofSolidPlaneEquation,
} from './house/roofPlane';
import {
  buildPerimeterOffsetStripFootprints,
  buildPolygonFasciaPolygons,
  buildPolygonGutterBoundaries,
  buildPolygonGutterLines,
  buildPolygonSoffitPolygons,
  isEavePackageEdge,
} from './house/eave';
import {
  buildRectangleHippedRoof,
  buildRectangleRoofFeatures,
} from './house/roofRectangleHipped';
import {
  addRoofDissolveSplitPoint,
  canonicalRoofSegmentKey,
  cleanRoofPolygon2D,
  clipRoofPolygonByScalar,
  compareRoofPoints,
  orientRoofFeatureLine,
  point2FromPoint3,
  pointOnRoofSegment2,
  roofPoint2FromKey,
  roofPoint2Key,
  roofPoint3Key,
  roofPointDistance2,
  roofPointOnEaveBoundaryAtWrongHeight,
  roofPolygonArea,
  roofPolygonCentroid,
  roofPolygonIsSimple,
  roofRegionInsideEave,
  roofSegmentIntersectionPoint,
  roofSegmentInsidePolygonStrict,
  roofSegmentOverlapLength2D,
  roofSegmentParam,
  roofSegmentsProperlyIntersect2D,
  segmentInsideRoofPolygon,
  signedArea2D,
} from './house/roof2D';
import { buildJoinedRoofWavefrontRegions } from './house/roofJoinedWavefront';
import {
  mergeAssignedRoofRegions,
  sortJoinedRoofRegions,
  validateJoinedRoofRegionFootprint,
} from './house/roofJoinedDissolve';
import {
  assignRoofRegion,
  buildJoinedRoofEdges,
  buildRectilinearRoofBaseRegions,
  roofHeightFromEdge,
  splitRoofRegionsByPlaneIntersections,
} from './house/roofJoinedRegions';
import {
  buildJoinedRoofFacetFromRegion,
  buildJoinedRoofFacets,
  buildJoinedRoofFeatures,
  countJoinedRoofInternalEaveHeightSegments,
} from './house/roofJoinedFacets';
import {
  buildJoinedRectilinearHippedRoof,
  edgeLiesOnConvexHull,
  outwardNormalForEdge,
  ridgeGraphTerminalNodes,
  roofFeaturesAreAxisAligned,
} from './house/roofJoinedHipped';
import {
  applyBentSpineTerminalGableClosures,
  buildBentSpineGableTerminalEndsX,
  deriveBentSpineTerminalGableClosures,
  deriveBentSpineTerminalIntersectionsX,
  deriveHouseFootprintOpenSide,
} from './house/roofJoinedGableTerminals';
import {
  buildComplexFootprintRoof,
  deriveHouseGableTerminalEndsFromFootprint,
  reflectRoofBuildResultAcrossX,
  swapRoofBuildResultAxes,
} from './house/roofJoined';
export { deriveHouseGableTerminalEndsFromFootprint } from './house/roofJoined';
import { applyRoofQa, validateHouseRoofQa } from './house/roofQa';
import {
  buildFlatHouseRoof,
  buildHippedHouseRoof,
  buildMonoHouseRoof,
  buildPrimaryHouseRoof,
  invalidHouseRoof,
} from './house/roofPrimary';
import { buildSharedHouseRoof } from './house/sharedHouseRoof';
import {
  boundaryZRange,
  buildMiteredOffsetStripFootprints,
  buildMiteredStripFootprints,
  buildRoofSolidAdjacency,
  buildRoofSolidBottomEdge,
  buildRoofSolidRenderMesh,
  buildVerticalPrismRenderMesh,
  cleanPolygon3D,
  clipPolygon3DByScalar,
  polygonAveragePoint3D,
  roofPlaneTopNormal,
  roofSolidEdgeKey,
  roofSolidPointKey,
  type RoofSolidAdjacency,
  type RoofSolidBottomEdge,
  type RoofSolidEdgeReference,
  type RoofSolidLine,
} from './house/roofSolids';
import { buildHouseRoofFeatureFlashings, buildPerimeterFlashings } from './house/roofFlashings';
import {
  buildHouseRoofMaterialVisualForPlane,
  buildHouseRoofMaterialVisuals,
} from './house/roofMaterial';
import {
  buildHouseDecks,
  resolveDeckHostWallSegment,
  resolveHouseDeckBoundary,
  resolvePresetDeckBoundary,
} from './house/decks';
import { buildOpenGableFrameFeatures, houseWallIsOpenGableFrame } from './house/roofFrames';
import {
  buildAttachmentAwareMonoEavePolygon,
  buildAttachmentTarget,
  buildSemanticHouseAttachmentEdge,
  buildZoneBoundary,
  sourceEdgeIndexFromId,
} from './house/attachment';
import { buildHouseEnvelopeSolids } from './house/envelopeSolids';
import {
  closestPointOnLineSegment2D,
  clearanceToPolygon,
  findInteriorRoofNode,
  isOrthogonalFootprint,
  isRectanglePolygon,
  offsetFootprintPolygon,
  polygonLineInterval,
} from './house/footprintMath';
import { buildHouseOpenings } from './house/openings';



// PR-T8 (2026-05-29): `deriveHouseRoofAppendageSupportFromFootprint` was
// the public entry point for the inspector to ask "is appendage
// supported on this footprint?" before showing the editor. Removed with
// the rest of the appendage feature.








export function buildHouseModel3D(input: {
  /**
   * Source house form id. Stamped onto the returned `HouseModel3D.houseId`
   * so the scene-assembly seam can prefix derived scene-object ids by
   * source house. Required even for single-house scenes — tests pass a
   * stable literal (e.g. `'test-house'`) so multi-house regressions trip
   * the lock-in invariant test (PR-Geo2) rather than slipping through.
   */
  houseId: string;
  config: GeometryConfig;
  attachmentEdge: Line3 | null;
}): HouseModel3D | null {
  // Freestanding houses get a full 3D model (walls + roof + envelope) since
  // PR8b. The previous `return null` short-circuit was a vestige of an era
  // where the workbench only rendered pergola-attached houses; multi-form
  // rendering needs standalone forms to surface walls/roof/decks too. The
  // pergola-dependent helpers downstream (`buildSemanticHouseAttachmentEdge`,
  // `buildAttachmentTarget`) are already null-safe for freestanding -- the
  // resulting `attachmentTarget` is `{ kind: 'none' }`, which is correct.
  const model = input.config.houseContext.model;
  const footprint = model?.footprint;
  if (!footprint || footprint.length < 3) return null;

  const eaveHeightMm = finiteNumber(
    model.eaveHeightMm,
    input.config.structural.heights.referenceUndersideMm ??
      input.config.structural.heights.houseUndersideMm ??
      DEFAULT_EAVE_HEIGHT_MM,
  );
  const wallHeightMm = finiteNumber(model.wallHeightMm, eaveHeightMm);
  const roofForm = model.roofForm ?? 'hipped';
  const roofPitchDeg = normalizeHouseRoofPitchDegForForm({
    roofForm,
    pitchDeg: finiteNumber(model.roofPitchDeg, DEFAULT_ROOF_PITCH_DEG),
    fallbackPitchDeg: DEFAULT_ROOF_PITCH_DEG,
  });
  const soffitDepthMm = positiveNumber(model.eave?.soffitDepthMm, DEFAULT_SOFFIT_DEPTH_MM);
  const fasciaHeightMm = positiveNumber(model.eave?.fasciaHeightMm, DEFAULT_FASCIA_HEIGHT_MM);
  const gutterWidthMm = positiveNumber(model.eave?.gutterWidthMm, DEFAULT_GUTTER_WIDTH_MM);
  const gutterDepthMm = positiveNumber(model.eave?.gutterDepthMm, DEFAULT_GUTTER_DEPTH_MM);
  const gutterProjectionMm = positiveNumber(model.eave?.gutterProjectionMm, DEFAULT_GUTTER_PROJECTION_MM);
  const eaveOverhangMm = positiveNumber(model.eave?.eaveOverhangMm, DEFAULT_EAVE_OVERHANG_MM);
  const roofMaterial = model.roofMaterial ?? DEFAULT_HOUSE_ROOF_MATERIAL;
  const roofPrimaryFallDirection = model.roofPrimaryFallDirection ?? 'positive_y';
  const roofRidgeAxis = model.roofRidgeAxis ?? 'x';
  const semanticAttachmentEdge = buildSemanticHouseAttachmentEdge(input.config, input.attachmentEdge);
  const preliminaryWallSegments = buildWallSegments(footprint, wallHeightMm, null);
  const preliminaryAttachmentTarget = buildAttachmentTarget({
    config: input.config,
    attachmentEdge: semanticAttachmentEdge,
    wallSegments: preliminaryWallSegments,
    eaveHeightMm,
    fasciaHeightMm,
  });
  // PR-T8 (2026-05-29): renamed from `appendageJoinSourceEdgeId`. The
  // value itself is the attachment target's source edge id — the
  // mono-eave builder still needs it to know where the pergola joins,
  // independent of any appendage feature.
  const attachmentJoinSourceEdgeId =
    preliminaryAttachmentTarget.kind === 'zone' && preliminaryAttachmentTarget.line
      ? preliminaryAttachmentTarget.sourceEdgeId ?? null
      : null;
  const wallBox = boundingBox(footprint);
  const baseEavePolygon =
    offsetFootprintPolygon(footprint, eaveOverhangMm) ?? [
      point(wallBox.minX - eaveOverhangMm, wallBox.minY - eaveOverhangMm, 0),
      point(wallBox.maxX + eaveOverhangMm, wallBox.minY - eaveOverhangMm, 0),
      point(wallBox.maxX + eaveOverhangMm, wallBox.maxY + eaveOverhangMm, 0),
      point(wallBox.minX - eaveOverhangMm, wallBox.maxY + eaveOverhangMm, 0),
    ];
  const eavePolygon = buildAttachmentAwareMonoEavePolygon({
    footprint,
    eavePolygon: baseEavePolygon,
    roofForm,
    attachmentSourceEdgeId: attachmentJoinSourceEdgeId,
  });
  // Resolve which terminal ends are open BEFORE building the roof, so
  // the unified `buildRectangularRoof` (called inside the hipped path
  // for rectangle footprints) can apply per-end caps. Filter to ids that
  // actually exist for the resolved ridge axis -- ignoring stale ids
  // from a different orientation. Honoured for both `gable` and
  // `hipped` forms (milestone 13 phase A); `hipped` + ids = Dutch-hip.
  const availableTerminalEnds = deriveHouseGableTerminalEndsFromFootprint({
    footprint,
    ridgeAxis: roofRidgeAxis,
  });
  const requestedOpenTerminalEndIds = new Set(
    roofForm === 'hipped'
      ? (model.openGableEndIds ?? []).filter((id) =>
          availableTerminalEnds.some((terminalEnd) => terminalEnd.id === id),
        )
      : [],
  );

  const roof = buildSharedHouseRoof({
    sourceFootprint: footprint,
    eavePolygon,
    eaveHeightMm,
    roofPitchDeg,
    roofForm,
    roofPrimaryFallDirection,
    roofRidgeAxis,
    openTerminalEndIds: [...requestedOpenTerminalEndIds],
  });
  const wallSegments = buildWallSegments(footprint, wallHeightMm, roof);
  const openTerminalEndIds = new Set(
    roof.metadata.roofQaStatus === 'valid' ? requestedOpenTerminalEndIds : [],
  );
  const terminalEndBySourceEdgeId = new Map(
    availableTerminalEnds.map((terminalEnd) => [terminalEnd.sourceEdgeId, terminalEnd]),
  );
  // Locate the ridge feature so we can read its height when reshaping
  // open-gable end walls. The unified rectangular roof builder always emits
  // a single ridge feature with `kind: 'ridge'`; its endpoints sit at the
  // ridge apex height. We only need the z component here — the apex's
  // x/y come from the wall's own eave midpoint.
  const ridgeFeature = roof.roofFeatures.find((feature) => feature.kind === 'ridge');
  const ridgeZ = ridgeFeature ? ridgeFeature.line.start.z : null;

  const displayWallSegments = wallSegments.map((segment) => {
    const terminalEnd = segment.sourceEdgeId
      ? terminalEndBySourceEdgeId.get(segment.sourceEdgeId)
      : null;
    if (!terminalEnd || !openTerminalEndIds.has(terminalEnd.id)) return segment;

    // Reshape the wall boundary from a flat-top rectangle into a triangle
    // climbing from the eave to the ridge apex. The wall's plane is already
    // vertical (its xAxis runs along the eave, yAxis is +Z), so the apex
    // sits at the eave midpoint at ridge height. With this triangular
    // boundary, the wall-solid mesh builder produces the correct
    // gable-end face that fills the open hip.
    //
    // Only reshape rectangular flat-top boundaries (the migrated-gable case
    // where roofForm === 'hipped'). For a native `gable` roof form,
    // `buildWallSegments` already produced a gable-shaped boundary via
    // `buildWallTopProfile`; leave it alone so closed-vs-open boundary
    // parity (test: "keeps open wrap gable ends on the same terminal
    // closure geometry") is preserved.
    //
    // If we can't find a ridge height (defensive — should not happen for a
    // valid rectangular roof), fall back to the existing rectangular
    // boundary so the wall is still visible at eave height.
    const groundStart = segment.boundary[0]!;
    const groundEnd = segment.boundary[1]!;
    const shouldReshape = ridgeZ !== null && wallBoundaryHasFlatTop(segment.boundary);
    const nextBoundary = shouldReshape
      ? [
          groundStart,
          groundEnd,
          {
            x: (groundStart.x + groundEnd.x) / 2,
            y: (groundStart.y + groundEnd.y) / 2,
            z: ridgeZ as number,
          },
        ]
      : segment.boundary;

    return {
      ...segment,
      boundary: nextBoundary,
      metadata: {
        ...segment.metadata,
        houseWallMode: 'open_gable_frame',
        gableEndId: terminalEnd.id,
      },
    };
  });
  const frameFeatures = buildOpenGableFrameFeatures({
    wallSegments: displayWallSegments,
    openTerminalEnds: availableTerminalEnds.filter((terminalEnd) =>
      openTerminalEndIds.has(terminalEnd.id),
    ),
    roofGeometry:
      typeof roof.metadata.roofGeometry === 'string' ? roof.metadata.roofGeometry : null,
  });
  // Frame features are synthesized from the validated wall + roof
  // geometry, so they inherit the parent roof's QA verdict. Stamp the
  // QA metadata so downstream `roofQaStatus === 'valid'` checks on the
  // full feature collection do not flag these synthetic outlines.
  const parentRoofQaStatus =
    typeof roof.metadata.roofQaStatus === 'string' ? roof.metadata.roofQaStatus : null;
  const stampedFrameFeatures = parentRoofQaStatus
    ? frameFeatures.map((feature) => ({
        ...feature,
        metadata: { ...feature.metadata, roofQaStatus: parentRoofQaStatus },
      }))
    : frameFeatures;
  const displayRoofFeatures = [...roof.roofFeatures, ...stampedFrameFeatures];
  const attachmentTarget = buildAttachmentTarget({
    config: input.config,
    attachmentEdge: semanticAttachmentEdge,
    wallSegments: displayWallSegments,
    eaveHeightMm,
    fasciaHeightMm,
  });
  // PR-T8 (2026-05-29): previously the perimeter-edge set was
  // `[...perimeterEdges, ...buildAppendagePerimeterEdges(...)]`. With
  // appendages gone, no roof plane carries `roofGeometry: 'appendage_band'`
  // metadata, so the appendage builder always returned []. Inlined as
  // just `perimeterEdges`.
  const perimeterEdges = buildHouseRoofPerimeterEdges({
    footprint,
    eavePolygon,
    roofForm,
    roofPlanes: roof.roofPlanes,
    eaveHeightMm,
    joinSourceEdgeId: attachmentTarget.sourceEdgeId ?? null,
  });
  const gutterLines = buildPolygonGutterLines({ perimeterEdges });
  const gutterBoundaries = buildPolygonGutterBoundaries({
    perimeterEdges,
    gutterWidthMm,
    gutterProjectionMm,
  });
  const fasciaPolygons = buildPolygonFasciaPolygons({
    perimeterEdges,
    fasciaHeightMm,
  });
  const soffitPolygons = buildPolygonSoffitPolygons({
    perimeterEdges,
    roofForm,
    roofPlanes: roof.roofPlanes,
  });
  const roofPlanesForSolids = roof.metadata.roofQaStatus === 'valid' ? roof.roofPlanes : [];
  const roofFlashings =
    roof.metadata.roofQaStatus === 'valid'
      ? [
          ...buildHouseRoofFeatureFlashings({
            roofPlanes: roof.roofPlanes,
            roofFeatures: roof.roofFeatures,
          }),
          ...buildPerimeterFlashings({
            perimeterEdges: perimeterEdges,
            roofPlanes: roof.roofPlanes,
            attachmentTarget,
          }),
        ]
      : [];
  const roofMaterialVisuals =
    roof.metadata.roofQaStatus === 'valid'
      ? buildHouseRoofMaterialVisuals({
          roofPlanes: roof.roofPlanes,
          material: roofMaterial,
        })
      : [];
  const decks = buildHouseDecks({
    decks:
      (model.decks ?? [])
        .flatMap((deck) => {
          if (!deck) return [];
          const boundary = resolveHouseDeckBoundary({
            deck,
            footprint,
            wallSegments: displayWallSegments,
          });
          if (!boundary?.length) return [];
          return [{
            id: deck.id,
            name: deck.name ?? null,
            kind: deck.kind ?? 'deck',
            shape: deck.shape ?? 'preset',
            presetType: deck.presetType ?? null,
            presetRect: deck.presetRect ?? null,
            boundary,
            plane: planeFromOriginAxes(point(0, 0, 0), { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }),
            topSurfaceElevationMm:
              finiteNumber(deck.topSurfaceElevationMm, finiteNumber(deck.levelOffsetMm, 0)),
            elevationMode: deck.elevationMode ?? 'ground',
            hostEdgeId: deck.hostEdgeId ?? null,
            isAttached: Boolean(deck.isAttached),
            surfaceMaterial: deck.surfaceMaterial ?? 'timber_decking',
            supportClassification: deck.supportContext?.classification ?? 'mixed_or_unclear',
            metadata: {
              deckName: deck.name ?? deck.id,
              deckKind: deck.kind ?? 'deck',
              deckShape: deck.shape ?? 'preset',
              deckPresetType: deck.presetType ?? null,
              deckPresetRectWidthMm: deck.presetRect?.widthMm ?? null,
              deckPresetRectDepthMm: deck.presetRect?.depthMm ?? null,
              deckPresetRectCenterOffsetMm: deck.presetRect?.centerOffsetMm ?? null,
              deckPresetRectDetachedGapMm: deck.presetRect?.detachedGapMm ?? null,
              deckElevationMode: deck.elevationMode ?? 'ground',
              deckHostEdgeId: deck.hostEdgeId ?? null,
              deckIsAttached: Boolean(deck.isAttached),
              deckSurfaceMaterial: deck.surfaceMaterial ?? 'timber_decking',
              deckSupportClassification: deck.supportContext?.classification ?? 'mixed_or_unclear',
              deckNearestHouseEdgeId: deck.supportContext?.nearestHouseEdgeId ?? null,
              deckNearestHouseEdgeDistanceMm: deck.supportContext?.nearestHouseEdgeDistanceMm ?? null,
              deckAttachmentContactLengthMm: deck.supportContext?.attachmentContactLengthMm ?? null,
              deckSupportWarnings: deck.supportContext?.warningCodes?.join(',') ?? null,
              deckValidationStatus: deck.validation?.status ?? 'valid',
              deckValidationCodes: deck.validation?.codes?.join(',') ?? null,
            },
          }];
        }) ?? [],
  });
  const openings = buildHouseOpenings({
    openings:
      (model.openings ?? []).map((opening) => ({
        id: opening.id,
        label: opening.label ?? null,
        kind: opening.kind ?? 'window',
        wallId: opening.wallId ?? 'rear',
        hostEdgeId: opening.hostEdgeId ?? null,
        widthMm: finiteNumber(opening.widthMm, 0),
        heightMm: finiteNumber(opening.heightMm, 0),
        sillHeightMm: finiteNumber(opening.sillHeightMm, 0),
        offsetAlongWallMm: finiteNumber(opening.offsetAlongWallMm, 0),
        panelCount:
          opening.kind === 'slider'
            ? opening.panelCount === 3 || opening.panelCount === 4
              ? opening.panelCount
              : 2
            : null,
        validationStatus: opening.validation?.status === 'invalid' ? 'invalid' : 'valid',
        validationCodes: opening.validation?.codes ?? [],
        validationMessage: opening.validation?.message ?? null,
        metadata: {
          openingLabel: opening.label ?? opening.id,
          openingKind: opening.kind ?? 'window',
          openingPanelCount:
            opening.kind === 'slider'
              ? opening.panelCount === 3 || opening.panelCount === 4
                ? opening.panelCount
                : 2
              : null,
          openingWallId: opening.wallId ?? 'rear',
          openingHostEdgeId: opening.hostEdgeId ?? null,
          openingWidthMm: finiteNumber(opening.widthMm, 0),
          openingHeightMm: finiteNumber(opening.heightMm, 0),
          openingSillHeightMm: finiteNumber(opening.sillHeightMm, 0),
          openingOffsetAlongWallMm: finiteNumber(opening.offsetAlongWallMm, 0),
          openingValidationStatus: opening.validation?.status ?? 'valid',
          openingValidationCodes: opening.validation?.codes?.join(',') ?? null,
          openingValidationMessage: opening.validation?.message ?? null,
        },
      })) ?? [],
  });

  // Roof eave snap targets (step 6 of the first-class spatial-entities
  // migration). One descriptor per attachable perimeter edge — drain
  // eaves AND gable-end / apron edges that pergolas can still attach to
  // even when no roof plane drains above them (e.g. an opened Dutch-hip
  // end's gable wall). The classifier in `perimeterEdges.ts` labels each
  // edge by its hydrology (`drain_eave` / `weather_flashed_edge` /
  // `house_apron_edge`); we surface every kind here and let downstream
  // consumers re-filter on `edgeKind` when they truly need drains only
  // (gutter rendering, flashing rules). Pergola snap is the primary
  // attachment usage and it needs the full perimeter.
  const roofEaves = perimeterEdges
    .filter(
      (edge) =>
        edge.edgeKind === 'drain_eave' ||
        edge.edgeKind === 'weather_flashed_edge' ||
        edge.edgeKind === 'house_apron_edge',
    )
    .map((edge) => ({
      id: `roof-eave-${edge.sourceEdgeId}`,
      edgeKind: edge.edgeKind,
      eaveLine: { start: edge.eaveStart, end: edge.eaveEnd },
      sourceEdgeId: edge.sourceEdgeId,
      sourceRoofPlaneId: edge.sourceRoofPlaneId ?? null,
    }));

  return {
    houseId: input.houseId,
    footprint,
    wallSegments: displayWallSegments,
    roofPlanes: roof.roofPlanes,
    roofFeatures: displayRoofFeatures,
    roofFlashings,
    roofMaterial,
    roofMaterialVisuals,
    decks,
    openings,
    solids: buildHouseEnvelopeSolids({
      wallSegments: displayWallSegments,
      roofPlanes: roofPlanesForSolids,
      roofForm,
      decks,
      perimeterEdges: perimeterEdges,
      soffitPolygons,
      fasciaPolygons,
      gutterLines,
      gutterBoundaries,
      gutterWidthMm,
      gutterDepthMm,
    }),
    roofEaves,
    eave: {
      soffitDepthMm,
      fasciaHeightMm,
      gutterWidthMm,
      gutterDepthMm,
      gutterProjectionMm,
      eaveOverhangMm,
      gutterLines: gutterLines.map((candidate) => candidate.line),
      gutterBoundaries: gutterBoundaries.map((candidate) => candidate.boundary),
      fasciaPolygons: fasciaPolygons.map((candidate) => candidate.boundary),
      soffitPolygons: soffitPolygons.map((candidate) => candidate.boundary),
      metadata: roof.metadata,
    },
    attachmentTarget,
    // Workbench's configured ridge axis. Surfaced at the top level
    // (not in `metadata`) so it does NOT participate in the canonical
    // golden hash -- it's a runtime hint for downstream consumers
    // (top-projection click-target enrichment, rail derivations)
    // that need to align on the active axis without a per-plane
    // heuristic. Joined-hipped wavefront planes carry alternating
    // x/y ridge metadata, so picking from `roofPlanes[0].metadata
    // .ridgeAxis` chose the wrong axis on custom polygons where the
    // user's configured axis differs from the first plane's. The
    // canonical compare cherry-picks specific HouseModel3D fields,
    // so an additional top-level field is silently excluded by
    // omission -- intentional here.
    roofRidgeAxis,
    metadata: {
      roofForm,
      roofMaterial,
      openGableEndIds: [...openTerminalEndIds].join(','),
      storeyMode: model.storeyMode ?? 'single_storey',
      wallConstruction: model.wallConstruction ?? 'timber_frame',
      attachmentStrategy: attachmentTarget.strategy,
      ...roof.metadata,
    },
  };
}

export function buildHouseReferenceGeometry(input: {
  /**
   * Source house form id. Stamped onto the returned model so the scene
   * seam can prefix derived ids by source house. For the solver path this
   * is the host house id (the form the active pergola attaches to); for
   * tests it's a stable literal. Required.
   */
  houseId: string;
  config: GeometryConfig;
  attachmentEdge: Line3 | null;
}): HouseReferenceGeometry {
  // House first-class spatial position (milestone 12). When set, every coord
  // on the returned `HouseReferenceGeometry` is in house-local coords; the
  // boundary (`applyAssemblyPosition3D`) consumes `position` and translates
  // to world. When null, legacy world-coord path applies (footprint was
  // pergola-anchored in `normalize.ts` and pre-translated implicitly).
  const housePosition = input.config.houseContext.position ?? null;
  const model = buildHouseModel3D({
    houseId: input.houseId,
    config: input.config,
    attachmentEdge: input.attachmentEdge,
  });

  if (input.config.connection.type === 'freestanding') {
    // Freestanding houses now populate `model` (PR8b) so multi-form workbench
    // rendering can show walls/roof/decks. Pergola-attachment fields stay null
    // -- there's no pergola wall to bind to, no fascia, no attachment target.
    return {
      wallPlane: null,
      fasciaLine: null,
      roofEdgeLine: null,
      soffitDepthMm: input.config.houseContext.soffitDepthMm ?? null,
      footprint: input.config.houseContext.footprint ?? null,
      model,
      attachmentTarget: null,
      position: housePosition,
    };
  }

  const wallPlane: Plane3 = planeFromOriginAxes(
    input.config.datum.origin,
    input.config.datum.xAxis,
    input.config.datum.zAxis,
  );

  return {
    wallPlane: {
      ...wallPlane,
      normal: { x: 0, y: -1, z: 0 },
    },
    fasciaLine: input.config.connection.type === 'fascia' ? input.attachmentEdge : null,
    roofEdgeLine: input.attachmentEdge,
    soffitDepthMm: input.config.houseContext.soffitDepthMm ?? null,
    footprint: input.config.houseContext.footprint ?? null,
    model,
    attachmentTarget: model?.attachmentTarget ?? null,
    position: housePosition,
  };
}

/**
 * Pergola-side context that the existing `buildHouseModel3D` reads on top
 * of the house's own data. Captured here so the new
 * `buildHouseModel3DFromRawHouseInput` entry can take it as a typed
 * sub-shape rather than a full `GeometryConfig`. Names mirror the fields
 * `buildHouseModel3D` actually consumes from `config` -- nothing more.
 *
 * Phase 2 of milestone 13: this is transitional scaffolding. The eventual
 * goal is to decouple `HouseModel3D` from pergola context entirely (the
 * pergola-specific attachment-target geometry becomes a separate per-
 * pergola overlay), but that's a larger refactor than fits in phase 2.
 * For now, pergola context is an explicit parameter -- the orchestrator
 * (phase 3) supplies it once per pergola the house participates in.
 */
/**
 * Pergola-relationship context: the subset of fields that only make sense
 * when a specific pergola is attached to this house. Pass `null` to
 * `buildHouseModel3DFromRawHouseInput` for freestanding houses (no pergola).
 *
 * PR-G2 (2026-05-22) split this out of the omnibus per-call object so
 * additional house forms stop synthesising stub values. The remaining
 * fields are the genuine inputs to `buildSemanticHouseAttachmentEdge` —
 * pergola-dependent, not house-intrinsic. Closes audit row N4 (synthetic
 * context in `buildAdditionalHouseFormGeometry`).
 */
export type HouseModel3DPergolaAttachment = {
  connectionType: Exclude<ConnectionType, 'freestanding'>;
  attachmentSide: AttachmentSide;
  attachmentEdge: Line3 | null;
  /** Datum frame the pergola contributes; used to derive the wall plane. */
  datum: GeometryConfig['datum'];
  /**
   * Pergola dimensions used by `buildSemanticHouseAttachmentEdge` to size
   * the host attachment edge.
   */
  pergolaLengthMm: number;
  pergolaProjectionMm: number;
};

/**
 * Build a `HouseModel3D` from a `RawHouseInput` plus the pergola-side
 * context the current builder reads. Phase 2 of milestone 13 (drop pergola
 * `houseContext` wrapping) -- this is the entry point that the project-
 * level orchestrator (phase 3) will call ONCE per house, instead of the
 * pipeline rebuilding the same `HouseModel3D` once per pergola.
 *
 * Internally:
 *   1. Normalises the raw house's footprint via the same helpers
 *      `normalize.ts` uses (caller already supplies the resolved
 *      `pergolaContext.footprint` so no further footprint work happens here).
 *   2. Calls `buildHouseModelConfig` to produce a `HouseModelConfig`.
 *   3. Constructs the minimum `GeometryConfig` shape the existing
 *      `buildHouseModel3D` reads (connection, structural.heights,
 *      houseContext sub-fields). Fields the builder doesn't read are
 *      stubbed -- if a future change starts reading them here, the type
 *      checker catches it.
 *   4. Delegates to `buildHouseModel3D`.
 *
 * The output is byte-equivalent (modulo serialisation order) to the
 * legacy path of `normalize() -> buildHouseModel3D({ config, attachmentEdge })`,
 * because internally we ARE the legacy path -- this is a thin adapter, not
 * a reimplementation. Phase 2 is intentionally additive; the legacy entry
 * stays as-is. A round-trip test (`houseModel.test.ts`) asserts the
 * equivalence so future refactors don't drift the two paths.
 */
export function buildHouseModel3DFromRawHouseInput(input: {
  rawHouse: RawHouseInput;
  /** Resolved world-space footprint polygon (mm). */
  footprint: Polygon3 | null;
  /** Optional house-level world position; passed through to the model. */
  housePosition?: AssemblyPosition | null;
  /** Soffit depth used for attachment-zone geometry; passed through verbatim. */
  soffitDepthMm?: number | null;
  /** Eave-height fallback heights from `structural.heights`. */
  houseUndersideMm?: number | null;
  referenceUndersideMm?: number | null;
  outerUndersideMm?: number | null;
  /**
   * Pergola-relationship context. `null` => freestanding house (no pergola
   * attaches; `attachmentTarget` will be `{ kind: 'none' }`).
   */
  pergolaAttachment: HouseModel3DPergolaAttachment | null;
}): HouseModel3D | null {
  const {
    rawHouse,
    footprint,
    housePosition = null,
    soffitDepthMm = null,
    houseUndersideMm = null,
    referenceUndersideMm = null,
    outerUndersideMm = null,
    pergolaAttachment,
  } = input;

  const connectionType: ConnectionType = pergolaAttachment?.connectionType ?? 'freestanding';
  const attachmentSide: AttachmentSide = pergolaAttachment?.attachmentSide ?? 'rear';
  const attachmentStrategy =
    connectionType === 'freestanding'
      ? 'none'
      : resolveHouseAttachmentStrategy(rawHouse.attachmentStrategy ?? null, connectionType);

  const houseModelConfig: HouseModelConfig | null = buildHouseModelConfig({
    rawHouseContext: rawHouse,
    footprint,
    attachmentStrategy,
    houseUndersideMm,
    referenceUndersideMm,
  });

  // Construct a partial GeometryConfig containing exactly the fields
  // `buildHouseModel3D` reads. Other fields are filled with safe stubs --
  // the builder never sees them. If `buildHouseModel3D` grows a new
  // dependency on a config field, TypeScript catches it via this object
  // literal.
  //
  // What `buildHouseModel3D` actually reads from `config`:
  //   - connection.type
  //   - houseContext.{model, position, soffitDepthMm, footprint}
  //   - structural.heights.{houseUndersideMm, outerUndersideMm,
  //     referenceUndersideMm}
  //   - datum (only meaningful when pergolaAttachment is non-null; a stub
  //     identity frame is fine for freestanding because the attachment-edge
  //     helper short-circuits)
  const partialConfig: Pick<
    GeometryConfig,
    'connection' | 'houseContext' | 'structural' | 'datum' | 'dimensions'
  > = {
    connection: {
      type: connectionType,
      attachmentSide,
    },
    datum: pergolaAttachment?.datum ?? FREESTANDING_DATUM_STUB,
    dimensions: {
      lengthMm: pergolaAttachment?.pergolaLengthMm ?? 0,
      projectionMm: pergolaAttachment?.pergolaProjectionMm ?? 0,
      roofPitchDeg: 0,
    },
    houseContext: {
      footprint,
      footprintMode: null,
      footprintPolygon: null,
      position: housePosition,
      soffitDepthMm,
      model: houseModelConfig,
      attachmentStrategy: rawHouse.attachmentStrategy ?? null,
      wallLine: null,
      fasciaLine: null,
      roofEdgeLine: null,
    },
    structural: {
      heights: {
        houseUndersideMm,
        outerUndersideMm,
        referenceUndersideMm,
      },
      // Fields `buildHouseModel3D` doesn't read -- stubs. If the builder
      // ever starts reading these, TS will surface the missing field.
      profiles: {
        post: null,
        rafter: null,
        ledger: null,
        supportBeam: null,
        gutter: null,
        ridge: null,
        boxPerimeter: null,
      },
      framing: { rafterCount: null, rafterSpacingMm: null },
      drainage: {
        gutterType: null,
        gutterAssemblyMode: null,
        integratedGutterBeam: null,
        hasOurGutter: null,
      },
    },
  };

  return buildHouseModel3D({
    houseId: rawHouse.houseId,
    config: partialConfig as GeometryConfig,
    attachmentEdge: pergolaAttachment?.attachmentEdge ?? null,
  });
}

const FREESTANDING_DATUM_STUB: GeometryConfig['datum'] = {
  origin: { x: 0, y: 0, z: 0 },
  xAxis: { x: 1, y: 0, z: 0 },
  yAxis: { x: 0, y: 1, z: 0 },
  zAxis: { x: 0, y: 0, z: 1 },
  attachmentEdgeStart: { x: 0, y: 0, z: 0 },
  attachmentEdgeEnd: { x: 0, y: 0, z: 0 },
};
