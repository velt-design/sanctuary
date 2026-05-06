import type {
  AttachmentSide,
  DatumFrame3,
  GeometryConfig,
  GeometryMetadata,
  HouseDeck3D,
  HouseDeckConfig,
  HouseAttachmentStrategy,
  HouseAttachmentTarget3D,
  HouseModel3D,
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
  RenderMesh3D,
  RoofFlashing3D,
  RoofPlane3D,
  Vector3,
} from './contracts';
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


function monoPerimeterProjection(edge: HouseRoofPerimeterEdge, fallAxisXY: Vector3): number {
  const midpointX = (edge.roofStart.x + edge.roofEnd.x) / 2;
  const midpointY = (edge.roofStart.y + edge.roofEnd.y) / 2;
  return midpointX * fallAxisXY.x + midpointY * fallAxisXY.y;
}

function monoPerimeterAlignment(edge: HouseRoofPerimeterEdge, axisXY: Vector3): number {
  const edgeVector = normalizeVector({
    x: edge.roofEnd.x - edge.roofStart.x,
    y: edge.roofEnd.y - edge.roofStart.y,
    z: 0,
  });
  return Math.abs(dotProduct(edgeVector, axisXY));
}

function monoWeatherFlashingRole(
  edge: HouseRoofPerimeterEdge,
  fallAxisXY: Vector3,
): HouseRoofPerimeterFlashingRole {
  const acrossAxisXY = normalizeVector({ x: -fallAxisXY.y, y: fallAxisXY.x, z: 0 });
  return monoPerimeterAlignment(edge, acrossAxisXY) >= monoPerimeterAlignment(edge, fallAxisXY)
    ? 'high_side'
    : 'rake';
}

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







