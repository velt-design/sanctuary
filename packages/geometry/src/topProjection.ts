import type {
  Assembly3D,
  GeometryMetadata,
  GeometryTopProjectionFamily,
  GeometryTopProjectionShape,
  GeometryTopProjectionViewModel,
  Line3,
  Point2,
  Point3,
  Polygon2,
  RenderMesh3D,
  ViewerSceneModel,
  ViewerSceneObject,
} from './contracts';
import { buildViewerSceneModel } from './viewer';

const EPSILON_MM = 1e-6;
const TOP_VIEW_SURFACE_NORMAL_Z_MIN = 0.5;
const TOP_VIEW_Z_MATCH_TOLERANCE_MM = 1;

type TopProjectionRole = 'top_visible' | 'context' | 'hidden_from_top';

type ObjectProjection = {
  polygon: Polygon2;
  role: TopProjectionRole;
};

export type BuildTopProjectionViewModelFromSceneOptions = {
  referenceShapes?: GeometryTopProjectionShape[];
};

export type TopProjectionParityIssueCode =
  | 'screen_axis_mismatch'
  | 'missing_top_visible_shape'
  | 'extra_top_visible_shape'
  | 'hidden_shape_in_extents'
  | 'hidden_shape_rendered';

export type TopProjectionParityIssue = {
  code: TopProjectionParityIssueCode;
  message: string;
  shapeId?: string;
  sourceObjectId?: string;
};

export type BuildTopProjectionParityReportOptions = {
  renderedShapeIds?: string[];
};

export type TopProjectionParityReport = {
  status: 'pass' | 'fail';
  screenAxis: string;
  topVisibleShapeCount: number;
  contextShapeCount: number;
  hiddenShapeCount: number;
  renderedShapeCount: number;
  issues: TopProjectionParityIssue[];
};

function toPoint2(point: { x: number; y: number }): Point2 {
  return {
    x: Number(point.x.toFixed(6)),
    y: Number(point.y.toFixed(6)),
  };
}

function toPolygon2(points: Array<{ x: number; y: number }>): Polygon2 {
  return points.map(toPoint2);
}

function polygonArea(points: Polygon2): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    area += current.x * next.y - next.x * current.y;
  }
  return area / 2;
}

function ensureClockwiseScreenPolygon(points: Polygon2): Polygon2 {
  return polygonArea(points) < 0 ? points : [...points].reverse();
}

function dedupePolygon(points: Polygon2): Polygon2 {
  const deduped: Polygon2 = [];
  for (const point of points) {
    const previous = deduped[deduped.length - 1];
    if (!previous || Math.hypot(previous.x - point.x, previous.y - point.y) > EPSILON_MM) {
      deduped.push(point);
    }
  }
  const first = deduped[0];
  const last = deduped[deduped.length - 1];
  if (first && last && deduped.length > 1 && Math.hypot(first.x - last.x, first.y - last.y) <= EPSILON_MM) {
    deduped.pop();
  }
  return deduped;
}

function cleanPolygon(points: Polygon2): Polygon2 | null {
  const deduped = dedupePolygon(points);
  if (deduped.length < 3 || Math.abs(polygonArea(deduped)) <= EPSILON_MM) return null;
  return ensureClockwiseScreenPolygon(deduped);
}

function cross(origin: Point2, left: Point2, right: Point2): number {
  return (left.x - origin.x) * (right.y - origin.y) - (left.y - origin.y) * (right.x - origin.x);
}

function convexHull(points: Polygon2): Polygon2 | null {
  const unique = Array.from(
    new Map(points.map((point) => [`${point.x.toFixed(6)},${point.y.toFixed(6)}`, point])).values(),
  ).sort((left, right) => left.x - right.x || left.y - right.y);
  if (unique.length < 3) return null;

  const lower: Polygon2 = [];
  for (const point of unique) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= EPSILON_MM) {
      lower.pop();
    }
    lower.push(point);
  }

  const upper: Polygon2 = [];
  for (let index = unique.length - 1; index >= 0; index -= 1) {
    const point = unique[index]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= EPSILON_MM) {
      upper.pop();
    }
    upper.push(point);
  }

  return cleanPolygon([...lower.slice(0, -1), ...upper.slice(0, -1)]);
}

