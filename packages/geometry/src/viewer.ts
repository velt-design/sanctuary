import type {
  Assembly3D,
  GeometryMetadata,
  GeometryMetadataValue,
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
} from "./contracts";
import {
  GEOMETRY_EPSILON,
  lineLength,
  magnitude,
  normalizeVector,
  planeFromPoints,
  polygonArea,
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
          roofTopologyFinalFaceCount: metadataNumber(model.metadata, "roofTopologyFinalFaceCount"),
          roofTopologyValleyCount: metadataNumber(model.metadata, "roofTopologyValleyCount"),
          roofTopologyDisconnectedSourceFaceCount: metadataNumber(model.metadata, "roofTopologyDisconnectedSourceFaceCount"),
          roofTopologyInternalEaveHeightSegmentCount: metadataNumber(model.metadata, "roofTopologyInternalEaveHeightSegmentCount"),
        },
      }),
    )
    .filter((object): object is ViewerSceneHouseLineObject => object !== null);
}

function buildHouseModelObjects(
  assembly: Assembly3D,
): ViewerSceneObject[] | null {
  const model = assembly.house.model;
  if (!model) return null;

  const objects: ViewerSceneObject[] = [];
  const hasSolids =
    (model.solids?.surfaceSolids.length ?? 0) > 0 ||
    (model.solids?.linearSolids.length ?? 0) > 0;
  const skipRoofSolids = !houseRoofQaIsValid(model);

  if (hasSolids) {
    for (const solid of model.solids?.surfaceSolids ?? []) {
      if (solid.kind === "roof" && skipRoofSolids) continue;
      const object = buildHouseSurfaceSolidObject({
        id: solid.id,
        sourceId: solid.id,
        kind: solid.kind,
        boundary: solid.boundary,
        plane: solid.plane,
        thicknessMm: solid.thicknessMm,
        renderMesh: solid.renderMesh,
        metadata: solid.metadata,
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

    if (!skipRoofSolids) {
      for (const roofPlane of model.roofPlanes) {
        const object = buildHouseSurfaceObject({
          id: roofPlane.id,
          sourceId: roofPlane.id,
          kind: "roof",
          boundary: roofPlane.boundary,
          plane: roofPlane.plane,
          metadata: roofPlane.metadata,
        });
        if (object) objects.push(object);
      }
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

  const target = assembly.house.attachmentTarget ?? model.attachmentTarget;
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
  if (target?.zone?.boundary && target.zone.plane) {
    const object = buildHouseSurfaceObject({
      id: "house-attachment-target-zone",
      kind: "attachment_zone",
      boundary: target.zone.boundary,
      plane: target.zone.plane,
      metadata: {
        strategy: target.strategy,
        sourceEdgeId: target.sourceEdgeId ?? null,
        topZMm: target.zone.topZMm ?? null,
        bottomZMm: target.zone.bottomZMm ?? null,
      },
    });
    if (object) objects.push(object);
  }
  if (target?.kind === "plane" && target.plane) {
    const sourceWall = model.wallSegments.find(
      (wall) =>
        wall.sourceEdgeId === target.sourceEdgeId ||
        wall.id === target.sourceEdgeId,
    );
    if (sourceWall) {
      const object = buildHouseSurfaceObject({
        id: "house-attachment-target-plane",
        kind: "attachment_plane",
        boundary: sourceWall.boundary,
        plane: target.plane,
        metadata: {
          strategy: target.strategy,
          sourceEdgeId: target.sourceEdgeId ?? null,
        },
      });
      if (object) objects.push(object);
    }
  }

  return objects;
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

function buildLayers(assembly: Assembly3D): ViewerSceneLayer[] {
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

  const houseModelObjects = buildHouseModelObjects(assembly);
  if (houseModelObjects) {
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

function buildViewerSceneMetadata(assembly: Assembly3D): GeometryMetadata | undefined {
  const model = assembly.house.model;
  if (!model) return undefined;

  const qaStatus = metadataString(model.metadata, "roofQaStatus") ?? "invalid";
  const expectedRoofSolidCount = model.roofPlanes.length;
  const sceneRoofSolidCount = (model.solids?.surfaceSolids ?? []).filter(
    (solid) => solid.kind === "roof",
  ).length;
  const qaAllowsRoofSolids = qaStatus === "valid";
  const skippedRoofSolidCount = qaAllowsRoofSolids
    ? Math.max(0, expectedRoofSolidCount - sceneRoofSolidCount)
    : expectedRoofSolidCount;

  return sortMetadata({
    houseRoofQaStatus: qaStatus,
    houseRoofQaFailureReason: metadataString(model.metadata, "roofQaFailureReason"),
    houseRoofTopologyFinalFaceCount: metadataNumber(model.metadata, "roofTopologyFinalFaceCount"),
    houseRoofTopologyValleyCount: metadataNumber(model.metadata, "roofTopologyValleyCount"),
    houseRoofTopologyDisconnectedSourceFaceCount: metadataNumber(model.metadata, "roofTopologyDisconnectedSourceFaceCount"),
    houseRoofTopologyInternalEaveHeightSegmentCount: metadataNumber(model.metadata, "roofTopologyInternalEaveHeightSegmentCount"),
    houseRoofWavefrontEventCount: metadataNumber(model.metadata, "roofWavefrontEventCount"),
    houseRoofWavefrontFailureReason: metadataString(model.metadata, "roofWavefrontFailureReason"),
    houseRoofSolidExpectedCount: expectedRoofSolidCount,
    houseRoofSolidSceneCount: qaAllowsRoofSolids ? sceneRoofSolidCount : 0,
    houseRoofSolidSkippedCount: skippedRoofSolidCount,
  });
}

export function buildViewerSceneModel(assembly: Assembly3D): ViewerSceneModel {
  return {
    layers: buildLayers(assembly),
    metadata: buildViewerSceneMetadata(assembly),
  };
}
