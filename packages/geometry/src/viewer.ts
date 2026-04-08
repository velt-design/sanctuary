import type {
  Assembly3D,
  GeometryMetadata,
  GeometryMetadataValue,
  Line3,
  Plane3,
  Point3,
  Polygon3,
  ViewerSceneLayer,
  ViewerSceneMemberPrismObject,
  ViewerSceneModel,
  ViewerSceneObject,
  ViewerSceneReferenceLineObject,
  ViewerSceneReferencePlaneObject,
  ViewerSceneRoofPlaneObject,
} from './contracts';
import { lineLength, magnitude, normalizeVector } from './math3d';

function sortMetadataValue(value: GeometryMetadataValue): GeometryMetadataValue {
  if (typeof value === 'number') {
    return Number(value.toFixed(6));
  }
  return value;
}

function sortMetadata(metadata: GeometryMetadata | undefined): GeometryMetadata | undefined {
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
  if (assembly.attachmentEdge) {
    zValues.push(assembly.attachmentEdge.start.z, assembly.attachmentEdge.end.z);
  }
  if (assembly.house.fasciaLine) {
    zValues.push(assembly.house.fasciaLine.start.z, assembly.house.fasciaLine.end.z);
  }
  if (assembly.house.roofEdgeLine) {
    zValues.push(assembly.house.roofEdgeLine.start.z, assembly.house.roofEdgeLine.end.z);
  }

  return zValues.length ? Math.max(...zValues) : 0;
}

function outlineLength(assembly: Assembly3D): number {
  const xValues = assembly.outline.map((point) => point.x);
  if (xValues.length < 2) return 0;
  return Math.max(...xValues) - Math.min(...xValues);
}

function pointFromOrigin(origin: Point3, xAxis: { x: number; y: number; z: number }, xScale: number, yAxis: { x: number; y: number; z: number }, yScale: number): Point3 {
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

function buildMemberObject(assembly: Assembly3D['members'][number]): ViewerSceneMemberPrismObject {
  const renderMode = assembly.profile.shape === 'rectangular' ? 'prism' : 'line_fallback';
  return {
    id: assembly.id,
    type: 'member_prism',
    sourceId: assembly.id,
    role: assembly.role,
    centerline: assembly.centerline,
    profile: assembly.profile,
    localFrame: assembly.localFrame,
    lengthMm: Math.round(lineLength(assembly.centerline)),
    renderMode,
    metadata:
      renderMode === 'line_fallback'
        ? sortMetadata({
            ...assembly.metadata,
            profileShapeFallback: true,
            unsupportedProfileShape: assembly.profile.shape,
          })
        : sortMetadata(assembly.metadata),
  };
}

function buildRoofPlaneObject(roofPlane: Assembly3D['roofPlanes'][number]): ViewerSceneRoofPlaneObject {
  return {
    id: roofPlane.id,
    type: 'roof_plane',
    sourceId: roofPlane.id,
    boundary: roofPlane.boundary,
    plane: roofPlane.plane,
    fallVector: roofPlane.fallVector,
    metadata: sortMetadata(roofPlane.metadata),
  };
}

function buildReferenceLineObject(id: string, kind: ViewerSceneReferenceLineObject['kind'], line: Line3): ViewerSceneReferenceLineObject {
  return {
    id,
    type: 'reference_line',
    sourceId: id,
    kind,
    line,
  };
}

function buildReferencePlaneObject(id: string, kind: ViewerSceneReferencePlaneObject['kind'], plane: Plane3, boundary: Polygon3): ViewerSceneReferencePlaneObject {
  return {
    id,
    type: 'reference_plane',
    sourceId: id,
    kind,
    plane,
    boundary,
  };
}

function buildLayers(assembly: Assembly3D): ViewerSceneLayer[] {
  const houseObjects: ViewerSceneObject[] = [];
  const postObjects = assembly.members.filter((member) => member.role === 'post').map(buildMemberObject);
  const beamObjects = assembly.members
    .filter((member) => member.role === 'beam' || member.role === 'ledger' || member.role === 'ridge' || member.role === 'brace')
    .map(buildMemberObject);
  const rafterObjects = assembly.members.filter((member) => member.role === 'rafter').map(buildMemberObject);
  const gutterObjects = assembly.members.filter((member) => member.role === 'gutter').map(buildMemberObject);
  const roofPlaneObjects = assembly.roofPlanes.map(buildRoofPlaneObject);
  const attachmentObjects = assembly.attachmentEdge
    ? [buildReferenceLineObject('attachment-edge', 'attachment_edge', assembly.attachmentEdge)]
    : [];

  if (assembly.house.wallPlane && magnitude(assembly.house.wallPlane.normal) > 0) {
    houseObjects.push(
      buildReferencePlaneObject(
        'house-wall-plane',
        'house_wall',
        assembly.house.wallPlane,
        buildHouseWallBoundary(assembly, assembly.house.wallPlane),
      ),
    );
  }

  if (assembly.house.fasciaLine) {
    houseObjects.push(buildReferenceLineObject('house-fascia-line', 'fascia', assembly.house.fasciaLine));
  }

  if (assembly.house.roofEdgeLine) {
    houseObjects.push(buildReferenceLineObject('house-roof-edge-line', 'roof_edge', assembly.house.roofEdgeLine));
  }

  return [
    { id: 'house', label: 'House', visibleByDefault: true, objects: sortObjects(houseObjects) },
    { id: 'posts', label: 'Posts', visibleByDefault: true, objects: sortObjects(postObjects) },
    { id: 'beams', label: 'Beams', visibleByDefault: true, objects: sortObjects(beamObjects) },
    { id: 'rafters', label: 'Rafters', visibleByDefault: true, objects: sortObjects(rafterObjects) },
    { id: 'gutters', label: 'Gutters', visibleByDefault: true, objects: sortObjects(gutterObjects) },
    { id: 'roof_planes', label: 'Roof Planes', visibleByDefault: true, objects: sortObjects(roofPlaneObjects) },
    { id: 'attachment_edge', label: 'Attachment Edge', visibleByDefault: true, objects: sortObjects(attachmentObjects) },
  ];
}

export function buildViewerSceneModel(assembly: Assembly3D): ViewerSceneModel {
  return {
    layers: buildLayers(assembly),
  };
}