function triangleNormalizedNormalZ(a: Point3, b: Point3, c: Point3): number {
  const abX = b.x - a.x;
  const abY = b.y - a.y;
  const abZ = b.z - a.z;
  const acX = c.x - a.x;
  const acY = c.y - a.y;
  const acZ = c.z - a.z;
  const normalX = abY * acZ - abZ * acY;
  const normalY = abZ * acX - abX * acZ;
  const normalZ = abX * acY - abY * acX;
  const length = Math.hypot(normalX, normalY, normalZ);
  return length > EPSILON_MM ? normalZ / length : 0;
}

function faceVertex(mesh: RenderMesh3D, index: number): Point3 | null {
  return Number.isInteger(index) && index >= 0 && index < mesh.vertices.length
    ? mesh.vertices[index] ?? null
    : null;
}

function meshEdgeKey(startIndex: number, endIndex: number): string {
  return startIndex < endIndex ? `${startIndex}:${endIndex}` : `${endIndex}:${startIndex}`;
}

function chainBoundaryEdges(edges: Array<{ start: number; end: number }>): number[][] {
  const unused = new Set(edges.map((_, index) => index));
  const chains: number[][] = [];

  while (unused.size) {
    const firstEdgeIndex = unused.values().next().value as number;
    const firstEdge = edges[firstEdgeIndex]!;
    unused.delete(firstEdgeIndex);
    const chain = [firstEdge.start, firstEdge.end];

    while (chain.length <= edges.length + 1) {
      const start = chain[0]!;
      const end = chain[chain.length - 1]!;
      if (end === start) break;

      let nextEdgeIndex: number | null = null;
      let nextPoint: number | null = null;
      for (const edgeIndex of unused) {
        const edge = edges[edgeIndex]!;
        if (edge.start === end) {
          nextEdgeIndex = edgeIndex;
          nextPoint = edge.end;
          break;
        }
        if (edge.end === end) {
          nextEdgeIndex = edgeIndex;
          nextPoint = edge.start;
          break;
        }
      }

      if (nextEdgeIndex === null || nextPoint === null) break;
      unused.delete(nextEdgeIndex);
      chain.push(nextPoint);
    }

    if (chain[0] === chain[chain.length - 1]) {
      chain.pop();
    }
    chains.push(chain);
  }

  return chains;
}

function faceMaxZ(mesh: RenderMesh3D, face: [number, number, number]): number {
  return Math.max(...face.map((index) => mesh.vertices[index]?.z ?? Number.NEGATIVE_INFINITY));
}

function topViewPolygonFromRenderMesh(mesh: RenderMesh3D): Polygon2 | null {
  const candidates = mesh.faces
    .map((face) => {
      const a = faceVertex(mesh, face[0]);
      const b = faceVertex(mesh, face[1]);
      const c = faceVertex(mesh, face[2]);
      if (!a || !b || !c) return null;
      const normalZ = Math.abs(triangleNormalizedNormalZ(a, b, c));
      if (normalZ < TOP_VIEW_SURFACE_NORMAL_Z_MIN) return null;
      return {
        face,
        maxZ: faceMaxZ(mesh, face),
      };
    })
    .filter((candidate): candidate is { face: [number, number, number]; maxZ: number } =>
      Boolean(candidate && Number.isFinite(candidate.maxZ)),
    );
  if (!candidates.length) return null;

  const topMaxZ = Math.max(...candidates.map((candidate) => candidate.maxZ));
  const selectedFaces = candidates
    .filter((candidate) => topMaxZ - candidate.maxZ <= TOP_VIEW_Z_MATCH_TOLERANCE_MM)
    .map((candidate) => candidate.face);
  if (!selectedFaces.length) return null;

  const edgeCounts = new Map<string, { start: number; end: number; count: number }>();

  for (const face of selectedFaces) {
    for (let index = 0; index < face.length; index += 1) {
      const start = face[index]!;
      const end = face[(index + 1) % face.length]!;
      const key = meshEdgeKey(start, end);
      const existing = edgeCounts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        edgeCounts.set(key, { start, end, count: 1 });
      }
    }
  }

  const boundaryEdges = [...edgeCounts.values()]
    .filter((edge) => edge.count === 1)
    .map(({ start, end }) => ({ start, end }));
  if (boundaryEdges.length < 3) return null;

  const polygons = chainBoundaryEdges(boundaryEdges)
    .map((chain) => cleanPolygon(chain.map((index) => toPoint2(mesh.vertices[index]!))))
    .filter((polygon): polygon is Polygon2 => Boolean(polygon));
  if (!polygons.length) return null;

  return polygons.reduce((largest, polygon) =>
    Math.abs(polygonArea(polygon)) > Math.abs(polygonArea(largest)) ? polygon : largest,
  );
}

