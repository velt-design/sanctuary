import type {
  Assembly3D,
  GeometryMetadata,
  GeometryMetadataValue,
  HouseAttachmentTarget3D,
  HouseModel3D,
  Line3,
  Plane3,
  Point3,
  Polygon3,
  RenderMesh3D,
  ViewerSceneLayer,
  ViewerSceneHouseLineObject,
  ViewerSceneHouseLinearSolidObject,
  ViewerSceneHouseRoofMaterialObject,
  ViewerSceneHouseSurfaceObject,
  ViewerSceneHouseSurfaceSolidObject,
  ViewerSceneMemberPrismObject,
  ViewerSceneModel,
  ViewerSceneObject,
  ViewerSceneReferenceLineObject,
  ViewerSceneReferencePlaneObject,
  ViewerSceneRoofCladdingPanelObject,
  ViewerSceneRoofFlashingObject,
  ViewerSceneRoofPlaneObject,
  Vector3,
} from "./contracts";
import {
  GEOMETRY_EPSILON,
  lineLength,
  magnitude,
  normalizeVector,
  planeFromPoints,
  polygonArea,
  subtractPoints,
} from "./math3d";

const MIN_VIEWER_HOUSE_SURFACE_AREA_MM2 = 1;

function isFinitePoint(point: Point3): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.z)
  );
}

function isFiniteVector(vector: { x: number; y: number; z: number }): boolean {
  return (
    Number.isFinite(vector.x) &&
    Number.isFinite(vector.y) &&
    Number.isFinite(vector.z)
  );
}

function isFiniteLine(line: Line3): boolean {
  return isFinitePoint(line.start) && isFinitePoint(line.end);
}

function isFinitePlane(plane: Plane3): boolean {
  return (
    isFinitePoint(plane.origin) &&
    isFiniteVector(plane.xAxis) &&
    isFiniteVector(plane.yAxis) &&
    isFiniteVector(plane.normal) &&
    magnitude(plane.xAxis) > GEOMETRY_EPSILON &&
    magnitude(plane.yAxis) > GEOMETRY_EPSILON &&
    magnitude(plane.normal) > GEOMETRY_EPSILON
  );
}

function uniquePointCount(points: Point3[]): number {
  return new Set(
    points.map((point) => `${point.x.toFixed(6)},${point.y.toFixed(6)},${point.z.toFixed(6)}`),
  ).size;
}

function isRenderableHouseSurface(boundary: Polygon3, plane: Plane3): boolean {
  return (
    boundary.length >= 3 &&
    boundary.every(isFinitePoint) &&
    uniquePointCount(boundary) >= 3 &&
    polygonArea(boundary) > MIN_VIEWER_HOUSE_SURFACE_AREA_MM2 &&
    isFinitePlane(plane)
  );
}

function isRenderableHouseLine(line: Line3): boolean {
  return isFiniteLine(line) && lineLength(line) > GEOMETRY_EPSILON;
}

function dotProduct(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function axesAreOrthonormal(input: {
  xAxis: { x: number; y: number; z: number };
  yAxis: { x: number; y: number; z: number };
  zAxis: { x: number; y: number; z: number };
}): boolean {
  const xAxis = normalizeVector(input.xAxis);
  const yAxis = normalizeVector(input.yAxis);
  const zAxis = normalizeVector(input.zAxis);
  return (
    magnitude(xAxis) > GEOMETRY_EPSILON &&
    magnitude(yAxis) > GEOMETRY_EPSILON &&
    magnitude(zAxis) > GEOMETRY_EPSILON &&
    Math.abs(dotProduct(xAxis, yAxis)) <= 0.001 &&
    Math.abs(dotProduct(xAxis, zAxis)) <= 0.001 &&
    Math.abs(dotProduct(yAxis, zAxis)) <= 0.001
  );
}

function sortMetadataValue(
  value: GeometryMetadataValue,
): GeometryMetadataValue {
  if (typeof value === "number") {
    return Number(value.toFixed(6));
  }
  return value;
}

function sortMetadata(
  metadata: GeometryMetadata | undefined,
): GeometryMetadata | undefined {
  if (!metadata) return undefined;
  return Object.fromEntries(
    Object.entries(metadata)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [key, sortMetadataValue(value)]),
  );
}

function sortObjects(objects: ViewerSceneObject[]): ViewerSceneObject[] {
  return [...objects].sort((a, b) => a.id.localeCompare(b.id));
}

function roofFlashingsForScene(
  assembly: Assembly3D,
): NonNullable<Assembly3D["roofFlashings"]> {
  return [
    ...(assembly.roofFlashings ?? []),
    ...(assembly.house.model?.roofFlashings ?? []),
  ];
}

function maxAssemblyHeight(assembly: Assembly3D): number {
  const zValues: number[] = [];

  for (const point of assembly.outline) {
    zValues.push(point.z);
  }
  for (const member of assembly.members) {
    zValues.push(member.centerline.start.z, member.centerline.end.z);
  }
  for (const roofPlane of assembly.roofPlanes) {
    for (const point of roofPlane.boundary) {
      zValues.push(point.z);
    }
  }
  for (const panel of assembly.roofCladdingPanels ?? []) {
    for (const point of panel.boundary) {
      zValues.push(point.z);
    }
  }
  for (const flashing of roofFlashingsForScene(assembly)) {
    for (const wing of flashing.wings) {
      for (const point of wing.boundary) {
        zValues.push(point.z);
      }
    }
  }
  for (const visual of assembly.house.model?.roofMaterialVisuals ?? []) {
    for (const line of visual.lines) {
      zValues.push(line.start.z, line.end.z);
    }
  }
  if (assembly.attachmentEdge) {
    zValues.push(
      assembly.attachmentEdge.start.z,
      assembly.attachmentEdge.end.z,
    );
  }
  if (assembly.house.fasciaLine) {
    zValues.push(
      assembly.house.fasciaLine.start.z,
      assembly.house.fasciaLine.end.z,
    );
  }
  if (assembly.house.roofEdgeLine) {
    zValues.push(
      assembly.house.roofEdgeLine.start.z,
      assembly.house.roofEdgeLine.end.z,
    );
  }

  return zValues.length ? Math.max(...zValues) : 0;
}

function outlineLength(assembly: Assembly3D): number {
  const xValues = assembly.outline.map((point) => point.x);
  if (xValues.length < 2) return 0;
  return Math.max(...xValues) - Math.min(...xValues);
}

