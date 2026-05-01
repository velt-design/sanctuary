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

export type BuildTopProjectionViewModelFromSceneOptions = {
  referenceShapes?: GeometryTopProjectionShape[];
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
  if (length <= EPSILON_MM) return null;

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
  if (preferredBoundaryLength && mesh.vertices.length >= preferredBoundaryLength) {
    const topBoundary = cleanPolygon(toPolygon2(mesh.vertices.slice(0, preferredBoundaryLength)));
    if (topBoundary) return topBoundary;
  }
  return convexHull(toPolygon2(mesh.vertices));
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

function shapePolygonForObject(object: ViewerSceneObject): Polygon2 | null {
  switch (object.type) {
    case 'member_prism':
      return memberPrismPolygon(object);
    case 'roof_plane':
    case 'roof_cladding_panel':
    case 'reference_plane':
      return cleanPolygon(toPolygon2(object.boundary));
    case 'roof_flashing':
      return convexHull(toPolygon2(object.wings.flatMap((wing) => wing.boundary)));
    case 'house_roof_material':
      return convexHull(toPolygon2(object.lines.flatMap((line) => [line.start, line.end])));
    case 'reference_line':
    case 'house_line':
      return linePolygon(object.line, object.kind === 'opening_outline' ? 30 : 45);
    case 'house_surface':
      if (object.boundary.length < 2) return null;
      return cleanPolygon(toPolygon2(object.boundary)) ?? linePolygon(
        { start: object.boundary[0]!, end: object.boundary[1] ?? object.boundary[0]! },
        object.kind === 'opening_marker' ? 120 : 45,
      );
    case 'house_surface_solid':
      return object.renderMesh
        ? polygonFromRenderMesh(object.renderMesh, object.boundary.length)
        : cleanPolygon(toPolygon2(object.boundary));
    case 'house_linear_solid':
      return object.renderMesh
        ? polygonFromRenderMesh(object.renderMesh)
        : linePolygon(object.centerline, Math.max(object.profileWidthMm, object.profileDepthMm, 45));
    default:
      return null;
  }
}

function buildShapeFromObject(object: ViewerSceneObject): GeometryTopProjectionShape | null {
  const polygon = shapePolygonForObject(object);
  if (!polygon) return null;
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
    polygon,
    zOrder: Number((baseZOrder({ family, sourceType: object.type, kind }) + (stats.zMax ?? 0) / 100000).toFixed(6)),
    zMin: stats.zMin,
    zMax: stats.zMax,
    metadata: object.metadata,
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
    metadata: assembly.house.model?.metadata as GeometryMetadata | undefined,
  }];
}

function shapeExtents(shapes: GeometryTopProjectionShape[]): GeometryTopProjectionViewModel['extents'] {
  const points = shapes.flatMap((shape) => shape.polygon);
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