function linePolygon(line: Line3, widthMm: number): Polygon2 | null {
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const length = Math.hypot(dx, dy);
  if (length <= EPSILON_MM) return null;
  const half = Math.max(widthMm, 1) / 2;
  const nx = -dy / length;
  const ny = dx / length;
  return cleanPolygon([
    toPoint2({ x: line.start.x + nx * half, y: line.start.y + ny * half }),
    toPoint2({ x: line.end.x + nx * half, y: line.end.y + ny * half }),
    toPoint2({ x: line.end.x - nx * half, y: line.end.y - ny * half }),
    toPoint2({ x: line.start.x - nx * half, y: line.start.y - ny * half }),
  ]);
}

function memberPrismPolygon(object: Extract<ViewerSceneObject, { type: 'member_prism' }>): Polygon2 | null {
  const centerline = object.centerline;
  const widthMm = Math.max(object.profile.widthMm, 1);
  const dx = centerline.end.x - centerline.start.x;
  const dy = centerline.end.y - centerline.start.y;
  const length = Math.hypot(dx, dy);
  if (length <= EPSILON_MM) {
    const frameYAxis = object.localFrame.yAxis;
    const frameZAxis = object.localFrame.zAxis;
    const yMagnitude = Math.hypot(frameYAxis.x, frameYAxis.y);
    const zMagnitude = Math.hypot(frameZAxis.x, frameZAxis.y);
    const yAxis = yMagnitude > EPSILON_MM
      ? { x: frameYAxis.x / yMagnitude, y: frameYAxis.y / yMagnitude }
      : { x: 1, y: 0 };
    const zAxis = zMagnitude > EPSILON_MM
      ? { x: frameZAxis.x / zMagnitude, y: frameZAxis.y / zMagnitude }
      : { x: -yAxis.y, y: yAxis.x };
    const center = {
      x: (centerline.start.x + centerline.end.x) / 2,
      y: (centerline.start.y + centerline.end.y) / 2,
    };
    const halfWidth = widthMm / 2;
    const halfDepth = Math.max(object.profile.depthMm, 1) / 2;
    return cleanPolygon([
      toPoint2({ x: center.x + yAxis.x * halfWidth + zAxis.x * halfDepth, y: center.y + yAxis.y * halfWidth + zAxis.y * halfDepth }),
      toPoint2({ x: center.x - yAxis.x * halfWidth + zAxis.x * halfDepth, y: center.y - yAxis.y * halfWidth + zAxis.y * halfDepth }),
      toPoint2({ x: center.x - yAxis.x * halfWidth - zAxis.x * halfDepth, y: center.y - yAxis.y * halfWidth - zAxis.y * halfDepth }),
      toPoint2({ x: center.x + yAxis.x * halfWidth - zAxis.x * halfDepth, y: center.y + yAxis.y * halfWidth - zAxis.y * halfDepth }),
    ]);
  }

  const frameYAxis = object.localFrame.yAxis;
  const frameMagnitude = Math.hypot(frameYAxis.x, frameYAxis.y);
  const nx = frameMagnitude > EPSILON_MM ? frameYAxis.x / frameMagnitude : -dy / length;
  const ny = frameMagnitude > EPSILON_MM ? frameYAxis.y / frameMagnitude : dx / length;
  const half = widthMm / 2;
  return cleanPolygon([
    toPoint2({ x: centerline.start.x + nx * half, y: centerline.start.y + ny * half }),
    toPoint2({ x: centerline.end.x + nx * half, y: centerline.end.y + ny * half }),
    toPoint2({ x: centerline.end.x - nx * half, y: centerline.end.y - ny * half }),
    toPoint2({ x: centerline.start.x - nx * half, y: centerline.start.y - ny * half }),
  ]);
}

