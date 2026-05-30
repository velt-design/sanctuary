import type {
  Assembly3D,
  GeometryMetadata,
  GeometryTopProjectionFamily,
  GeometryTopProjectionShape,
  GeometryTopProjectionViewModel,
  HouseModel3D,
  HouseReferenceGeometry,
  Line3,
  Point2,
  Point3,
  Polygon2,
  RenderMesh3D,
  ViewerSceneModel,
  ViewerSceneObject,
} from './contracts';
import { deriveHouseGableTerminalEndsFromFootprint } from './houseModel';
import {
  buildHouseModelRoofMaterialSceneObjects,
  buildHouseModelSceneObjects,
  buildViewerSceneModel,
} from './viewer';

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
  /**
   * Milestone 13: when supplied, hip-end facets that match a terminal
   * end of the house's hipped roof are tagged with `openGableEndId`
   * and `isOpen` metadata so the plan-view selection router can
   * dispatch the per-end open-as-gable toggle. Both
   * `buildTopProjectionViewModel` (the assembly-first entry) and the
   * scene-first parity test in `topProjection.test.ts` need to apply
   * the SAME enrichment to produce identical output -- passing the
   * assembly here is what keeps that invariant.
   */
  terminalEndAssembly?: Assembly3D;
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
  // House-model roof internals (hip/ridge/eave flashings, roof material
  // visuals, etc.) are 3D-only details. Their 2D projections show up as
  // thin diagonal polygons that clutter the plan view and duplicate the
  // canonical roof outline + ridge/hip lines already emitted as
  // `house_line` features. They're tagged with `metadata.source: 'house_model'`
  // by the house-model builders so the same `roof_flashing` /
  // `roof_cladding_panel` types remain top-visible when emitted from a
  // pergola assembly. `house_roof_material` and `house_surface_solid` are
  // checked first so their explicit rules still apply.
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
    if (object.kind === 'wall_segment' || object.kind === 'opening_outline' || object.kind === 'attachment_target') return 'context';
    return 'top_visible';
  }
  if (object.type === 'house_roof_material' || object.type === 'house_linear_solid') return 'top_visible';
  if (object.metadata?.source === 'house_model') return 'hidden_from_top';
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
  // Roof-internal types like `roof_flashing`, `roof_cladding_panel`, and
  // `roof_plane` don't have a `house_` prefix even when they originate from
  // the house model — `roofFlashingsForScene` merges house + pergola
  // flashings into one list, so the family must be disambiguated by the
  // `metadata.source: 'house_model'` marker the house-model builders set.
  // Without this, pergola visibility toggle would hide house roof internals.
  if (object.metadata?.source === 'house_model') return 'house';
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
    if (input.kind === 'wall_segment') return 11;
    if (input.kind === 'footprint') return 12;
    if (input.kind === 'soffit' || input.kind === 'fascia' || input.kind === 'attachment_zone') return 20;
    // Deck sits BELOW the roof (and gutter/roof_feature) so an opaque roof
    // fill visually "wraps" over the deck where they overlap in plan view.
    // Hit-testing is unaffected — decks are real selection targets and
    // decorative roof kinds are filtered out of the plan hit-target layer
    // (see `planHitTargetFilter.ts`), so the deck stays clickable in the
    // overlap region even though the roof is drawn on top of it.
    if (input.kind === 'deck') return 28;
    if (input.kind === 'roof' || input.kind === 'house_roof_material') return 30;
    if (input.kind === 'gutter' || input.kind === 'roof_feature') return 36;
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

function isCanonicalOutlineForObject(object: ViewerSceneObject): boolean {
  if (object.type === 'house_surface_solid' && object.kind === 'deck') {
    return true;
  }
  return false;
}

function buildShapeFromObject(object: ViewerSceneObject): GeometryTopProjectionShape | null {
  const projection = shapeProjectionForObject(object);
  if (!projection) return null;
  const family = familyForObject(object);
  const kind = kindForObject(object);
  const stats = zStats(objectPoints(object));
  const sourceId = 'sourceId' in object ? object.sourceId ?? null : null;
  const baseMetadata = metadataWithTopProjectionRole(object.metadata, projection.role);
  const metadata = isCanonicalOutlineForObject(object)
    ? { ...baseMetadata, isCanonicalOutline: true }
    : baseMetadata;
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
    metadata,
  };
}