function pointFromOrigin(
  origin: Point3,
  xAxis: { x: number; y: number; z: number },
  xScale: number,
  yAxis: { x: number; y: number; z: number },
  yScale: number,
): Point3 {
  return {
    x: origin.x + xAxis.x * xScale + yAxis.x * yScale,
    y: origin.y + xAxis.y * xScale + yAxis.y * yScale,
    z: origin.z + xAxis.z * xScale + yAxis.z * yScale,
  };
}

function offsetPointAlongVector(
  origin: Point3,
  vector: Vector3,
  distanceMm: number,
): Point3 {
  return {
    x: origin.x + vector.x * distanceMm,
    y: origin.y + vector.y * distanceMm,
    z: origin.z + vector.z * distanceMm,
  };
}

function offsetPolygonAlongNormal(
  boundary: Polygon3,
  normal: Vector3,
  distanceMm: number,
): Polygon3 {
  return boundary.map((point) => offsetPointAlongVector(point, normal, distanceMm));
}

function buildHouseWallBoundary(assembly: Assembly3D, plane: Plane3): Polygon3 {
  const wallWidth = lineLength(
    assembly.house.fasciaLine ??
      assembly.house.roofEdgeLine ??
      assembly.attachmentEdge ?? {
        start: { x: 0, y: 0, z: 0 },
        end: { x: outlineLength(assembly), y: 0, z: 0 },
      },
  );
  const wallHeight = Math.max(maxAssemblyHeight(assembly) + 500, 1000);
  const xAxis = normalizeVector(plane.xAxis);
  const yAxis = normalizeVector(plane.yAxis);

  return [
    plane.origin,
    pointFromOrigin(plane.origin, xAxis, wallWidth, yAxis, 0),
    pointFromOrigin(plane.origin, xAxis, wallWidth, yAxis, wallHeight),
    pointFromOrigin(plane.origin, xAxis, 0, yAxis, wallHeight),
  ];
}

function buildMemberObject(
  assembly: Assembly3D["members"][number],
): ViewerSceneMemberPrismObject {
  const renderMode =
    assembly.profile.shape === "rectangular"
      ? "prism"
      : (assembly.profile.sectionOutline?.length ?? 0) >= 3
        ? "outline_extrusion"
        : "line_fallback";
  return {
    id: assembly.id,
    type: "member_prism",
    sourceId: assembly.id,
    role: assembly.role,
    centerline: assembly.centerline,
    profile: assembly.profile,
    localFrame: assembly.localFrame,
    lengthMm: Math.round(lineLength(assembly.centerline)),
    renderMode,
    endCuts: assembly.endCuts ?? undefined,
    metadata:
      renderMode === "line_fallback"
        ? sortMetadata({
            ...assembly.metadata,
            profileShapeFallback: true,
            unsupportedProfileShape: assembly.profile.shape,
          })
        : sortMetadata({
            ...assembly.metadata,
            ...(renderMode === "outline_extrusion"
              ? { renderedFromOutline: true }
              : {}),
          }),
  };
}

function buildRoofPlaneObject(
  roofPlane: Assembly3D["roofPlanes"][number],
): ViewerSceneRoofPlaneObject {
  return {
    id: roofPlane.id,
    type: "roof_plane",
    sourceId: roofPlane.id,
    boundary: roofPlane.boundary,
    plane: roofPlane.plane,
    fallVector: roofPlane.fallVector,
    metadata: sortMetadata(roofPlane.metadata),
  };
}

function buildRoofCladdingPanelObject(
  panel: Assembly3D["roofCladdingPanels"][number],
): ViewerSceneRoofCladdingPanelObject {
  return {
    id: panel.id,
    type: "roof_cladding_panel",
    sourceId: panel.id,
    material: panel.material,
    boundary: panel.boundary,
    thicknessMm: panel.thicknessMm,
    plane: panel.plane,
    metadata: sortMetadata(panel.metadata),
  };
}

function buildRoofFlashingObject(
  flashing: NonNullable<Assembly3D["roofFlashings"]>[number],
): ViewerSceneRoofFlashingObject {
  return {
    id: flashing.id,
    type: "roof_flashing",
    sourceId: flashing.id,
    wings: flashing.wings,
    thicknessMm: flashing.thicknessMm,
    metadata: sortMetadata(flashing.metadata),
  };
}

function buildHouseRoofMaterialObject(
  visual: NonNullable<NonNullable<Assembly3D["house"]["model"]>["roofMaterialVisuals"]>[number],
): ViewerSceneHouseRoofMaterialObject | null {
  const lines = visual.lines.filter(isRenderableHouseLine);
  if (lines.length === 0 || !isFinitePlane(visual.plane)) return null;
  return {
    id: visual.id,
    type: "house_roof_material",
    sourceId: visual.id,
    roofPlaneId: visual.roofPlaneId,
    material: visual.material,
    profileKind: visual.profileKind,
    lines,
    plane: visual.plane,
    spacingMm: visual.spacingMm,
    surfaceOffsetMm: visual.surfaceOffsetMm,
    metadata: sortMetadata({
      ...visual.metadata,
      lineCount: lines.length,
    }),
  };
}

export function buildHouseModelRoofMaterialSceneObjects(input: {
  model: HouseModel3D | null;
}): ViewerSceneHouseRoofMaterialObject[] {
  const model = input.model;
  if (!model) return [];

  const prefix = `${model.houseId}:`;
  return (model.roofMaterialVisuals ?? [])
    .map(buildHouseRoofMaterialObject)
    .filter((object): object is ViewerSceneHouseRoofMaterialObject => object !== null)
    .map((object) => ({
      ...object,
      id: object.id.startsWith(prefix) ? object.id : `${prefix}${object.id}`,
      sourceId: object.sourceId,
      metadata: {
        ...(object.metadata ?? {}),
        houseFormId:
          typeof object.metadata?.houseFormId === "string"
            ? object.metadata.houseFormId
            : model.houseId,
      },
    }));
}

function buildReferenceLineObject(
  id: string,
  kind: ViewerSceneReferenceLineObject["kind"],
  line: Line3,
): ViewerSceneReferenceLineObject {
  return {
    id,
    type: "reference_line",
    sourceId: id,
    kind,
    line,
  };
}

function buildReferencePlaneObject(
  id: string,
  kind: ViewerSceneReferencePlaneObject["kind"],
  plane: Plane3,
  boundary: Polygon3,
): ViewerSceneReferencePlaneObject {
  return {
    id,
    type: "reference_plane",
    sourceId: id,
    kind,
    plane,
    boundary,
  };
}