function polygonFromRenderMesh(mesh: RenderMesh3D, preferredBoundaryLength?: number | null): Polygon2 | null {
  const topViewPolygon = topViewPolygonFromRenderMesh(mesh);
  if (topViewPolygon) return topViewPolygon;

  if (preferredBoundaryLength && mesh.vertices.length >= preferredBoundaryLength) {
    const topBoundary = cleanPolygon(toPolygon2(mesh.vertices.slice(0, preferredBoundaryLength)));
    if (topBoundary) return topBoundary;
  }
  return convexHull(toPolygon2(mesh.vertices));
}

function projectionRoleForObject(object: ViewerSceneObject): TopProjectionRole {
  if (object.type.startsWith('reference_')) return 'context';
  if (object.type === 'house_surface_solid') {
    if (object.kind === 'roof' || object.kind === 'deck') return 'top_visible';
    return 'hidden_from_top';
  }
  if (object.type === 'house_surface') {
    if (object.kind === 'roof' || object.kind === 'deck') return 'top_visible';
    if (object.kind === 'opening_marker' || object.kind === 'attachment_zone' || object.kind === 'attachment_plane') return 'context';
    return 'hidden_from_top';
  }
  if (object.type === 'house_line') {
    if (object.kind === 'opening_outline' || object.kind === 'attachment_target') return 'context';
    return 'top_visible';
  }
  if (object.type === 'house_roof_material' || object.type === 'house_linear_solid') return 'top_visible';
  return 'top_visible';
}

function metadataWithTopProjectionRole(
  metadata: GeometryMetadata | undefined,
  role: TopProjectionRole,
): GeometryMetadata {
  return {
    ...(metadata ?? {}),
    topProjectionRole: role,
  };
}

function topProjectionRoleForShape(shape: GeometryTopProjectionShape): TopProjectionRole {
  const role = shape.metadata?.topProjectionRole;
  return role === 'context' || role === 'hidden_from_top' || role === 'top_visible'
    ? role
    : 'top_visible';
}

function zStats(points: Point3[]): { zMin: number | null; zMax: number | null } {
  const values = points.map((point) => point.z).filter(Number.isFinite);
  if (!values.length) return { zMin: null, zMax: null };
  return {
    zMin: Number(Math.min(...values).toFixed(6)),
    zMax: Number(Math.max(...values).toFixed(6)),
  };
}

function objectPoints(object: ViewerSceneObject): Point3[] {
  switch (object.type) {
    case 'member_prism':
      return [object.centerline.start, object.centerline.end];
    case 'roof_plane':
    case 'roof_cladding_panel':
    case 'reference_plane':
    case 'house_surface':
      return object.boundary;
    case 'roof_flashing':
      return object.wings.flatMap((wing) => wing.boundary);
    case 'house_roof_material':
      return object.lines.flatMap((line) => [line.start, line.end]);
    case 'reference_line':
    case 'house_line':
      return [object.line.start, object.line.end];
    case 'house_surface_solid':
      return object.renderMesh?.vertices ?? object.boundary;
    case 'house_linear_solid':
      return object.renderMesh?.vertices ?? [object.centerline.start, object.centerline.end];
    default:
      return [];
  }
}

