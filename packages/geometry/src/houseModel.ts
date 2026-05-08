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
  HouseRoofAppendageForm,
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
import { buildHouseModelConfig } from './normalize';
import {
  normalizeHouseRoofPitchDegForForm,
  validateHouseRoofSelection,
  type HouseRoofAppendageSupport,
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
  buildAppendagePerimeterEdges,
  buildHouseRoofPerimeterEdges,
  buildMonoAppendagePerimeterEdges,
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
  buildBentSpineJoinedGableRoofX,
  buildComplexFootprintRoof,
  buildJoinedRectilinearGableRoof,
  buildLegacyJoinedRectilinearGableRoof,
  deriveHouseGableTerminalEndsFromFootprint,
  reflectRoofBuildResultAcrossX,
  swapRoofBuildResultAxes,
} from './house/roofJoined';
export { deriveHouseGableTerminalEndsFromFootprint } from './house/roofJoined';
import { applyRoofQa, validateHouseRoofQa } from './house/roofQa';
import {
  buildFlatHouseRoof,
  buildGabledHouseRoof,
  buildHippedHouseRoof,
  buildMonoHouseRoof,
  buildPrimaryHouseRoof,
  buildRectangularGableRoof,
  invalidHouseRoof,
} from './house/roofPrimary';
import {
  buildHouseRoofAppendageBand,
  buildSharedHouseRoof,
  deriveHouseRoofAppendageSupportFromPrimaryRoof,
  type HouseRoofAppendageHostRun,
  type HouseRoofAppendageSupportAnalysis,
} from './house/roofAppendages';
export type { HouseRoofAppendageHostRun, HouseRoofAppendageSupportAnalysis } from './house/roofAppendages';
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



export function deriveHouseRoofAppendageSupportFromFootprint(input: {
  sourceFootprint: Polygon3;
  eaveHeightMm: number;
  eaveOverhangMm: number;
  roofPitchDeg: number;
  roofForm: HouseRoofForm;
  roofPrimaryFallDirection: HouseRoofPrimaryFallDirection;
  roofRidgeAxis: HouseRoofRidgeAxis;
  attachmentSourceEdgeId?: string | null;
}): HouseRoofAppendageSupportAnalysis {
  const wallBox = boundingBox(input.sourceFootprint);
  const baseEavePolygon =
    offsetFootprintPolygon(input.sourceFootprint, input.eaveOverhangMm) ?? [
      point(wallBox.minX - input.eaveOverhangMm, wallBox.minY - input.eaveOverhangMm, 0),
      point(wallBox.maxX + input.eaveOverhangMm, wallBox.minY - input.eaveOverhangMm, 0),
      point(wallBox.maxX + input.eaveOverhangMm, wallBox.maxY + input.eaveOverhangMm, 0),
      point(wallBox.minX - input.eaveOverhangMm, wallBox.maxY + input.eaveOverhangMm, 0),
    ];
  const eavePolygon = buildAttachmentAwareMonoEavePolygon({
    footprint: input.sourceFootprint,
    eavePolygon: baseEavePolygon,
    roofForm: input.roofForm,
    attachmentSourceEdgeId: input.attachmentSourceEdgeId ?? null,
  });
  const primaryRoof = buildPrimaryHouseRoof({
    sourceFootprint: input.sourceFootprint,
    eavePolygon,
    eaveHeightMm: input.eaveHeightMm,
    roofPitchDeg: input.roofPitchDeg,
    roofForm: input.roofForm,
    roofPrimaryFallDirection: input.roofPrimaryFallDirection,
    roofRidgeAxis: input.roofRidgeAxis,
  });
  return deriveHouseRoofAppendageSupportFromPrimaryRoof({
    sourceFootprint: input.sourceFootprint,
    eavePolygon,
    eaveHeightMm: input.eaveHeightMm,
    roofForm: input.roofForm,
    primaryRoof,
    attachmentSourceEdgeId: input.attachmentSourceEdgeId ?? null,
  });
}