/**
 * Per-instance identifiers for the reference shapes a single
 * `buildTopProjectionViewModel` call emits. Step 5b of the first-class
 * spatial-entities migration: when multiple pergolas / house forms
 * eventually compose into a project-level topProjection (Step 5c+), each
 * instance needs a stable, disambiguated id so the consumer can keep them
 * apart. When omitted, the legacy singleton ids (`'house-footprint'` /
 * `'pergola-outline'`) are emitted for back-compat.
 */
export type ReferenceShapeIdentifiers = {
  /** Stable id for THIS pergola assembly's outline reference shape. */
  pergolaSourceId?: string | null;
  /** Stable id for THIS house assembly's footprint reference shape. */
  houseSourceId?: string | null;
};

function buildReferenceShapes(
  assembly: Assembly3D,
  identifiers: ReferenceShapeIdentifiers = {},
): GeometryTopProjectionShape[] {
  const shapes: GeometryTopProjectionShape[] = [];

  const houseSourceId = identifiers.houseSourceId ?? 'house-footprint';
  const pergolaSourceId = identifiers.pergolaSourceId ?? 'pergola-outline';

  const houseFootprint = assembly.house.model?.footprint ?? assembly.house.footprint ?? null;
  const housePolygon = houseFootprint ? cleanPolygon(toPolygon2(houseFootprint)) : null;
  if (housePolygon) {
    shapes.push({
      id: `house_reference:${houseSourceId}`,
      sourceObjectId: houseSourceId,
      sourceId: houseSourceId,
      sourceType: 'house_reference',
      family: 'house',
      kind: 'footprint',
      polygon: housePolygon,
      zOrder: 0,
      zMin: 0,
      zMax: 0,
      metadata: {
        ...metadataWithTopProjectionRole(assembly.house.model?.metadata as GeometryMetadata | undefined, 'top_visible'),
        isCanonicalOutline: true,
      },
    });
  }

  const pergolaPolygon = assembly.outline.length >= 3 ? cleanPolygon(toPolygon2(assembly.outline)) : null;
  if (pergolaPolygon) {
    shapes.push({
      id: `pergola_reference:${pergolaSourceId}`,
      sourceObjectId: pergolaSourceId,
      sourceId: pergolaSourceId,
      sourceType: 'pergola_reference',
      family: 'pergola',
      kind: 'outline',
      polygon: pergolaPolygon,
      zOrder: 1,
      zMin: 0,
      zMax: 0,
      metadata: {
        ...metadataWithTopProjectionRole(undefined, 'top_visible'),
        isCanonicalOutline: true,
      },
    });
  }

  return shapes;
}

/**
 * Milestone 13 plan-view UX: tag each existing house roof facet that
 * corresponds to a hipped roof's terminal end with the toggle metadata
 * the selection router needs (`openGableEndId` + `isOpen`). The hip
 * triangle ALREADY exists in the projection as a `kind: 'roof'` shape;
 * enriching it in place avoids stacking a synthetic marker on top and
 * keeps the visual identical to a non-toggleable hipped roof. Hover
 * affordance comes from the existing `.hitTarget:hover` style on the
 * plan canvas.
 *
 * Identification is by spatial overlap with the terminal end's eave
 * segment rather than `metadata.sourceEdgeId`: the rectangular path
 * (`buildRectangularRoof` in `house/roofRectangle.ts`) doesn't carry
 * footprint edge ids on its hip caps, and adding them would change
 * the canonical assembly hash. A hip cap projects to a triangle with
 * one edge equal to its terminal eave segment -- we match by checking
 * for two consecutive vertices that align (within tolerance) with a
 * terminal end's eave start/end points.
 *
 * For OPEN ends, no facet exists (the wavefront removed it via the
 * stationary-edge mechanism in session B). Nothing to enrich. The
 * user re-closes from the inspector's open-end toggle list.
 */