function familyForObject(object: ViewerSceneObject): GeometryTopProjectionFamily {
  if (object.type.startsWith('house_')) return 'house';
  if (object.type.startsWith('reference_')) return 'reference';
  return 'pergola';
}

function kindForObject(object: ViewerSceneObject): string {
  switch (object.type) {
    case 'member_prism':
      return object.role;
    case 'roof_cladding_panel':
      return 'roof_cladding';
    case 'roof_flashing':
      return 'roof_flashing';
    case 'house_roof_material':
      return 'house_roof_material';
    case 'house_surface':
    case 'house_line':
    case 'house_surface_solid':
    case 'house_linear_solid':
    case 'reference_line':
    case 'reference_plane':
      return object.kind;
    default:
      return object.type;
  }
}

function baseZOrder(input: { family: GeometryTopProjectionFamily; sourceType: ViewerSceneObject['type'] | 'house_reference'; kind: string }): number {
  if (input.sourceType === 'house_reference') return 0;
  if (input.family === 'reference') return 5;
  if (input.family === 'house') {
    if (input.kind === 'wall') return 10;
    if (input.kind === 'footprint') return 12;
    if (input.kind === 'soffit' || input.kind === 'fascia' || input.kind === 'attachment_zone') return 20;
    if (input.kind === 'roof' || input.kind === 'house_roof_material') return 30;
    if (input.kind === 'gutter' || input.kind === 'roof_feature') return 36;
    if (input.kind === 'deck') return 42;
    if (input.kind === 'opening_marker' || input.kind === 'opening_outline') return 48;
    return 25;
  }
  if (input.kind === 'roof_plane') return 60;
  if (input.kind === 'roof_cladding') return 64;
  if (input.kind === 'rafter') return 72;
  if (input.kind === 'ridge') return 78;
  if (input.kind === 'post') return 82;
  return 70;
}

function shapeProjectionForObject(object: ViewerSceneObject): ObjectProjection | null {
  const role = projectionRoleForObject(object);
  switch (object.type) {
    case 'member_prism': {
      const polygon = memberPrismPolygon(object);
      return polygon ? { polygon, role } : null;
    }
    case 'roof_plane':
    case 'roof_cladding_panel':
    case 'reference_plane': {
      const polygon = cleanPolygon(toPolygon2(object.boundary));
      return polygon ? { polygon, role } : null;
    }
    case 'roof_flashing': {
      const polygon = convexHull(toPolygon2(object.wings.flatMap((wing) => wing.boundary)));
      return polygon ? { polygon, role } : null;
    }
    case 'house_roof_material': {
      const polygon = convexHull(toPolygon2(object.lines.flatMap((line) => [line.start, line.end])));
      return polygon ? { polygon, role } : null;
    }
    case 'reference_line':
    case 'house_line': {
      const polygon = linePolygon(object.line, object.kind === 'opening_outline' ? 30 : 45);
      return polygon ? { polygon, role } : null;
    }
    case 'house_surface':
      if (object.boundary.length < 2) return null;
      {
        const polygon = cleanPolygon(toPolygon2(object.boundary)) ?? linePolygon(
        { start: object.boundary[0]!, end: object.boundary[1] ?? object.boundary[0]! },
        object.kind === 'opening_marker' ? 120 : 45,
      );
        return polygon ? { polygon, role } : null;
      }
    case 'house_surface_solid': {
      const semanticTopBoundary =
        object.kind === 'roof' || object.kind === 'deck'
          ? cleanPolygon(toPolygon2(object.boundary))
          : null;
      const polygon = semanticTopBoundary ?? (object.renderMesh
        ? polygonFromRenderMesh(object.renderMesh, object.boundary.length)
        : cleanPolygon(toPolygon2(object.boundary)));
      return polygon ? { polygon, role } : null;
    }
    case 'house_linear_solid': {
      const polygon = object.renderMesh
        ? polygonFromRenderMesh(object.renderMesh)
        : linePolygon(object.centerline, Math.max(object.profileWidthMm, object.profileDepthMm, 45));
      return polygon ? { polygon, role } : null;
    }
    default:
      return null;
  }
}