function planeFromPolygon(boundary: Polygon3): Plane3 | null {
  if (boundary.length < 3) return null;
  return planeFromPoints(boundary[0]!, boundary[1]!, boundary[2]!);
}

function buildHouseSurfaceObject(input: {
  id: string;
  sourceId?: string;
  kind: ViewerSceneHouseSurfaceObject["kind"];
  boundary: Polygon3;
  plane: Plane3;
  metadata?: GeometryMetadata;
}): ViewerSceneHouseSurfaceObject | null {
  if (!isRenderableHouseSurface(input.boundary, input.plane)) return null;
  return {
    id: input.id,
    type: "house_surface",
    sourceId: input.sourceId ?? input.id,
    kind: input.kind,
    boundary: input.boundary,
    plane: input.plane,
    metadata: sortMetadata(input.metadata),
  };
}

function buildHouseLineObject(input: {
  id: string;
  sourceId?: string;
  kind: ViewerSceneHouseLineObject["kind"];
  line: Line3;
  metadata?: GeometryMetadata;
}): ViewerSceneHouseLineObject | null {
  if (!isRenderableHouseLine(input.line)) return null;
  return {
    id: input.id,
    type: "house_line",
    sourceId: input.sourceId ?? input.id,
    kind: input.kind,
    line: input.line,
    metadata: sortMetadata(input.metadata),
  };
}

function isRenderableHouseLinearSolid(input: {
  centerline: Line3;
  localFrame: ViewerSceneHouseLinearSolidObject["localFrame"];
  profileWidthMm: number;
  profileDepthMm: number;
}): boolean {
  return (
    isRenderableHouseLine(input.centerline) &&
    Number.isFinite(input.profileWidthMm) &&
    Number.isFinite(input.profileDepthMm) &&
    input.profileWidthMm > 0 &&
    input.profileDepthMm > 0 &&
    isFinitePoint(input.localFrame.origin) &&
    isFiniteVector(input.localFrame.xAxis) &&
    isFiniteVector(input.localFrame.yAxis) &&
    isFiniteVector(input.localFrame.zAxis) &&
    magnitude(input.localFrame.xAxis) > GEOMETRY_EPSILON &&
    magnitude(input.localFrame.yAxis) > GEOMETRY_EPSILON &&
    magnitude(input.localFrame.zAxis) > GEOMETRY_EPSILON &&
    axesAreOrthonormal(input.localFrame)
  );
}

function renderMeshIsRenderable(mesh: RenderMesh3D | undefined): mesh is RenderMesh3D {
  return Boolean(
    mesh &&
      mesh.vertices.length >= 3 &&
      mesh.faces.length > 0 &&
      mesh.vertices.every(isFinitePoint) &&
      mesh.faces.every((face) =>
        face.every((index) => Number.isInteger(index) && index >= 0 && index < mesh.vertices.length),
      ),
  );
}

function buildHouseSurfaceSolidObject(input: {
  id: string;
  sourceId?: string;
  kind: ViewerSceneHouseSurfaceSolidObject["kind"];
  boundary: Polygon3;
  plane: Plane3;
  thicknessMm: number;
  renderMesh?: RenderMesh3D;
  metadata?: GeometryMetadata;
}): ViewerSceneHouseSurfaceSolidObject | null {
  if (
    !isRenderableHouseSurface(input.boundary, input.plane) ||
    !Number.isFinite(input.thicknessMm) ||
    input.thicknessMm <= 0
  ) {
    return null;
  }
  return {
    id: input.id,
    type: "house_surface_solid",
    sourceId: input.sourceId ?? input.id,
    kind: input.kind,
    boundary: input.boundary,
    plane: input.plane,
    thicknessMm: input.thicknessMm,
    ...(renderMeshIsRenderable(input.renderMesh) ? { renderMesh: input.renderMesh } : {}),
    metadata: sortMetadata(input.metadata),
  };
}

function buildHouseLinearSolidObject(input: {
  id: string;
  sourceId?: string;
  kind: ViewerSceneHouseLinearSolidObject["kind"];
  centerline: Line3;
  localFrame: ViewerSceneHouseLinearSolidObject["localFrame"];
  profileWidthMm: number;
  profileDepthMm: number;
  renderMesh?: RenderMesh3D;
  metadata?: GeometryMetadata;
}): ViewerSceneHouseLinearSolidObject | null {
  if (!isRenderableHouseLinearSolid(input)) return null;
  return {
    id: input.id,
    type: "house_linear_solid",
    sourceId: input.sourceId ?? input.id,
    kind: input.kind,
    centerline: input.centerline,
    localFrame: input.localFrame,
    profileWidthMm: input.profileWidthMm,
    profileDepthMm: input.profileDepthMm,
    ...(renderMeshIsRenderable(input.renderMesh) ? { renderMesh: input.renderMesh } : {}),
    metadata: sortMetadata(input.metadata),
  };
}