export function buildHouseModel3D(input: {
  config: GeometryConfig;
  attachmentEdge: Line3 | null;
}): HouseModel3D | null {
  if (input.config.connection.type === 'freestanding') return null;

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
  const appendageJoinSourceEdgeId =
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
    attachmentSourceEdgeId: appendageJoinSourceEdgeId,
  });
  const roof = buildSharedHouseRoof({
    sourceFootprint: footprint,
    eavePolygon,
    eaveHeightMm,
    roofPitchDeg,
    roofForm,
    roofPrimaryFallDirection,
    roofRidgeAxis,
    roofAppendage: model.roofAppendage ?? null,
    attachmentSourceEdgeId: appendageJoinSourceEdgeId,
  });
  const wallSegments = buildWallSegments(footprint, wallHeightMm, roof);
  const availableTerminalEnds = deriveHouseGableTerminalEndsFromFootprint({
    footprint,
    ridgeAxis: roofRidgeAxis,
  });
  const openTerminalEndIds = new Set(
    roofForm === 'gable' && roof.metadata.roofQaStatus === 'valid'
      ? (model.openGableEndIds ?? []).filter((id) =>
          availableTerminalEnds.some((terminalEnd) => terminalEnd.id === id),
        )
      : [],
  );
  const terminalEndBySourceEdgeId = new Map(
    availableTerminalEnds.map((terminalEnd) => [terminalEnd.sourceEdgeId, terminalEnd]),
  );
  const displayWallSegments = wallSegments.map((segment) => {
    const terminalEnd = segment.sourceEdgeId
      ? terminalEndBySourceEdgeId.get(segment.sourceEdgeId)
      : null;
    if (!terminalEnd || !openTerminalEndIds.has(terminalEnd.id)) return segment;
    return {
      ...segment,
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
  const displayRoofFeatures = [...roof.roofFeatures, ...frameFeatures];
  const attachmentTarget = buildAttachmentTarget({
    config: input.config,
    attachmentEdge: semanticAttachmentEdge,
    wallSegments: displayWallSegments,
    eaveHeightMm,
    fasciaHeightMm,
  });
  const perimeterEdges = buildHouseRoofPerimeterEdges({
    footprint,
    eavePolygon,
    roofForm,
    roofPlanes: roof.roofPlanes,
    eaveHeightMm,
    joinSourceEdgeId: attachmentTarget.sourceEdgeId ?? null,
  });
  const appendagePerimeterEdges = buildAppendagePerimeterEdges({
    roofPlanes: roof.roofPlanes,
  });
  const allPerimeterEdges = [...perimeterEdges, ...appendagePerimeterEdges];
  const gutterLines = buildPolygonGutterLines({ perimeterEdges: allPerimeterEdges });
  const gutterBoundaries = buildPolygonGutterBoundaries({
    perimeterEdges: allPerimeterEdges,
    gutterWidthMm,
    gutterProjectionMm,
  });
  const fasciaPolygons = buildPolygonFasciaPolygons({
    perimeterEdges: allPerimeterEdges,
    fasciaHeightMm,
  });
  const soffitPolygons = buildPolygonSoffitPolygons({
    perimeterEdges: allPerimeterEdges,
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
            perimeterEdges: allPerimeterEdges,
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
  // migration). One descriptor per drain-eave perimeter edge — these are the
  // canonical snap lines for pergola `spatialKind: 'roof_edge'` attachments.
  // Other perimeter-edge kinds (`weather_flashed_edge`, `house_apron_edge`)
  // are not pergola attachment targets in v1, so they're filtered out here.
  const roofEaves = allPerimeterEdges
    .filter((edge) => edge.edgeKind === 'drain_eave')
    .map((edge) => ({
      id: `roof-eave-${edge.sourceEdgeId}`,
      edgeKind: 'drain_eave' as const,
      eaveLine: { start: edge.eaveStart, end: edge.eaveEnd },
      sourceEdgeId: edge.sourceEdgeId,
      sourceRoofPlaneId: edge.sourceRoofPlaneId ?? null,
    }));

  return {
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
      perimeterEdges: allPerimeterEdges,
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
  config: GeometryConfig;
  attachmentEdge: Line3 | null;
}): HouseReferenceGeometry {
  // House first-class spatial position (milestone 12). When set, every coord
  // on the returned `HouseReferenceGeometry` is in house-local coords; the
  // boundary (`applyAssemblyPosition3D`) consumes `position` and translates
  // to world. When null, legacy world-coord path applies (footprint was
  // pergola-anchored in `normalize.ts` and pre-translated implicitly).
  const housePosition = input.config.houseContext.position ?? null;

  if (input.config.connection.type === 'freestanding') {
    return {
      wallPlane: null,
      fasciaLine: null,
      roofEdgeLine: null,
      soffitDepthMm: input.config.houseContext.soffitDepthMm ?? null,
      footprint: input.config.houseContext.footprint ?? null,
      model: null,
      attachmentTarget: null,
      position: housePosition,
    };
  }

  const wallPlane: Plane3 = planeFromOriginAxes(
    input.config.datum.origin,
    input.config.datum.xAxis,
    input.config.datum.zAxis,
  );
  const model = buildHouseModel3D(input);

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
export type HouseModel3DPergolaContext = {
  connectionType: ConnectionType;
  attachmentSide: AttachmentSide;
  attachmentEdge: Line3 | null;
  /** World-space `Polygon3` footprint after position has been applied (if any). */
  footprint: Polygon3 | null;
  /** Optional house-level world position; passed through to the model. */
  housePosition: AssemblyPosition | null;
  /** Soffit depth used for attachment-zone geometry; passed through verbatim. */
  soffitDepthMm: number | null;
  /** Eave-height fallback heights from `structural.heights`. */
  houseUndersideMm: number | null;
  referenceUndersideMm: number | null;
  outerUndersideMm: number | null;
  /** Datum frame the pergola contributes; used to derive the wall plane. */
  datum: GeometryConfig['datum'];
  /**
   * Pergola dimensions used by `buildSemanticHouseAttachmentEdge` to size
   * the host attachment edge. Decoupling this from the house body is
   * future work (the attachment-target geometry is the only field that
   * truly depends on pergola dimensions).
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
  pergolaContext: HouseModel3DPergolaContext;
}): HouseModel3D | null {
  const { rawHouse, pergolaContext } = input;

  // RawHouseInput is structurally a superset of
  // `RawGeometryModuleInput['houseContext']` (it adds `houseId`).
  // `buildHouseModelConfig` ignores `houseId`, so the cast is safe;
  // explicit so future changes to either type surface here.
  const rawHouseContextEquivalent: RawHouseInput = rawHouse;

  const houseModelConfig: HouseModelConfig | null = buildHouseModelConfig({
    rawHouseContext: rawHouseContextEquivalent,
    footprint: pergolaContext.footprint,
    connectionType: pergolaContext.connectionType,
    attachmentSide: pergolaContext.attachmentSide,
    houseUndersideMm: pergolaContext.houseUndersideMm,
    referenceUndersideMm: pergolaContext.referenceUndersideMm,
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
  //   - datum (used by buildHouseReferenceGeometry, but not buildHouseModel3D
  //     directly -- still provided via pergolaContext to keep the contract
  //     symmetrical with the legacy entry).
  const partialConfig: Pick<
    GeometryConfig,
    'connection' | 'houseContext' | 'structural' | 'datum' | 'dimensions'
  > = {
    connection: {
      type: pergolaContext.connectionType,
      attachmentSide: pergolaContext.attachmentSide,
    },
    datum: pergolaContext.datum,
    dimensions: {
      lengthMm: pergolaContext.pergolaLengthMm,
      projectionMm: pergolaContext.pergolaProjectionMm,
      roofPitchDeg: 0,
    },
    houseContext: {
      footprint: pergolaContext.footprint,
      footprintMode: null,
      footprintPolygon: null,
      position: pergolaContext.housePosition,
      soffitDepthMm: pergolaContext.soffitDepthMm,
      model: houseModelConfig,
      attachmentStrategy: rawHouse.attachmentStrategy ?? null,
      wallLine: null,
      fasciaLine: null,
      roofEdgeLine: null,
    },
    structural: {
      heights: {
        houseUndersideMm: pergolaContext.houseUndersideMm,
        outerUndersideMm: pergolaContext.outerUndersideMm,
        referenceUndersideMm: pergolaContext.referenceUndersideMm,
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
    config: partialConfig as GeometryConfig,
    attachmentEdge: pergolaContext.attachmentEdge,
  });
}
