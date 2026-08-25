import type { Assembly3D, Line3, Point3, Vector3 } from './contracts';

export type PergolaInteractionEdgeId = 'front' | 'left' | 'right' | 'rear';

export type PergolaInteractionEdge = {
  id: PergolaInteractionEdgeId;
  centerline: Line3;
  outwardNormal: Vector3;
  bottomZ: number;
  topZ: number;
  hosted: boolean;
};

export type PergolaLightingRun = {
  id: string;
  centerline: Line3;
  kind: 'rafter' | 'perimeter';
};

/**
 * Physical interaction anchors for one solved pergola assembly.
 *
 * IDs are stable only within the supplied Assembly3D. Project-level consumers
 * must pair them with their own assembly identity instead of extending this
 * geometry contract with source-object identity.
 */
export type PergolaInteractionAnchors = {
  edges: PergolaInteractionEdge[];
  lightingRuns: PergolaLightingRun[];
};

type SemanticEdge = {
  id: PergolaInteractionEdgeId;
  start: Point3;
  end: Point3;
};

const EDGE_ORDER: PergolaInteractionEdgeId[] = ['front', 'left', 'right', 'rear'];
const DISTANCE_EPSILON = 1e-6;

function clonePoint(point: Point3): Point3 {
  return { x: point.x, y: point.y, z: point.z };
}

function cloneLine(centerline: Line3): Line3 {
  return {
    start: clonePoint(centerline.start),
    end: clonePoint(centerline.end),
  };
}

function midpoint(line: Line3): Point3 {
  return {
    x: (line.start.x + line.end.x) / 2,
    y: (line.start.y + line.end.y) / 2,
    z: (line.start.z + line.end.z) / 2,
  };
}

function distanceToSegmentXY(point: Point3, edge: SemanticEdge): number {
  const dx = edge.end.x - edge.start.x;
  const dy = edge.end.y - edge.start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= DISTANCE_EPSILON) {
    return Math.hypot(point.x - edge.start.x, point.y - edge.start.y);
  }

  const projection = Math.max(
    0,
    Math.min(
      1,
      ((point.x - edge.start.x) * dx + (point.y - edge.start.y) * dy) /
        lengthSquared,
    ),
  );
  return Math.hypot(
    point.x - (edge.start.x + projection * dx),
    point.y - (edge.start.y + projection * dy),
  );
}

function buildSemanticEdges(assembly: Assembly3D): SemanticEdge[] {
  if (assembly.outline.length !== 4) {
    throw new Error(
      'Pergola interaction anchors require a four-edge Assembly3D outline.',
    );
  }

  const [rearLeft, rearRight, frontRight, frontLeft] = assembly.outline;
  if (!rearLeft || !rearRight || !frontRight || !frontLeft) {
    throw new Error(
      'Pergola interaction anchors require a complete Assembly3D outline.',
    );
  }

  return [
    { id: 'front', start: frontLeft, end: frontRight },
    { id: 'left', start: rearLeft, end: frontLeft },
    { id: 'right', start: rearRight, end: frontRight },
    { id: 'rear', start: rearLeft, end: rearRight },
  ];
}

function collectPergolaPoints(assembly: Assembly3D): Point3[] {
  return [
    ...assembly.outline,
    ...(assembly.attachmentEdge
      ? [assembly.attachmentEdge.start, assembly.attachmentEdge.end]
      : []),
    ...assembly.members.flatMap((member) => [
      member.centerline.start,
      member.centerline.end,
    ]),
    ...assembly.roofPlanes.flatMap((roofPlane) => roofPlane.boundary),
    ...assembly.roofCladdingPanels.flatMap((panel) => panel.boundary),
    ...(assembly.roofFlashings ?? []).flatMap((flashing) =>
      flashing.wings.flatMap((wing) => wing.boundary),
    ),
  ];
}