function buildShapeFromObject(object: ViewerSceneObject): GeometryTopProjectionShape | null {
  const projection = shapeProjectionForObject(object);
  if (!projection) return null;
  const family = familyForObject(object);
  const kind = kindForObject(object);
  const stats = zStats(objectPoints(object));
  const sourceId = 'sourceId' in object ? object.sourceId ?? null : null;
  return {
    id: `${object.type}:${object.id}`,
    sourceObjectId: object.id,
    sourceId,
    sourceType: object.type,
    family,
    kind,
    polygon: projection.polygon,
    zOrder: Number((baseZOrder({ family, sourceType: object.type, kind }) + (stats.zMax ?? 0) / 100000).toFixed(6)),
    zMin: stats.zMin,
    zMax: stats.zMax,
    metadata: metadataWithTopProjectionRole(object.metadata, projection.role),
  };
}

function buildReferenceShapes(assembly: Assembly3D): GeometryTopProjectionShape[] {
  const footprint = assembly.house.model?.footprint ?? assembly.house.footprint ?? null;
  const polygon = footprint ? cleanPolygon(toPolygon2(footprint)) : null;
  if (!polygon) return [];
  return [{
    id: 'house_reference:house-footprint',
    sourceObjectId: 'house-footprint',
    sourceId: 'house-footprint',
    sourceType: 'house_reference',
    family: 'house',
    kind: 'footprint',
    polygon,
    zOrder: 0,
    zMin: 0,
    zMax: 0,
    metadata: metadataWithTopProjectionRole(assembly.house.model?.metadata as GeometryMetadata | undefined, 'context'),
  }];
}

function shapeExtents(shapes: GeometryTopProjectionShape[]): GeometryTopProjectionViewModel['extents'] {
  const points = shapes
    .filter((shape) => shape.metadata?.topProjectionRole !== 'hidden_from_top')
    .flatMap((shape) => shape.polygon);
  if (!points.length) return null;
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));
  return {
    minX: Number(minX.toFixed(6)),
    minY: Number(minY.toFixed(6)),
    maxX: Number(maxX.toFixed(6)),
    maxY: Number(maxY.toFixed(6)),
    widthMm: Number((maxX - minX).toFixed(6)),
    heightMm: Number((maxY - minY).toFixed(6)),
  };
}

function topProjectionScreenAxisString(projection: GeometryTopProjectionViewModel): string {
  return `${projection.screenAxis.x}_${projection.screenAxis.y}`;
}

function extentsEqual(
  left: GeometryTopProjectionViewModel['extents'],
  right: GeometryTopProjectionViewModel['extents'],
): boolean {
  if (left === null || right === null) return left === right;
  return (
    Math.abs(left.minX - right.minX) <= EPSILON_MM &&
    Math.abs(left.minY - right.minY) <= EPSILON_MM &&
    Math.abs(left.maxX - right.maxX) <= EPSILON_MM &&
    Math.abs(left.maxY - right.maxY) <= EPSILON_MM &&
    Math.abs(left.widthMm - right.widthMm) <= EPSILON_MM &&
    Math.abs(left.heightMm - right.heightMm) <= EPSILON_MM
  );
}