function buildHouseEnvelopeSolids(input: {
  wallSegments: HouseWallSegment3D[];
  roofPlanes: RoofPlane3D[];
  roofForm: HouseRoofForm;
  decks: HouseDeck3D[];
  perimeterEdges: HouseRoofPerimeterEdge[];
  soffitPolygons: HouseRoofPerimeterPolygon[];
  fasciaPolygons: HouseRoofPerimeterPolygon[];
  gutterLines: HouseRoofPerimeterLine[];
  gutterBoundaries: HouseRoofPerimeterPolygon[];
  gutterWidthMm: number;
  gutterDepthMm: number;
}): NonNullable<HouseModel3D['solids']> {
  const surfaceSolids: NonNullable<HouseModel3D['solids']>['surfaceSolids'] = [];
  const linearSolids: NonNullable<HouseModel3D['solids']>['linearSolids'] = [];
  const wallMiterFootprints = buildMiteredStripFootprints(
    input.wallSegments.map((segment) => segment.line.start),
    DEFAULT_WALL_SOLID_THICKNESS_MM / 2,
  );
  const fasciaMiterFootprints = buildPerimeterOffsetStripFootprints({
    edges: input.perimeterEdges,
    outerOffsetMm: DEFAULT_FASCIA_SOLID_THICKNESS_MM / 2,
    innerOffsetMm: -DEFAULT_FASCIA_SOLID_THICKNESS_MM / 2,
  });
  const roofSolidAdjacency = buildRoofSolidAdjacency(input.roofPlanes);
  const roofBottomPlanes = input.roofPlanes.map((roofPlane) =>
    roofSolidBottomPlaneEquation(roofPlane.plane, DEFAULT_ROOF_SOLID_THICKNESS_MM),
  );
  const perimeterEdgeRoles = new Map<string, HouseRoofPerimeterEdgeKind>();
  for (const edge of input.perimeterEdges) {
    if (!edge.sourceRoofPlaneId) continue;
    perimeterEdgeRoles.set(`${edge.sourceRoofPlaneId}:${edge.index}`, edge.edgeKind);
  }

  for (const [index, wall] of input.wallSegments.entries()) {
    if (houseWallIsOpenGableFrame(wall)) continue;
    const zRange = boundaryZRange(wall.boundary);
    const renderMesh =
      zRange &&
      wallBoundaryHasFlatTop(wall.boundary) &&
      wallMiterFootprints?.length === input.wallSegments.length
        ? buildVerticalPrismRenderMesh(wallMiterFootprints[index]!, zRange.bottomZ, zRange.topZ)
        : undefined;
    surfaceSolids.push({
      id: `house-solid-${wall.id}`,
      kind: 'wall',
      boundary: wall.boundary,
      plane: wall.plane,
      thicknessMm: DEFAULT_WALL_SOLID_THICKNESS_MM,
      ...(renderMesh ? { renderMesh } : {}),
      metadata: {
        sourceId: wall.id,
        sourceEdgeId: wall.sourceEdgeId ?? null,
      },
    });
  }

  for (const [roofPlaneIndex, roofPlane] of input.roofPlanes.entries()) {
    const renderMesh = buildRoofSolidRenderMesh({
      roofPlanes: input.roofPlanes,
      roofPlaneIndex,
      adjacency: roofSolidAdjacency,
      bottomPlanes: roofBottomPlanes,
      includeBottomFaces: input.roofForm !== 'mono',
      perimeterEdgeRoles,
    });
    surfaceSolids.push({
      id: `house-solid-${roofPlane.id}`,
      kind: 'roof',
      boundary: roofPlane.boundary,
      plane: roofPlane.plane,
      thicknessMm: DEFAULT_ROOF_SOLID_THICKNESS_MM,
      ...(renderMesh ? { renderMesh } : {}),
      metadata: {
        ...roofPlane.metadata,
        sourceId: roofPlane.id,
      },
    });
  }

  for (const deck of input.decks) {
    const renderMesh = buildVerticalPrismRenderMesh(
      deck.boundary,
      deck.topSurfaceElevationMm - DEFAULT_DECK_SURFACE_THICKNESS_MM,
      deck.topSurfaceElevationMm,
    );
    surfaceSolids.push({
      id: `house-solid-${deck.id}`,
      kind: 'deck',
      boundary: deck.boundary,
      plane: deck.plane,
      thicknessMm: DEFAULT_DECK_SURFACE_THICKNESS_MM,
      ...(renderMesh ? { renderMesh } : {}),
      metadata: {
        ...deck.metadata,
        sourceId: deck.id,
      },
    });
  }

  for (const [index, soffit] of input.soffitPolygons.entries()) {
    const boundary = soffit.boundary;
    const plane = planeFromBoundary(boundary);
    if (!plane) continue;
    const z = boundary[0]?.z;
    const renderMesh =
      typeof z === 'number' &&
      Number.isFinite(z) &&
      boundary.every((candidate) => Math.abs(candidate.z - z) <= 1e-6)
      ? buildVerticalPrismRenderMesh(
          boundary,
          z - DEFAULT_SOFFIT_SOLID_THICKNESS_MM / 2,
          z + DEFAULT_SOFFIT_SOLID_THICKNESS_MM / 2,
        )
      : undefined;
    surfaceSolids.push({
      id: `house-solid-soffit-${index + 1}`,
      kind: 'soffit',
      boundary,
      plane,
      thicknessMm: DEFAULT_SOFFIT_SOLID_THICKNESS_MM,
      ...(renderMesh ? { renderMesh } : {}),
      metadata: {
        sourceId: `house-soffit-${index + 1}`,
        sourceEdgeId: soffit.sourceEdgeId,
        houseRoofEdgeKind: soffit.edgeKind,
        houseRoofPerimeterRole: soffit.edgeKind,
        sourceRoofPlaneId: soffit.sourceRoofPlaneId ?? null,
        flashingRole: soffit.flashingRole ?? null,
        houseRoofSoffitMode: soffit.houseRoofSoffitMode ?? null,
      },
    });
  }

  for (const [index, fascia] of input.fasciaPolygons.entries()) {
    const boundary = fascia.boundary;
    const plane = planeFromBoundary(boundary);
    if (!plane) continue;
    const zRange = boundaryZRange(boundary);
    const renderMesh =
      zRange && fasciaMiterFootprints.length === input.fasciaPolygons.length
        ? buildVerticalPrismRenderMesh(fasciaMiterFootprints[index]!.boundary, zRange.bottomZ, zRange.topZ)
        : undefined;
    surfaceSolids.push({
      id: `house-solid-fascia-${index + 1}`,
      kind: 'fascia',
      boundary,
      plane,
      thicknessMm: DEFAULT_FASCIA_SOLID_THICKNESS_MM,
      ...(renderMesh ? { renderMesh } : {}),
      metadata: {
        sourceId: `house-fascia-${index + 1}`,
        sourceEdgeId: fascia.sourceEdgeId,
        houseRoofEdgeKind: fascia.edgeKind,
        houseRoofPerimeterRole: fascia.edgeKind,
        flashingRole: fascia.flashingRole ?? null,
        sourceRoofPlaneId: fascia.sourceRoofPlaneId ?? null,
      },
    });
  }

  for (const [index, gutter] of input.gutterLines.entries()) {
    const boundary = input.gutterBoundaries[index]?.boundary;
    const start = gutter.line.start;
    const end = gutter.line.end;
    const gutterLine = line(
      point(start.x, start.y, start.z - input.gutterDepthMm / 2),
      point(end.x, end.y, end.z - input.gutterDepthMm / 2),
    );
    if (lineLength(gutterLine) <= 1e-6) continue;
    const xAxis = normalizeVector(subtractPoints(gutterLine.end, gutterLine.start));
    const perimeterEdge = input.perimeterEdges.find((edge) => edge.sourceEdgeId === gutter.sourceEdgeId);
    const sourcePolygon = perimeterEdge?.perimeterPolygon ?? [];
    const sourceEdgeIndex = perimeterEdge?.index ?? sourceEdgeIndexFromId(gutter.sourceEdgeId, sourcePolygon.length);
    const yAxis =
      sourceEdgeIndex === null || sourcePolygon.length === 0
        ? { x: 0, y: 1, z: 0 }
        : edgeOutwardVector(sourcePolygon, sourceEdgeIndex);
    const localFrame: DatumFrame3 = {
      origin: gutterLine.start,
      xAxis,
      yAxis,
      zAxis: WORLD_Z,
    };
    const gutterBoundaryTopZ = boundary?.[0]?.z;
    const renderMesh =
      boundary && typeof gutterBoundaryTopZ === 'number' && Number.isFinite(gutterBoundaryTopZ)
        ? buildVerticalPrismRenderMesh(
          boundary,
          gutterBoundaryTopZ - input.gutterDepthMm,
          gutterBoundaryTopZ,
        )
        : undefined;
    linearSolids.push({
      id: `house-solid-gutter-${linearSolids.length + 1}`,
      kind: 'gutter',
      centerline: gutterLine,
      localFrame,
      profileWidthMm: input.gutterWidthMm,
      profileDepthMm: input.gutterDepthMm,
      ...(renderMesh ? { renderMesh } : {}),
      metadata: {
        sourceId: `house-gutter-line-${index + 1}`,
        sourceEdgeId: gutter.sourceEdgeId,
        houseRoofEdgeKind: gutter.edgeKind,
        houseRoofPerimeterRole: gutter.edgeKind,
        flashingRole: gutter.flashingRole ?? null,
        sourceRoofPlaneId: gutter.sourceRoofPlaneId ?? null,
      },
    });
  }

  return { surfaceSolids, linearSolids };
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
  if (input.config.connection.type === 'freestanding') {
    return {
      wallPlane: null,
      fasciaLine: null,
      roofEdgeLine: null,
      soffitDepthMm: input.config.houseContext.soffitDepthMm ?? null,
      footprint: input.config.houseContext.footprint ?? null,
      model: null,
      attachmentTarget: null,
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
  };
}