const TERMINAL_END_MATCH_TOLERANCE_MM = 1;

function enrichHouseRoofShapesWithTerminalEnds(
  shapes: GeometryTopProjectionShape[],
  assembly: Assembly3D,
): GeometryTopProjectionShape[] {
  const houseModel = assembly.house.model;
  const houseMeta = houseModel?.metadata ?? null;
  const metaRoofForm = typeof houseMeta?.roofForm === 'string' ? houseMeta.roofForm : null;
  const metaOpenIdsCsv =
    typeof houseMeta?.openGableEndIds === 'string' ? houseMeta.openGableEndIds : '';
  const metaOpenIds = new Set(
    metaOpenIdsCsv
      ? metaOpenIdsCsv.split(',').map((value) => value.trim()).filter(Boolean)
      : [],
  );
  // Prefer the workbench's configured `roofRidgeAxis` (surfaced as
  // a top-level field on the house model) over a per-plane
  // derivation. The joined-hipped wavefront emits planes with
  // alternating x/y ridge metadata; picking the FIRST plane's axis
  // was correct for rectangular footprints (whose ridge axis
  // matches the rectangle's long dimension on every plane) but
  // produced an axis mismatch on joined custom polygons -- the
  // workbench's rail validator filtered out the resulting click-
  // tagged terminal ids because their axis didn't match
  // `sharedRidgeAxis`, so toggling silently no-op'd. Falling back
  // to plane-derived axis only when the model omits the configured
  // ridge axis keeps legacy code paths working.
  const dominantRidgeAxis: 'x' | 'y' | null = (() => {
    const configured = houseModel?.roofRidgeAxis;
    if (configured === 'x' || configured === 'y') return configured;
    for (const plane of houseModel?.roofPlanes ?? []) {
      const axis = plane.metadata?.ridgeAxis;
      if (axis === 'x' || axis === 'y') return axis;
    }
    return null;
  })();
  const formHasTerminalEnds =
    metaRoofForm === 'hipped' || metaRoofForm === 'dutch_hip' || metaRoofForm === 'gable';
  if (
    !formHasTerminalEnds ||
    !houseModel?.footprint ||
    (dominantRidgeAxis !== 'x' && dominantRidgeAxis !== 'y')
  ) {
    return shapes;
  }
  const terminalEnds = deriveHouseGableTerminalEndsFromFootprint({
    footprint: houseModel.footprint,
    ridgeAxis: dominantRidgeAxis,
  });
  if (terminalEnds.length === 0) return shapes;
  // Build per-terminal eave segment endpoints (in 2D world mm). The
  // trailing N in `house-gable-end-{axis}-N` is the 1-based polygon
  // edge index, which directly indexes the footprint.
  type TerminalSegment = {
    endId: string;
    isOpen: boolean;
    a: Point2;
    b: Point2;
  };
  const segments: TerminalSegment[] = [];
  for (const terminalEnd of terminalEnds) {
    const trailing = terminalEnd.id.match(/-(\d+)$/);
    if (!trailing) continue;
    const edgeIndex = Number(trailing[1]) - 1;
    if (
      !Number.isFinite(edgeIndex) ||
      edgeIndex < 0 ||
      edgeIndex >= houseModel.footprint.length
    ) {
      continue;
    }
    const start = houseModel.footprint[edgeIndex]!;
    const end = houseModel.footprint[(edgeIndex + 1) % houseModel.footprint.length]!;
    segments.push({
      endId: terminalEnd.id,
      isOpen: metaOpenIds.has(terminalEnd.id),
      a: { x: start.x, y: start.y },
      b: { x: end.x, y: end.y },
    });
  }
  if (segments.length === 0) return shapes;
  // Test via point-in-polygon at an inward-shifted eave midpoint.
  // The roof shape's polygon comes from a `house_surface_solid` prism
  // that includes the eave overhang, so its polygon vertices don't
  // align with the footprint edge endpoints. But ANY hip cap covering
  // a terminal end contains the segment between the eave midpoint
  // (just inside the footprint) and the apex. Probing slightly inward
  // from the footprint midpoint reliably hits the hip cap and misses
  // the long along-ridge facets (which are inboard of the eave).
  const TERMINAL_END_INWARD_PROBE_MM = 100;
  const probePoints = segments.map((segment) => {
    const dx = segment.b.x - segment.a.x;
    const dy = segment.b.y - segment.a.y;
    const length = Math.hypot(dx, dy);
    const midX = (segment.a.x + segment.b.x) / 2;
    const midY = (segment.a.y + segment.b.y) / 2;
    if (length === 0) return { ...segment, probe: { x: midX, y: midY } };
    // Polygon centroid as the "inward" reference: rotate the edge
    // vector 90 deg both ways, pick the rotation whose direction
    // points from the edge midpoint toward the polygon centroid.
    let centroidX = 0;
    let centroidY = 0;
    if (houseModel.footprint) {
      for (const point of houseModel.footprint) {
        centroidX += point.x;
        centroidY += point.y;
      }
      centroidX /= houseModel.footprint.length;
      centroidY /= houseModel.footprint.length;
    }
    const towardCentroidX = centroidX - midX;
    const towardCentroidY = centroidY - midY;
    const perpA = { x: -dy / length, y: dx / length };
    const perpB = { x: dy / length, y: -dx / length };
    const dotA = perpA.x * towardCentroidX + perpA.y * towardCentroidY;
    const inward = dotA >= 0 ? perpA : perpB;
    return {
      ...segment,
      probe: {
        x: midX + inward.x * TERMINAL_END_INWARD_PROBE_MM,
        y: midY + inward.y * TERMINAL_END_INWARD_PROBE_MM,
      },
    };
  });
  const pointInPolygon = (point: Point2, polygon: Polygon2): boolean => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
      const xi = polygon[i]!.x;
      const yi = polygon[i]!.y;
      const xj = polygon[j]!.x;
      const yj = polygon[j]!.y;
      const intersects = yi > point.y !== yj > point.y &&
        point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
      if (intersects) inside = !inside;
    }
    return inside;
  };
  const matchedEndIds = new Set<string>();
  // First pass: for each terminal end, find ALL house roof shapes
  // whose polygon contains the inward probe. Hip caps and long
  // slopes can both contain the probe -- hip caps are bounded by
  // the terminal eave + apex (small area); long slopes are bounded
  // by the LONG eave + ridge (large area). Pick the smallest-area
  // candidate per terminal: that's the hip cap.
  //
  // The previous implementation filtered to 3-vertex polygons under
  // the assumption that hip caps always project as pure triangles.
  // That holds for rectangular and simple joined footprints but
  // breaks on custom polygons with asymmetric eave-overhang
  // geometry (the hip cap's projection picks up 2 extra vertices
  // per overhang corner, giving 5-vertex polygons). Area-based
  // selection generalizes correctly without losing the
  // hip-cap-vs-slope discrimination.
  const polygonAreaXY = (polygon: Polygon2): number => {
    let sum = 0;
    for (let i = 0; i < polygon.length; i += 1) {
      const current = polygon[i]!;
      const next = polygon[(i + 1) % polygon.length]!;
      sum += current.x * next.y - next.x * current.y;
    }
    return Math.abs(sum) / 2;
  };
  // Closed terminal ends only -- their real hip-cap facet exists
  // and the user clicks it to OPEN. Open terminal ends have no
  // real hip-cap facet (the wavefront removed it via the stationary-
  // edge mechanism); the synthetic-shape pass below builds an
  // invisible hover target at the would-be hip-cap location for the
  // user to click to CLOSE. Matching opens here would tag the
  // slope that filled the gap, swallowing the synthetic and
  // changing UX -- preserved by filtering to closed probes only.
  const closedProbes = probePoints.filter((entry) => !entry.isOpen);
  const matchByEndId = new Map<
    string,
    { shapeIndex: number; area: number }
  >();
  for (let index = 0; index < shapes.length; index += 1) {
    const shape = shapes[index]!;
    if (shape.family !== 'house' || shape.kind !== 'roof') continue;
    if (shape.polygon.length < 3) continue;
    const matched = closedProbes.find((entry) => pointInPolygon(entry.probe, shape.polygon));
    if (!matched) continue;
    const area = polygonAreaXY(shape.polygon);
    const existing = matchByEndId.get(matched.endId);
    if (!existing || area < existing.area) {
      matchByEndId.set(matched.endId, { shapeIndex: index, area });
    }
  }
  const matchedShapeIndex = new Map<number, string>();
  for (const [endId, { shapeIndex }] of matchByEndId) {
    matchedShapeIndex.set(shapeIndex, endId);
    matchedEndIds.add(endId);
  }
  const isOpenByEndId = new Map(probePoints.map((entry) => [entry.endId, entry.isOpen]));
  const enrichedShapes = shapes.map((shape, index) => {
    const endId = matchedShapeIndex.get(index);
    if (!endId) return shape;
    return {
      ...shape,
      metadata: {
        ...(shape.metadata ?? {}),
        openGableEndId: endId,
        isOpen: isOpenByEndId.get(endId) ?? false,
      },
    };
  });
  // Synthetic hover targets for OPEN terminal ends. When a hip is
  // toggled open, its actual roof facet is gone -- but the user needs
  // a click target in the same place to re-close it. We synthesize a
  // triangle the same shape and position the hip facet WOULD occupy
  // if the end were closed, with `isOpen: true` metadata. The
  // hit-target layer renders it with transparent fill so it's
  // invisible until hovered (the hover style applies as usual).
  //
  // Polygon construction: walk inward from the eave midpoint by half
  // the eave length to find the apex (the standard 45-deg hip
  // projection). Eave corners are pushed outward by the configured
  // overhang so the synthetic triangle visually matches the closed
  // hip-cap polygon. Works for orthogonal footprints (rectangle,
  // L-shape, U-shape); the apex distance heuristic (eave/2) is the
  // exact answer for a rectangle's hip and a close approximation for
  // joined-roof wings whose short dimension equals the terminal
  // edge's length.
  const eaveOverhangMm =
    typeof houseModel.eave?.eaveOverhangMm === 'number' ? houseModel.eave.eaveOverhangMm : 0;
  const syntheticOpenShapes: GeometryTopProjectionShape[] = [];
  for (const segment of probePoints) {
    if (!segment.isOpen) continue;
    if (matchedEndIds.has(segment.endId)) continue;
    const dx = segment.b.x - segment.a.x;
    const dy = segment.b.y - segment.a.y;
    const length = Math.hypot(dx, dy);
    if (length <= 1e-6) continue;
    let centroidX = 0;
    let centroidY = 0;
    for (const point of houseModel.footprint) {
      centroidX += point.x;
      centroidY += point.y;
    }
    centroidX /= houseModel.footprint.length;
    centroidY /= houseModel.footprint.length;
    const midX = (segment.a.x + segment.b.x) / 2;
    const midY = (segment.a.y + segment.b.y) / 2;
    const perpA = { x: -dy / length, y: dx / length };
    const perpB = { x: dy / length, y: -dx / length };
    const dotA = perpA.x * (centroidX - midX) + perpA.y * (centroidY - midY);
    const inward = dotA >= 0 ? perpA : perpB;
    const outward = { x: -inward.x, y: -inward.y };
    const apexInset = length / 2;
    const apex: Point2 = {
      x: midX + inward.x * apexInset,
      y: midY + inward.y * apexInset,
    };
    // Eave overhang is applied PERPENDICULAR to the edge (outward) AND
    // ALONG the edge in both directions -- the closed hip cap's
    // polygon includes the corner overhangs that wrap around the
    // adjacent walls. Without the along-edge extension, the synthetic
    // is narrower at the eave than the real hip cap and misses clicks
    // on the corner overhang region.
    const alongEdgeUnit = { x: dx / length, y: dy / length };
    const eaveStart: Point2 = {
      x: segment.a.x + outward.x * eaveOverhangMm - alongEdgeUnit.x * eaveOverhangMm,
      y: segment.a.y + outward.y * eaveOverhangMm - alongEdgeUnit.y * eaveOverhangMm,
    };
    const eaveEnd: Point2 = {
      x: segment.b.x + outward.x * eaveOverhangMm + alongEdgeUnit.x * eaveOverhangMm,
      y: segment.b.y + outward.y * eaveOverhangMm + alongEdgeUnit.y * eaveOverhangMm,
    };
    syntheticOpenShapes.push({
      id: `house_terminal_end_synthetic:${segment.endId}`,
      sourceObjectId: segment.endId,
      sourceId: segment.endId,
      // Use the same sourceType as a real hip cap so the existing
      // top-projection plan-layer routing puts it in committedBodies
      // (and hence the hit-target build pass), without needing a
      // bespoke layer rule.
      sourceType: 'house_surface_solid',
      family: 'house',
      kind: 'roof',
      polygon: [apex, eaveStart, eaveEnd],
      zOrder: 2,
      zMin: 0,
      zMax: 0,
      metadata: {
        topProjectionRole: 'top_visible',
        openGableEndId: segment.endId,
        isOpen: true,
      },
    });
  }
  if (syntheticOpenShapes.length === 0) return enrichedShapes;
  return [...enrichedShapes, ...syntheticOpenShapes];
}