export function buildTopProjectionParityReport(
  scene: ViewerSceneModel,
  projection: GeometryTopProjectionViewModel,
  options: BuildTopProjectionParityReportOptions = {},
): TopProjectionParityReport {
  const issues: TopProjectionParityIssue[] = [];
  const sceneObjectIds = new Set(scene.layers.flatMap((layer) => layer.objects.map((object) => object.id)));
  const expectedTopVisibleObjectIds = new Set(
    scene.layers.flatMap((layer) =>
      layer.objects
        .filter((object) => projectionRoleForObject(object) === 'top_visible')
        .map((object) => object.id),
    ),
  );
  const shapeIds = new Set(projection.shapes.map((shape) => shape.id));
  const topVisibleShapes = projection.shapes.filter((shape) => topProjectionRoleForShape(shape) === 'top_visible');
  const contextShapes = projection.shapes.filter((shape) => topProjectionRoleForShape(shape) === 'context');
  const hiddenShapes = projection.shapes.filter((shape) => topProjectionRoleForShape(shape) === 'hidden_from_top');

  const screenAxis = topProjectionScreenAxisString(projection);
  if (screenAxis !== 'world_x_right_world_y_down') {
    issues.push({
      code: 'screen_axis_mismatch',
      message: `Expected top projection screen axis world_x_right_world_y_down, received ${screenAxis}.`,
    });
  }

  for (const shape of topVisibleShapes) {
    if (!sceneObjectIds.has(shape.sourceObjectId)) {
      issues.push({
        code: 'extra_top_visible_shape',
        message: `Top-visible projection shape ${shape.id} does not map to a viewer scene object.`,
        shapeId: shape.id,
        sourceObjectId: shape.sourceObjectId,
      });
    }
  }

  const projectedTopVisibleObjectIds = new Set(
    topVisibleShapes
      .filter((shape) => sceneObjectIds.has(shape.sourceObjectId))
      .map((shape) => shape.sourceObjectId),
  );
  for (const objectId of expectedTopVisibleObjectIds) {
    if (!projectedTopVisibleObjectIds.has(objectId)) {
      issues.push({
        code: 'missing_top_visible_shape',
        message: `Viewer scene object ${objectId} is top-visible but has no top-visible projection shape.`,
        sourceObjectId: objectId,
      });
    }
  }

  const visibleExtents = shapeExtents(projection.shapes);
  if (!extentsEqual(visibleExtents, projection.extents)) {
    issues.push({
      code: 'hidden_shape_in_extents',
      message: 'Top projection extents include hidden-from-top geometry.',
    });
  }

  for (const shapeId of options.renderedShapeIds ?? []) {
    const shape = projection.shapes.find((candidate) => candidate.id === shapeId);
    if (shape && topProjectionRoleForShape(shape) === 'hidden_from_top') {
      issues.push({
        code: 'hidden_shape_rendered',
        message: `Hidden-from-top projection shape ${shape.id} was rendered in the normal plan.`,
        shapeId: shape.id,
        sourceObjectId: shape.sourceObjectId,
      });
    }
  }

  return {
    status: issues.length === 0 ? 'pass' : 'fail',
    screenAxis,
    topVisibleShapeCount: topVisibleShapes.length,
    contextShapeCount: contextShapes.length,
    hiddenShapeCount: hiddenShapes.length,
    renderedShapeCount: options.renderedShapeIds?.filter((shapeId) => shapeIds.has(shapeId)).length ?? 0,
    issues,
  };
}

export function buildTopProjectionViewModelFromScene(
  scene: ViewerSceneModel,
  options: BuildTopProjectionViewModelFromSceneOptions = {},
): GeometryTopProjectionViewModel {
  const shapes = [
    ...(options.referenceShapes ?? []),
    ...scene.layers.flatMap((layer) => layer.objects.map(buildShapeFromObject).filter((shape): shape is GeometryTopProjectionShape => Boolean(shape))),
  ].sort((left, right) => left.zOrder - right.zOrder || left.id.localeCompare(right.id));

  return {
    coordinateSpace: 'world_xy_mm',
    screenAxis: {
      x: 'world_x_right',
      y: 'world_y_down',
    },
    shapes,
    extents: shapeExtents(shapes),
  };
}

export function buildTopProjectionViewModel(assembly: Assembly3D): GeometryTopProjectionViewModel {
  return buildTopProjectionViewModelFromScene(buildViewerSceneModel(assembly), {
    referenceShapes: buildReferenceShapes(assembly),
  });
}