function metadataString(
  metadata: GeometryMetadata | undefined,
  key: string,
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

function metadataNumber(
  metadata: GeometryMetadata | undefined,
  key: string,
): number | null {
  const value = metadata?.[key];
  return typeof value === "number" ? value : null;
}

function houseRoofQaIsValid(model: NonNullable<Assembly3D["house"]["model"]>): boolean {
  return metadataString(model.metadata, "roofQaStatus") === "valid";
}

function buildHouseRoofOutlineObjects(
  model: NonNullable<Assembly3D["house"]["model"]>,
): ViewerSceneObject[] {
  if (houseRoofQaIsValid(model)) return [];
  const skippedCount = Math.max(0, model.roofPlanes.length);
  return (model.eave.gutterLines ?? [])
    .map((gutterLine, index) =>
      buildHouseLineObject({
        id: `house-roof-outline-${index + 1}`,
        kind: "roof_outline",
        line: gutterLine,
        metadata: {
          roofRenderSkipReason: "roof_qa_invalid",
          roofSolidSkippedCount: skippedCount,
          roofQaStatus: metadataString(model.metadata, "roofQaStatus") ?? "invalid",
          roofQaFailureReason: metadataString(model.metadata, "roofQaFailureReason"),
          roofQaFacetAreaMm2: metadataNumber(model.metadata, "roofQaFacetAreaMm2"),
          roofQaEaveAreaMm2: metadataNumber(model.metadata, "roofQaEaveAreaMm2"),
          roofQaAreaDeltaMm2: metadataNumber(model.metadata, "roofQaAreaDeltaMm2"),
          roofQaRejectedFacetCount: metadataNumber(model.metadata, "roofQaRejectedFacetCount"),
          roofTopologySolver: metadataString(model.metadata, "roofTopologySolver"),
          roofTopologySemanticQaStatus: metadataString(model.metadata, "roofTopologySemanticQaStatus"),
          roofTopologySemanticFailureReason: metadataString(model.metadata, "roofTopologySemanticFailureReason"),
          roofTopologyFailureReason: metadataString(model.metadata, "roofTopologyFailureReason"),
          roofTopologyFailureEdgeId: metadataString(model.metadata, "roofTopologyFailureEdgeId"),
          roofTopologyClosedFaceCount: metadataNumber(model.metadata, "roofTopologyClosedFaceCount"),
          roofTopologyExpectedFaceCount: metadataNumber(model.metadata, "roofTopologyExpectedFaceCount"),
          roofTopologyFinalFaceCount: metadataNumber(model.metadata, "roofTopologyFinalFaceCount"),
          roofTopologyCoverageQaStatus: metadataString(model.metadata, "roofTopologyCoverageQaStatus"),
          roofTopologyCoverageFailureReason: metadataString(model.metadata, "roofTopologyCoverageFailureReason"),
          roofTopologyExactPartitionQaStatus: metadataString(model.metadata, "roofTopologyExactPartitionQaStatus"),
          roofTopologyExactPartitionFailureReason: metadataString(model.metadata, "roofTopologyExactPartitionFailureReason"),
          roofTopologyExactPartitionFaceCount: metadataNumber(model.metadata, "roofTopologyExactPartitionFaceCount"),
          roofTopologyExactPartitionSemanticQaStatus: metadataString(model.metadata, "roofTopologyExactPartitionSemanticQaStatus"),
          roofTopologyExactPartitionSemanticFailureReason: metadataString(model.metadata, "roofTopologyExactPartitionSemanticFailureReason"),
          roofTopologyCoverageGapAreaMm2: metadataNumber(model.metadata, "roofTopologyCoverageGapAreaMm2"),
          roofTopologyCoverageOverlapAreaMm2: metadataNumber(model.metadata, "roofTopologyCoverageOverlapAreaMm2"),
          roofTopologyCoverageAreaDeltaMm2: metadataNumber(model.metadata, "roofTopologyCoverageAreaDeltaMm2"),
          roofTopologyValleyCount: metadataNumber(model.metadata, "roofTopologyValleyCount"),
          roofTopologyDisconnectedSourceFaceCount: metadataNumber(model.metadata, "roofTopologyDisconnectedSourceFaceCount"),
          roofTopologyInternalEaveHeightSegmentCount: metadataNumber(model.metadata, "roofTopologyInternalEaveHeightSegmentCount"),
          roofTopologyChordViolationCount: metadataNumber(model.metadata, "roofTopologyChordViolationCount"),
          roofTopologyUnbackedBoundaryCount: metadataNumber(model.metadata, "roofTopologyUnbackedBoundaryCount"),
          roofTopologyUnclassifiedFeatureCount: metadataNumber(model.metadata, "roofTopologyUnclassifiedFeatureCount"),
          eaveOffsetConstructionMethod: metadataString(model.metadata, "eaveOffsetConstructionMethod"),
          eaveOffsetTopologyStatus: metadataString(model.metadata, "eaveOffsetTopologyStatus"),
          eaveOffsetTopologyFailureReason: metadataString(model.metadata, "eaveOffsetTopologyFailureReason"),
          eaveOffsetRequestedOverhangMm: metadataNumber(model.metadata, "eaveOffsetRequestedOverhangMm"),
          eaveOffsetResolvedVertexCount: metadataNumber(model.metadata, "eaveOffsetResolvedVertexCount"),
        },
      }),
    )
    .filter((object): object is ViewerSceneHouseLineObject => object !== null);
}

function resolveWindowHostWallSegment(input: {
  model: NonNullable<Assembly3D["house"]["model"]>;
  hostEdgeId: string | null | undefined;
}): NonNullable<Assembly3D["house"]["model"]>["wallSegments"][number] | null {
  const hostEdgeId =
    typeof input.hostEdgeId === "string" && input.hostEdgeId.trim().length > 0
      ? input.hostEdgeId.trim()
      : null;
  if (!hostEdgeId) return null;
  return (
    input.model.wallSegments.find((segment) => {
      if (segment.metadata?.houseWallMode === "open_gable_frame") return false;
      return segment.sourceEdgeId === hostEdgeId;
    }) ?? null
  );
}

function buildHouseOpeningMarkerObjects(
  model: NonNullable<Assembly3D["house"]["model"]>,
): ViewerSceneObject[] {
  const objects: ViewerSceneObject[] = [];
  for (const opening of model.openings ?? []) {
    if (opening.validationStatus !== "valid") continue;
    const wallSegment = resolveWindowHostWallSegment({
      model,
      hostEdgeId: opening.hostEdgeId,
    });
    if (!wallSegment) continue;
    const widthMm = Math.max(0, opening.widthMm);
    const heightMm = Math.max(0, opening.heightMm);
    if (widthMm <= GEOMETRY_EPSILON || heightMm <= GEOMETRY_EPSILON) continue;

    const wallAxis = normalizeVector(subtractPoints(wallSegment.line.end, wallSegment.line.start));
    const verticalAxis = normalizeVector(wallSegment.plane.yAxis);
    const normal = normalizeVector(wallSegment.plane.normal);
    if (
      magnitude(wallAxis) <= GEOMETRY_EPSILON ||
      magnitude(verticalAxis) <= GEOMETRY_EPSILON ||
      magnitude(normal) <= GEOMETRY_EPSILON
    ) {
      continue;
    }

    const baseStart = offsetPointAlongVector(
      wallSegment.line.start,
      wallAxis,
      Math.max(0, opening.offsetAlongWallMm),
    );
    const lowerStart = offsetPointAlongVector(baseStart, verticalAxis, Math.max(0, opening.sillHeightMm));
    const lowerEnd = offsetPointAlongVector(lowerStart, wallAxis, widthMm);
    const upperEnd = offsetPointAlongVector(lowerEnd, verticalAxis, heightMm);
    const upperStart = offsetPointAlongVector(lowerStart, verticalAxis, heightMm);
    const markerBoundary = offsetPolygonAlongNormal(
      [lowerStart, lowerEnd, upperEnd, upperStart],
      normal,
      4,
    );
    const markerPlane = planeFromPolygon(markerBoundary);
    if (!markerPlane) continue;

    const metadata = {
      ...(opening.metadata ?? {}),
      openingId: opening.id,
      openingLabel: opening.label ?? opening.id,
      openingKind: opening.kind,
      openingPanelCount: opening.panelCount ?? null,
      openingWallId: opening.wallId,
      openingHostEdgeId: opening.hostEdgeId ?? null,
      sourceWallId: wallSegment.id,
      resolvedHostEdgeId: wallSegment.sourceEdgeId ?? null,
      openingValidationStatus: opening.validationStatus,
      openingValidationCodes: opening.validationCodes?.join(",") ?? null,
      openingValidationMessage: opening.validationMessage ?? null,
    };

    const surface = buildHouseSurfaceObject({
      id: `${opening.id}-marker`,
      sourceId: opening.id,
      kind: "opening_marker",
      boundary: markerBoundary,
      plane: markerPlane,
      metadata,
    });
    if (surface) objects.push(surface);

    const edges: Array<[Point3, Point3]> = [
      [markerBoundary[0]!, markerBoundary[1]!],
      [markerBoundary[1]!, markerBoundary[2]!],
      [markerBoundary[2]!, markerBoundary[3]!],
      [markerBoundary[3]!, markerBoundary[0]!],
    ];
    for (const [index, [start, end]] of edges.entries()) {
      const outline = buildHouseLineObject({
        id: `${opening.id}-outline-${index + 1}`,
        sourceId: opening.id,
        kind: "opening_outline",
        line: { start, end },
        metadata,
      });
      if (outline) objects.push(outline);
    }
  }
  return objects;
}

/**
 * Build the viewer scene objects for a `HouseModel3D` (walls, roof,
 * envelope, eave, attachment-target). Returns an empty array when
 * `model` is null so callers can spread the result unconditionally.
 *
 * Used directly by `buildLayers` for the active assembly (legacy
 * single-house path), and by the portal multi-form solver (PR8d) to
 * compose additional-form house objects onto each pergola's viewer
 * scene. The `attachmentTarget` override exists because the legacy
 * path prefers `assembly.house.attachmentTarget` when set (pergola-
 * attached configurations write the target there post-solve); for
 * standalone freestanding forms it's always null.
 */
export function buildHouseModelSceneObjects(input: {
  model: HouseModel3D | null;
  attachmentTarget?: HouseAttachmentTarget3D | null;
}): ViewerSceneObject[] {
  const model = input.model;
  if (!model) return [];

  const objects: ViewerSceneObject[] = [];
  const hasSolids =
    (model.solids?.surfaceSolids.length ?? 0) > 0 ||
    (model.solids?.linearSolids.length ?? 0) > 0;
  const skipRoofSolids = !houseRoofQaIsValid(model);

  for (const wall of model.wallSegments) {
    // Open-gable walls still emit their eave line — the bottom edge is a
    // valid wall edge for plan-detail rendering and deck-host snap targets.
    // The solid is generated by buildPolygonalWallRenderMesh below.
    const object = buildHouseLineObject({
      id: `${wall.id}-edge`,
      sourceId: wall.sourceEdgeId ?? wall.id,
      kind: "wall_segment",
      line: wall.line,
      metadata: {
        ...wall.metadata,
        sourceEdgeId: wall.sourceEdgeId ?? null,
        sourceWallId: wall.id,
        planDetailRole: "wall_edge",
        snapRole: "deck_host_edge",
      },
    });
    if (object) objects.push(object);
  }

  if (hasSolids) {
    for (const solid of model.solids?.surfaceSolids ?? []) {
      // PR-HR3 (2026-06-18): instead of skipping roof solids when QA
      // failed (which produced the "skeletal rafters with no surface"
      // render designers were seeing), include them and stamp metadata
      // so the renderer can apply a diagnostic tint. The pre-existing
      // outline objects from `buildHouseRoofOutlineObjects()` (line ~573)
      // still emit alongside as a redundant accessibility cue — they're
      // also consumed by the Plan viewport's fallback layer.
      const roofMetadata =
        solid.kind === "roof" && skipRoofSolids
          ? {
              ...solid.metadata,
              houseRoofRenderRole: "diagnostic",
              roofRenderSkipReason: "roof_qa_invalid",
              roofQaStatus: "invalid",
            }
          : solid.metadata;
      const object = buildHouseSurfaceSolidObject({
        id: solid.id,
        sourceId: solid.id,
        kind: solid.kind,
        boundary: solid.boundary,
        plane: solid.plane,
        thicknessMm: solid.thicknessMm,
        renderMesh: solid.renderMesh,
        metadata: roofMetadata,
      });
      if (object) objects.push(object);
    }

    for (const solid of model.solids?.linearSolids ?? []) {
      const object = buildHouseLinearSolidObject({
        id: solid.id,
        sourceId: solid.id,
        kind: solid.kind,
        centerline: solid.centerline,
        localFrame: solid.localFrame,
        profileWidthMm: solid.profileWidthMm,
        profileDepthMm: solid.profileDepthMm,
        renderMesh: solid.renderMesh,
        metadata: solid.metadata,
      });
      if (object) objects.push(object);
    }
  } else {
    // No-solids fallback path. Open-gable walls render as their pentagonal
    // boundary face here (flat surface, no thickness) — better than missing
    // the wall entirely while solids are unavailable.
    for (const wall of model.wallSegments) {
      const object = buildHouseSurfaceObject({
        id: wall.id,
        sourceId: wall.id,
        kind: "wall",
        boundary: wall.boundary,
        plane: wall.plane,
        metadata: {
          ...wall.metadata,
          sourceEdgeId: wall.sourceEdgeId ?? null,
        },
      });
      if (object) objects.push(object);
    }

    // PR-HR3 (2026-06-18): no-solids fallback path also emits roof
    // planes even when QA failed, stamped as diagnostic so the
    // renderer can tint them. Matches the with-solids path above.
    for (const roofPlane of model.roofPlanes) {
      const roofPlaneMetadata = skipRoofSolids
        ? {
            ...roofPlane.metadata,
            houseRoofRenderRole: "diagnostic",
            roofRenderSkipReason: "roof_qa_invalid",
            roofQaStatus: "invalid",
          }
        : roofPlane.metadata;
      const object = buildHouseSurfaceObject({
        id: roofPlane.id,
        sourceId: roofPlane.id,
        kind: "roof",
        boundary: roofPlane.boundary,
        plane: roofPlane.plane,
        metadata: roofPlaneMetadata,
      });
      if (object) objects.push(object);
    }

    for (const [index, boundary] of (model.eave.soffitPolygons ?? []).entries()) {
      const plane = planeFromPolygon(boundary);
      if (!plane) continue;
      const object = buildHouseSurfaceObject({
        id: `house-soffit-${index + 1}`,
        kind: "soffit",
        boundary,
        plane,
        metadata: {
          soffitDepthMm: model.eave.soffitDepthMm ?? null,
        },
      });
      if (object) objects.push(object);
    }

    for (const [index, boundary] of (model.eave.fasciaPolygons ?? []).entries()) {
      const plane = planeFromPolygon(boundary);
      if (!plane) continue;
      const object = buildHouseSurfaceObject({
        id: `house-fascia-${index + 1}`,
        kind: "fascia",
        boundary,
        plane,
        metadata: {
          fasciaHeightMm: model.eave.fasciaHeightMm ?? null,
        },
      });
      if (object) objects.push(object);
    }

    for (const deck of model.decks ?? []) {
      const object = buildHouseSurfaceObject({
        id: deck.id,
        sourceId: deck.id,
        kind: "deck",
        boundary: deck.boundary,
        plane: deck.plane,
        metadata: deck.metadata,
      });
      if (object) objects.push(object);
    }

    for (const [index, gutterLine] of (model.eave.gutterLines ?? []).entries()) {
      const object = buildHouseLineObject({
        id: `house-gutter-line-${index + 1}`,
        kind: "gutter",
        line: gutterLine,
        metadata: {
          gutterWidthMm: model.eave.gutterWidthMm ?? null,
          gutterDepthMm: model.eave.gutterDepthMm ?? null,
          gutterProjectionMm: model.eave.gutterProjectionMm ?? null,
        },
      });
      if (object) objects.push(object);
    }
  }

  objects.push(...buildHouseRoofOutlineObjects(model));
  objects.push(...buildHouseOpeningMarkerObjects(model));

  for (const feature of model.roofFeatures ?? []) {
    const object = buildHouseLineObject({
      id: feature.id,
      sourceId: feature.id,
      kind: "roof_feature",
      line: feature.line,
      metadata: {
        ...feature.metadata,
        featureKind: feature.kind,
      },
    });
    if (object) objects.push(object);
  }

  const target = input.attachmentTarget ?? model.attachmentTarget;
  if (target?.line) {
    const object = buildHouseLineObject({
      id: "house-attachment-target-line",
      kind: "attachment_target",
      line: target.line,
      metadata: {
        strategy: target.strategy,
        kind: target.kind,
        sourceEdgeId: target.sourceEdgeId ?? null,
      },
    });
    if (object) objects.push(object);
  }

  // PR-Geo1 (2026-05-25) — scene-assembly seam: prefix every emitted scene
  // object's id with the source house id. This is what makes multi-house
  // scenes work without colliding React keys, selection ambiguity, or
  // hover bridge confusion. The naked id is preserved as `sourceId` so the
  // 3D viewport's cross-viewport hover matcher (which compares against
  // plan-emitted workbench-level ids like "deck-1") keeps working.
  //
  // When a helper already set `sourceId` (e.g. surface solids set it to
  // their kind-specific id), we preserve that — the in-house identity
  // stays stable; only the globally-unique `id` becomes prefixed.
  const prefix = `${model.houseId}:`;
  return objects.map((object) => {
    const existingSourceId =
      'sourceId' in object && typeof object.sourceId === 'string'
        ? object.sourceId
        : typeof object.metadata?.sourceId === 'string'
          ? object.metadata.sourceId
          : null;
    // PR-Bug2 (2026-05-25): tag every house-derived scene object with the
    // source model's `houseId` so the top-projection classifier can resolve
    // clicks on multi-house scenes to the correct form. Without this tag,
    // additional house forms' shapes carry no per-form discriminator and the
    // portal-layer enrichment in `buildTopProjectionFromSolvedScene` falls
    // back to the primary house id — so clicking House 2 selects House 1.
    // Preserve any existing `houseFormId` (e.g. shapes a future helper sets
    // explicitly) so this only fills gaps.
    const existingHouseFormId =
      typeof object.metadata?.houseFormId === 'string' ? object.metadata.houseFormId : null;
    return {
      ...object,
      id: `${prefix}${object.id}`,
      sourceId: existingSourceId ?? object.id,
      metadata: {
        ...(object.metadata ?? {}),
        houseFormId: existingHouseFormId ?? model.houseId,
      },
    };
  });
}

function hiddenSupportBeamIdsForIntegratedSpGutters(
  assembly: Assembly3D,
): Set<string> {
  const hiddenIds = new Set<string>();
  const outerGutter = assembly.members.find(
    (member) =>
      member.id === "outer-gutter" &&
      member.role === "gutter" &&
      member.profile.profileKey === "sp_gutter",
  );
  if (outerGutter) {
    hiddenIds.add("outer-beam");
  }

  const houseGutter = assembly.members.find(
    (member) =>
      member.id === "house-gutter" &&
      member.role === "gutter" &&
      member.profile.profileKey === "sp_gutter",
  );
  if (houseGutter) {
    hiddenIds.add("house-beam");
  }

  return hiddenIds;
}

function buildLayers(
  assembly: Assembly3D,
  additionalHouseModels: ReadonlyArray<HouseModel3D> = [],
): ViewerSceneLayer[] {
  const houseObjects: ViewerSceneObject[] = [];
  const postObjects = assembly.members
    .filter((member) => member.role === "post")
    .map(buildMemberObject);
  const hiddenSupportBeamIds =
    hiddenSupportBeamIdsForIntegratedSpGutters(assembly);
  const beamObjects = assembly.members
    .filter((member) => {
      if (
        !(
          member.role === "beam" ||
          member.role === "ledger" ||
          member.role === "ridge" ||
          member.role === "brace"
        )
      ) {
        return false;
      }
      if (member.role === "beam" && hiddenSupportBeamIds.has(member.id)) {
        return false;
      }
      return true;
    })
    .map(buildMemberObject);
  const supportBeamObjects =
    hiddenSupportBeamIds.size > 0
      ? assembly.members
          .filter(
            (member) =>
              member.role === "beam" && hiddenSupportBeamIds.has(member.id),
          )
          .map(buildMemberObject)
      : [];
  const rafterObjects = assembly.members
    .filter((member) => member.role === "rafter")
    .map(buildMemberObject);
  const joinerObjects = assembly.members
    .filter((member) => member.role === "joiner")
    .map(buildMemberObject);
  const gutterObjects = assembly.members
    .filter((member) => member.role === "gutter")
    .map(buildMemberObject);
  const roofCladdingObjects = (assembly.roofCladdingPanels ?? []).map(
    buildRoofCladdingPanelObject,
  );
  const roofFlashingObjects = roofFlashingsForScene(assembly).map(
    buildRoofFlashingObject,
  );
  const houseRoofMaterialObjects = (assembly.house.model?.roofMaterialVisuals ?? [])
    .map(buildHouseRoofMaterialObject)
    .filter((object): object is ViewerSceneHouseRoofMaterialObject => object !== null);
  const roofPlaneObjects = assembly.roofPlanes.map(buildRoofPlaneObject);
  const attachmentObjects = assembly.attachmentEdge
    ? [
        buildReferenceLineObject(
          "attachment-edge",
          "attachment_edge",
          assembly.attachmentEdge,
        ),
      ]
    : [];

  const houseModelObjects = buildHouseModelSceneObjects({
    model: assembly.house.model ?? null,
    attachmentTarget: assembly.house.attachmentTarget,
  });
  if (houseModelObjects.length > 0) {
    houseObjects.push(...houseModelObjects);
  } else {
    if (
      assembly.house.wallPlane &&
      magnitude(assembly.house.wallPlane.normal) > 0
    ) {
      houseObjects.push(
        buildReferencePlaneObject(
          "house-wall-plane",
          "house_wall",
          assembly.house.wallPlane,
          buildHouseWallBoundary(assembly, assembly.house.wallPlane),
        ),
      );
    }

    if (assembly.house.fasciaLine) {
      houseObjects.push(
        buildReferenceLineObject(
          "house-fascia-line",
          "fascia",
          assembly.house.fasciaLine,
        ),
      );
    }

    if (assembly.house.roofEdgeLine) {
      houseObjects.push(
        buildReferenceLineObject(
          "house-roof-edge-line",
          "roof_edge",
          assembly.house.roofEdgeLine,
        ),
      );
    }
  }

  // PR-G3a (2026-05-22): scene builder iterates project-level house forms
  // beyond the active pergola's host. Closes audit row N9 (viewer reads
  // only `assembly.house.model` for one pergola) + N10 (portal-layer
  // `composeAdditionalHouseFormsIntoScene` workaround). Additional forms
  // aren't pergola-attached, so `attachmentTarget: null`.
  for (const additionalModel of additionalHouseModels) {
    houseObjects.push(
      ...buildHouseModelSceneObjects({
        model: additionalModel,
        attachmentTarget: null,
      }),
    );
    houseRoofMaterialObjects.push(
      ...buildHouseModelRoofMaterialSceneObjects({
        model: additionalModel,
      }),
    );
  }

  const layers: ViewerSceneLayer[] = [
    {
      id: "house",
      label: "House",
      visibleByDefault: true,
      objects: sortObjects(houseObjects),
    },
    {
      id: "posts",
      label: "Posts",
      visibleByDefault: true,
      objects: sortObjects(postObjects),
    },
    {
      id: "beams",
      label: "Beams",
      visibleByDefault: true,
      objects: sortObjects(beamObjects),
    },
  ];

  if (supportBeamObjects.length > 0) {
    layers.push({
      id: "support_beams",
      label: "Support Beams",
      visibleByDefault: false,
      objects: sortObjects(supportBeamObjects),
    });
  }

  layers.push(
    {
      id: "rafters",
      label: "Rafters",
      visibleByDefault: true,
      objects: sortObjects(rafterObjects),
    },
    {
      id: "joiners",
      label: "Joiners",
      visibleByDefault: true,
      objects: sortObjects(joinerObjects),
    },
    {
      id: "gutters",
      label: "Gutters",
      visibleByDefault: true,
      objects: sortObjects(gutterObjects),
    },
    {
      id: "roof_cladding",
      label: "Roof Cladding",
      visibleByDefault: true,
      objects: sortObjects(roofCladdingObjects),
    },
    ...(houseRoofMaterialObjects.length > 0
      ? [
          {
            id: "house_roof_materials",
            label: "House Roof Materials",
            visibleByDefault: true,
            objects: sortObjects(houseRoofMaterialObjects),
          },
        ]
      : []),
    ...(roofFlashingObjects.length > 0
      ? [
          {
            id: "roof_flashings",
            label: "Roof Flashings",
            visibleByDefault: true,
            objects: sortObjects(roofFlashingObjects),
          },
        ]
      : []),
    {
      id: "roof_planes",
      label: "Roof Planes",
      visibleByDefault: (assembly.roofCladdingPanels?.length ?? 0) === 0,
      objects: sortObjects(roofPlaneObjects),
    },
    {
      id: "attachment_edge",
      label: "Attachment Edge",
      visibleByDefault: true,
      objects: sortObjects(attachmentObjects),
    },
  );

  return layers;
}

function buildViewerSceneMetadata(
  assembly: Assembly3D,
  layers: ViewerSceneLayer[],
): GeometryMetadata | undefined {
  const model = assembly.house.model;
  if (!model) return undefined;

  const qaStatus = metadataString(model.metadata, "roofQaStatus") ?? "invalid";
  const expectedRoofSolidCount = model.roofPlanes.length;
  const allRoofSurfaceSolids = layers
    .flatMap((layer) => layer.objects)
    .filter(
      (object) =>
        object.type === "house_surface_solid" && object.kind === "roof",
    );
  const renderedRoofSolidCount = allRoofSurfaceSolids.length;
  // PR-HR3 (2026-06-18): roof solids stamped with
  // `houseRoofRenderRole === "diagnostic"` are best-effort renders
  // emitted when QA failed. They count toward the scene/rendered
  // totals (they ARE in the scene), and additionally surface a
  // dedicated diagnostic count so observability can distinguish
  // "rendered as committed" from "rendered as diagnostic."
  const renderedRoofSolidDiagnosticCount = allRoofSurfaceSolids.filter(
    (object) =>
      metadataString(object.metadata, "houseRoofRenderRole") === "diagnostic",
  ).length;
  const skippedRoofSolidCount = Math.max(
    0,
    expectedRoofSolidCount - renderedRoofSolidCount,
  );
  const totalOpeningCount = model.openings?.length ?? 0;
  const validOpeningCount =
    model.openings?.filter((opening) => opening.validationStatus === "valid").length ?? 0;
  const resolvedOpeningHostEdgeCount =
    model.openings?.filter(
      (opening) =>
        opening.validationStatus === "valid" &&
        typeof opening.hostEdgeId === "string" &&
        opening.hostEdgeId.trim().length > 0,
    ).length ?? 0;
  const skippedInvalidOpeningCount = Math.max(0, totalOpeningCount - validOpeningCount);
  const renderedOpeningMarkerCount = new Set(
    layers
      .flatMap((layer) => layer.objects)
      .filter(
        (object): object is ViewerSceneHouseSurfaceObject =>
          object.type === "house_surface" && object.kind === "opening_marker",
      )
      .map((object) => metadataString(object.metadata, "openingId"))
      .filter((openingId): openingId is string => Boolean(openingId)),
  ).size;
  const unresolvedValidOpeningCount = Math.max(
    0,
    validOpeningCount - renderedOpeningMarkerCount,
  );

  return sortMetadata({
    houseRoofQaStatus: qaStatus,
    houseRoofQaFailureReason: metadataString(model.metadata, "roofQaFailureReason"),
    houseRoofGeometryKind: metadataString(model.metadata, "roofGeometry"),
    houseRoofTopologySolver: metadataString(model.metadata, "roofTopologySolver"),
    houseRoofTopologySemanticQaStatus: metadataString(model.metadata, "roofTopologySemanticQaStatus"),
    houseRoofTopologySemanticFailureReason: metadataString(model.metadata, "roofTopologySemanticFailureReason"),
    houseRoofTopologyFailureReason: metadataString(model.metadata, "roofTopologyFailureReason"),
    houseRoofTopologyFailureEdgeId: metadataString(model.metadata, "roofTopologyFailureEdgeId"),
    houseRoofTopologyClosedFaceCount: metadataNumber(model.metadata, "roofTopologyClosedFaceCount"),
    houseRoofTopologyExpectedFaceCount: metadataNumber(model.metadata, "roofTopologyExpectedFaceCount"),
    houseRoofTopologyFinalFaceCount: metadataNumber(model.metadata, "roofTopologyFinalFaceCount"),
    houseRoofTopologyCoverageQaStatus: metadataString(model.metadata, "roofTopologyCoverageQaStatus"),
    houseRoofTopologyCoverageFailureReason: metadataString(model.metadata, "roofTopologyCoverageFailureReason"),
    houseRoofTopologyExactPartitionQaStatus: metadataString(model.metadata, "roofTopologyExactPartitionQaStatus"),
    houseRoofTopologyExactPartitionFailureReason: metadataString(model.metadata, "roofTopologyExactPartitionFailureReason"),
    houseRoofTopologyExactPartitionFaceCount: metadataNumber(model.metadata, "roofTopologyExactPartitionFaceCount"),
    houseRoofTopologyExactPartitionSemanticQaStatus: metadataString(model.metadata, "roofTopologyExactPartitionSemanticQaStatus"),
    houseRoofTopologyExactPartitionSemanticFailureReason: metadataString(model.metadata, "roofTopologyExactPartitionSemanticFailureReason"),
    houseRoofTopologyCoverageGapAreaMm2: metadataNumber(model.metadata, "roofTopologyCoverageGapAreaMm2"),
    houseRoofTopologyCoverageOverlapAreaMm2: metadataNumber(model.metadata, "roofTopologyCoverageOverlapAreaMm2"),
    houseRoofTopologyCoverageAreaDeltaMm2: metadataNumber(model.metadata, "roofTopologyCoverageAreaDeltaMm2"),
    houseRoofTopologyValleyCount: metadataNumber(model.metadata, "roofTopologyValleyCount"),
    houseRoofTopologyDisconnectedSourceFaceCount: metadataNumber(model.metadata, "roofTopologyDisconnectedSourceFaceCount"),
    houseRoofTopologyInternalEaveHeightSegmentCount: metadataNumber(model.metadata, "roofTopologyInternalEaveHeightSegmentCount"),
    houseRoofTopologyChordViolationCount: metadataNumber(model.metadata, "roofTopologyChordViolationCount"),
    houseRoofTopologyUnbackedBoundaryCount: metadataNumber(model.metadata, "roofTopologyUnbackedBoundaryCount"),
    houseRoofTopologyUnclassifiedFeatureCount: metadataNumber(model.metadata, "roofTopologyUnclassifiedFeatureCount"),
    houseEaveOffsetConstructionMethod: metadataString(model.metadata, "eaveOffsetConstructionMethod"),
    houseEaveOffsetTopologyStatus: metadataString(model.metadata, "eaveOffsetTopologyStatus"),
    houseEaveOffsetTopologyFailureReason: metadataString(model.metadata, "eaveOffsetTopologyFailureReason"),
    houseEaveOffsetRequestedOverhangMm: metadataNumber(model.metadata, "eaveOffsetRequestedOverhangMm"),
    houseEaveOffsetResolvedVertexCount: metadataNumber(model.metadata, "eaveOffsetResolvedVertexCount"),
    houseRoofWavefrontEventCount: metadataNumber(model.metadata, "roofWavefrontEventCount"),
    houseRoofWavefrontFailureReason: metadataString(model.metadata, "roofWavefrontFailureReason"),
    houseRoofSolidExpectedCount: expectedRoofSolidCount,
    houseRoofSolidSceneCount: renderedRoofSolidCount,
    houseRoofSolidRenderedCount: renderedRoofSolidCount,
    houseRoofSolidSkippedCount: skippedRoofSolidCount,
    houseRoofSolidDiagnosticCount: renderedRoofSolidDiagnosticCount,
    houseOpeningCount: totalOpeningCount,
    houseOpeningValidCount: validOpeningCount,
    houseOpeningHostEdgeResolvedCount: resolvedOpeningHostEdgeCount,
    houseOpeningHostEdgeUnresolvedCount: Math.max(0, validOpeningCount - resolvedOpeningHostEdgeCount),
    houseOpeningRenderedMarkerCount: renderedOpeningMarkerCount,
    houseOpeningSkippedInvalidCount: skippedInvalidOpeningCount,
    houseOpeningUnresolvedValidCount: unresolvedValidOpeningCount,
  });
}

export type BuildViewerSceneModelOptions = {
  /**
   * Additional house models to compose into the scene's house layer
   * beyond the host house in `assembly.house.model`. Used by the workbench
   * to render multi-form scenes where the active pergola's assembly only
   * carries its host house — every other form attaches via this list.
   * Each model is rendered with `attachmentTarget: null` (additional forms
   * aren't pergola-attached).
   */
  additionalHouseModels?: ReadonlyArray<HouseModel3D>;
};

export function buildViewerSceneModel(
  assembly: Assembly3D,
  options?: BuildViewerSceneModelOptions,
): ViewerSceneModel {
  const layers = buildLayers(assembly, options?.additionalHouseModels ?? []);
  return {
    layers,
    metadata: buildViewerSceneMetadata(assembly, layers),
  };
}