function shapeExtents(shapes: GeometryTopProjectionShape[]): GeometryTopProjectionViewModel['extents'] {
  const points = shapes
    .filter((shape) => {
      if (shape.metadata?.topProjectionRole === 'hidden_from_top') return false;
      if (shape.sourceType === 'house_line' || shape.sourceType === 'reference_line') return false;
      return true;
    })
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
  if (screenAxis !== 'world_x_left_world_y_down') {
    issues.push({
      code: 'screen_axis_mismatch',
      message: `Expected top projection screen axis world_x_left_world_y_down, received ${screenAxis}.`,
    });
  }

  for (const shape of topVisibleShapes) {
    if (shape.sourceType === 'house_reference' || shape.sourceType === 'pergola_reference') continue;
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
      .filter(
        (shape) =>
          shape.sourceType !== 'house_reference' &&
          shape.sourceType !== 'pergola_reference' &&
          sceneObjectIds.has(shape.sourceObjectId),
      )
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
  const baseShapes = [
    ...(options.referenceShapes ?? []),
    ...scene.layers.flatMap((layer) => layer.objects.map(buildShapeFromObject).filter((shape): shape is GeometryTopProjectionShape => Boolean(shape))),
  ].sort((left, right) => left.zOrder - right.zOrder || left.id.localeCompare(right.id));
  const shapes = options.terminalEndAssembly
    ? enrichHouseRoofShapesWithTerminalEnds(baseShapes, options.terminalEndAssembly)
    : baseShapes;

  return {
    coordinateSpace: 'world_xy_mm',
    screenAxis: {
      x: 'world_x_left',
      y: 'world_y_down',
    },
    shapes,
    extents: shapeExtents(shapes),
  };
}

export function buildHouseModelTopProjectionShapes(input: {
  model: HouseModel3D | null;
}): GeometryTopProjectionShape[] {
  const model = input.model;
  if (!model) return [];
  const houseObjects = buildHouseModelSceneObjects({
    model,
    attachmentTarget: null,
  });
  const roofMaterialObjects = buildHouseModelRoofMaterialSceneObjects({
    model,
  });
  const projection = buildTopProjectionViewModelFromScene({
    layers: [
      {
        id: 'house',
        label: 'House',
        visibleByDefault: true,
        objects: houseObjects,
      },
      ...(roofMaterialObjects.length > 0
        ? [
            {
              id: 'house_roof_materials',
              label: 'House Roof Materials',
              visibleByDefault: true,
              objects: roofMaterialObjects,
            },
          ]
        : []),
    ],
  });
  return projection.shapes;
}

export function buildTopProjectionViewModel(
  assembly: Assembly3D,
  options: { referenceIdentifiers?: ReferenceShapeIdentifiers } = {},
): GeometryTopProjectionViewModel {
  return buildTopProjectionViewModelFromScene(buildViewerSceneModel(assembly), {
    referenceShapes: buildReferenceShapes(assembly, options.referenceIdentifiers),
    terminalEndAssembly: assembly,
  });
}

/**
 * One pergola entry for a project-level topProjection. Each pergola provides
 * its own assembly (the geometry source) plus a stable `pergolaSourceId` used
 * to disambiguate the emitted reference shape's id from other pergolas in the
 * same project.
 */
export type ProjectPergolaEntry = {
  assembly: Assembly3D;
  pergolaSourceId: string;
};

/**
 * Build a single `house_reference` shape from a standalone
 * `HouseReferenceGeometry`. Used by multi-form workbench rendering
 * (PR8c-iii): the portal builds per-form geometry via
 * the portal house-form reference geometry builder (which composes
 * `buildHouseModel3DFromRawHouseInput` + `applyHouseReferencePosition`)
 * and converts the result into a project-level reference shape so
 * `PlanViewport`'s projection-context overlay can render every form
 * at its world transform.
 *
 * Mirrors the `house_reference` emission inside `buildReferenceShapes`
 * but takes a `HouseReferenceGeometry` directly instead of pulling it
 * out of an `Assembly3D`. The polygon prefers `model.footprint`
 * (post-transform world coords from `buildHouseModel3D`) over the
 * legacy reference `footprint` field, matching the existing precedence
 * inside `buildReferenceShapes`.
 *
 * Returns `null` when no usable footprint exists (e.g. degenerate
 * polygon).
 */
export function buildHouseReferenceProjectionShape(input: {
  house: HouseReferenceGeometry;
  houseSourceId: string;
}): GeometryTopProjectionShape | null {
  const footprint = input.house.model?.footprint ?? input.house.footprint ?? null;
  if (!footprint) return null;
  const polygon = cleanPolygon(toPolygon2(footprint));
  if (!polygon) return null;
  return {
    id: `house_reference:${input.houseSourceId}`,
    sourceObjectId: input.houseSourceId,
    sourceId: input.houseSourceId,
    sourceType: 'house_reference',
    family: 'house',
    kind: 'footprint',
    polygon,
    zOrder: 0,
    zMin: 0,
    zMax: 0,
    metadata: {
      ...metadataWithTopProjectionRole(input.house.model?.metadata as GeometryMetadata | undefined, 'top_visible'),
      isCanonicalOutline: true,
    },
  };
}

/**
 * Build the project-level REFERENCE shapes — one canonical `house_reference`
 * (when any pergola carries house data) plus one `pergola_reference` per
 * pergola entry. Step 5c of the first-class spatial-entities migration.
 *
 * Why "reference shapes only" and not full per-pergola scene aggregation:
 * each pergola's viewer scene includes interior objects (posts, beams,
 * rafters) whose object ids collide across pergolas (e.g., both pergolas
 * have a `post-0`). Aggregating full scenes requires pergola-prefixed
 * object ids, which is a separate slice (Step 5d). Reference shapes are
 * enough to render the visible outline of every pergola in one canvas —
 * the per-pergola detail rendering stays at the module level for now.
 *
 * House dedupe: when multiple pergola entries are passed and they share the
 * same house, only ONE house_reference is emitted (from the first entry
 * that has house data). Caller-supplied `houseSourceId` is the canonical
 * id for that single emission.
 */
export function buildProjectReferenceShapes(input: {
  pergolas: ReadonlyArray<ProjectPergolaEntry>;
  houseSourceId?: string | null;
}): GeometryTopProjectionShape[] {
  const out: GeometryTopProjectionShape[] = [];
  const houseSourceId = input.houseSourceId ?? null;
  let emittedHouse = false;

  for (const entry of input.pergolas) {
    const shapes = buildReferenceShapes(entry.assembly, {
      pergolaSourceId: entry.pergolaSourceId,
      houseSourceId: houseSourceId ?? undefined,
    });
    for (const shape of shapes) {
      if (shape.sourceType === 'house_reference') {
        if (emittedHouse) continue;
        emittedHouse = true;
      }
      out.push(shape);
    }
  }

  return out;
}