function collectEdgePoints(
  edge: SemanticEdge,
  allEdges: SemanticEdge[],
  points: Point3[],
): Point3[] {
  return points.filter((point) => {
    const edgeDistance = distanceToSegmentXY(point, edge);
    const nearestDistance = Math.min(
      ...allEdges.map((candidate) => distanceToSegmentXY(point, candidate)),
    );
    return Math.abs(edgeDistance - nearestDistance) <= DISTANCE_EPSILON;
  });
}

function buildOutwardNormal(edge: SemanticEdge, outlineCenter: Point3): Vector3 {
  const dx = edge.end.x - edge.start.x;
  const dy = edge.end.y - edge.start.y;
  const length = Math.hypot(dx, dy);
  if (length <= DISTANCE_EPSILON) {
    throw new Error(`Pergola interaction edge ${edge.id} has zero plan length.`);
  }

  const candidate = { x: -dy / length, y: dx / length, z: 0 };
  const edgeCenter = midpoint({ start: edge.start, end: edge.end });
  const towardOutside = {
    x: edgeCenter.x - outlineCenter.x,
    y: edgeCenter.y - outlineCenter.y,
  };
  const direction =
    candidate.x * towardOutside.x + candidate.y * towardOutside.y >= 0 ? 1 : -1;
  return {
    x: candidate.x * direction || 0,
    y: candidate.y * direction || 0,
    z: 0,
  };
}

function resolveHostedEdgeId(
  attachmentEdge: Line3 | null,
  edges: SemanticEdge[],
): PergolaInteractionEdgeId | null {
  if (!attachmentEdge) return null;

  const attachmentCenter = midpoint(attachmentEdge);
  return edges.reduce((nearest, edge) => {
    const distance = distanceToSegmentXY(attachmentCenter, edge);
    return distance < nearest.distance ? { id: edge.id, distance } : nearest;
  }, { id: edges[0]!.id, distance: Number.POSITIVE_INFINITY }).id;
}

/**
 * Derive interaction positions from a solved, post-transform Assembly3D.
 * The builder deliberately accepts no source config or authored-object data.
 */
export function buildPergolaInteractionAnchors(
  assembly: Assembly3D,
): PergolaInteractionAnchors {
  const semanticEdges = buildSemanticEdges(assembly);
  const pergolaPoints = collectPergolaPoints(assembly);
  const outlineCenter = {
    x: assembly.outline.reduce((sum, point) => sum + point.x, 0) / assembly.outline.length,
    y: assembly.outline.reduce((sum, point) => sum + point.y, 0) / assembly.outline.length,
    z: assembly.outline.reduce((sum, point) => sum + point.z, 0) / assembly.outline.length,
  };
  const hostedEdgeId = resolveHostedEdgeId(assembly.attachmentEdge, semanticEdges);

  const edges = semanticEdges.map((edge): PergolaInteractionEdge => {
    const edgePoints = collectEdgePoints(edge, semanticEdges, pergolaPoints);
    const bottomZ = Math.min(...edgePoints.map((point) => point.z));
    const topZ = Math.max(...edgePoints.map((point) => point.z));
    const centerZ = (bottomZ + topZ) / 2;
    return {
      id: edge.id,
      centerline: {
        start: { x: edge.start.x, y: edge.start.y, z: centerZ },
        end: { x: edge.end.x, y: edge.end.y, z: centerZ },
      },
      outwardNormal: buildOutwardNormal(edge, outlineCenter),
      bottomZ,
      topZ,
      hosted: edge.id === hostedEdgeId,
    };
  });

  const edgeById = new Map(edges.map((edge) => [edge.id, edge]));
  const rafterRuns = assembly.members
    .filter((member) => member.role === 'rafter')
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((member): PergolaLightingRun => ({
      id: `rafter:${member.id}`,
      centerline: cloneLine(member.centerline),
      kind: 'rafter',
    }));
  const perimeterRuns = EDGE_ORDER.map((edgeId): PergolaLightingRun => ({
    id: `perimeter:${edgeId}`,
    centerline: cloneLine(edgeById.get(edgeId)!.centerline),
    kind: 'perimeter',
  }));

  return {
    edges,
    lightingRuns: [...rafterRuns, ...perimeterRuns],
  };
}
