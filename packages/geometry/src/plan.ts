import type {
  Assembly3D,
  GeometryPlanHouseLine2D,
  GeometryPlanHouseSurface2D,
  GeometryPlanMember2D,
  GeometryPlanSurface2D,
  GeometryPlanViewModel,
  Line2,
  Point2,
  Polygon2,
  Vector2,
} from './contracts';

function toPoint2(point: { x: number; y: number }): Point2 {
  return {
    x: Number(point.x.toFixed(6)),
    y: Number(point.y.toFixed(6)),
  };
}

function toLine2(line: { start: { x: number; y: number }; end: { x: number; y: number } }): Line2 {
  return {
    start: toPoint2(line.start),
    end: toPoint2(line.end),
  };
}

function toPolygon2(points: Array<{ x: number; y: number }>): Polygon2 {
  return points.map(toPoint2);
}

function sortById<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

function lineLength2(line: Line2): number {
  return Math.hypot(line.end.x - line.start.x, line.end.y - line.start.y);
}

function midpoint(line: Line2): Point2 {
  return {
    x: Number(((line.start.x + line.end.x) / 2).toFixed(6)),
    y: Number(((line.start.y + line.end.y) / 2).toFixed(6)),
  };
}

function normalizeVector2(vector: Vector2): Vector2 {
  const magnitude = Math.hypot(vector.x, vector.y);
  if (magnitude <= 0) {
    return { x: 0, y: 0 };
  }
  return {
    x: Number((vector.x / magnitude).toFixed(6)),
    y: Number((vector.y / magnitude).toFixed(6)),
  };
}

function polygonCentroid(points: Polygon2): Point2 {
  if (!points.length) {
    return { x: 0, y: 0 };
  }

  const total = points.reduce(
    (acc, point) => ({
      x: acc.x + point.x,
      y: acc.y + point.y,
    }),
    { x: 0, y: 0 },
  );

  return {
    x: Number((total.x / points.length).toFixed(6)),
    y: Number((total.y / points.length).toFixed(6)),
  };
}

function dedupeNumbers(values: number[], tolerance = 0.5): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.filter((value, index) => index === 0 || Math.abs(value - sorted[index - 1]!) > tolerance);
}

function buildPlanMember(member: Assembly3D['members'][number]): GeometryPlanMember2D {
  const centerline = toLine2(member.centerline);
  return {
    id: member.id,
    role: member.role,
    centerline,
    profile: member.profile,
    lengthMm: Number(lineLength2(centerline).toFixed(3)),
    metadata: member.metadata,
  };
}

function buildPlanSurface(
  surface: Assembly3D['roofPlanes'][number] | Assembly3D['roofCladdingPanels'][number],
  kind: GeometryPlanSurface2D['kind'],
): GeometryPlanSurface2D {
  return {
    id: surface.id,
    kind,
    boundary: toPolygon2(surface.boundary),
    metadata: surface.metadata,
  };
}

function withKindMetadata(kind: string, metadata?: Record<string, string | number | boolean | null>): Record<string, string | number | boolean | null> {
  return {
    ...(metadata ?? {}),
    kind,
  };
}

function buildPlanHouseObjects(assembly: Assembly3D): {
  surfaces: GeometryPlanHouseSurface2D[];
  lines: GeometryPlanHouseLine2D[];
} {
  const model = assembly.house.model;
  if (!model || assembly.semantics.connectionType === 'freestanding') {
    return { surfaces: [], lines: [] };
  }

  const surfaces: GeometryPlanHouseSurface2D[] = [
    {
      id: 'house-footprint',
      kind: 'footprint',
      boundary: toPolygon2(model.footprint),
      metadata: withKindMetadata('footprint', model.metadata),
    },
    ...model.roofPlanes.map((roofPlane) => ({
      id: roofPlane.id,
      kind: 'roof' as const,
      boundary: toPolygon2(roofPlane.boundary),
      metadata: withKindMetadata('roof', roofPlane.metadata),
    })),
    ...(model.eave.soffitPolygons ?? []).map((polygon, index) => ({
      id: `house-soffit-${index + 1}`,
      kind: 'soffit' as const,
      boundary: toPolygon2(polygon),
      metadata: withKindMetadata('soffit', model.eave.metadata),
    })),
    ...(model.eave.fasciaPolygons ?? []).map((polygon, index) => ({
      id: `house-fascia-${index + 1}`,
      kind: 'fascia' as const,
      boundary: toPolygon2(polygon),
      metadata: withKindMetadata('fascia', model.eave.metadata),
    })),
    ...(model.decks ?? []).map((deck) => ({
      id: deck.id,
      kind: 'deck' as const,
      boundary: toPolygon2(deck.boundary),
      metadata: withKindMetadata('deck', deck.metadata),
    })),
  ];

  if (model.attachmentTarget?.zone?.boundary) {
    surfaces.push({
      id: 'house-attachment-zone',
      kind: 'attachment_zone',
      boundary: toPolygon2(model.attachmentTarget.zone.boundary),
      metadata: withKindMetadata(model.attachmentTarget.strategy, model.attachmentTarget.zone.metadata ?? model.attachmentTarget.metadata),
    });
  }

  const lines: GeometryPlanHouseLine2D[] = [
    ...model.wallSegments.map((segment) => ({
      id: segment.id,
      kind: 'wall_segment' as const,
      line: toLine2(segment.line),
      metadata: withKindMetadata('wall_segment', segment.metadata),
    })),
    ...(model.roofFeatures ?? []).map((feature) => ({
      id: feature.id,
      kind: 'roof_feature' as const,
      line: toLine2(feature.line),
      metadata: withKindMetadata(feature.kind, feature.metadata),
    })),
    ...(model.eave.gutterLines ?? []).map((line, index) => ({
      id: `house-gutter-${index + 1}`,
      kind: 'gutter' as const,
      line: toLine2(line),
      metadata: withKindMetadata('gutter', model.eave.metadata),
    })),
  ];

  const target = model.attachmentTarget;
  const targetLine = target?.line ?? target?.zone?.safeLine ?? null;
  if (targetLine && target && target.kind !== 'none') {
    lines.push({
      id: 'house-attachment-target',
      kind: 'attachment_target',
      line: toLine2(targetLine),
      metadata: withKindMetadata(target.strategy, target.metadata),
    });
  }

  return {
    surfaces: sortById(surfaces),
    lines: sortById(lines),
  };
}

export function buildPlanViewModel(assembly: Assembly3D): GeometryPlanViewModel {
  const outline = toPolygon2(assembly.outline);
  const xValues = outline.map((point) => point.x);
  const yValues = outline.map((point) => point.y);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const lengthMm = Number((maxX - minX).toFixed(3));
  const projectionMm = Number((maxY - minY).toFixed(3));
  const attachmentEdge = assembly.attachmentEdge ? toLine2(assembly.attachmentEdge) : null;

  const allMembers = sortById(assembly.members.map(buildPlanMember));
  const posts = allMembers.filter((member) => member.role === 'post');
  const beams = allMembers.filter((member) => member.role === 'beam' || member.role === 'brace');
  const ledgers = allMembers.filter((member) => member.role === 'ledger');
  const rafters = allMembers.filter((member) => member.role === 'rafter');
  const gutters = allMembers.filter((member) => member.role === 'gutter');
  const ridge = allMembers.filter((member) => member.role === 'ridge');
  const joiners = allMembers.filter((member) => member.role === 'joiner');
  const roofPlanes = sortById(assembly.roofPlanes.map((surface) => buildPlanSurface(surface, 'roof_plane')));
  const roofCladding = sortById((assembly.roofCladdingPanels ?? []).map((surface) => buildPlanSurface(surface, 'roof_cladding')));

  const roofPlaneForFall = roofPlanes[0] ?? null;
  const roofPlane3DForFall = sortById(assembly.roofPlanes)[0] ?? null;
  const fallDirection =
    roofPlaneForFall && roofPlane3DForFall
      ? normalizeVector2({
          x: roofPlane3DForFall.fallVector.x,
          y: roofPlane3DForFall.fallVector.y,
        })
      : null;

  const rafterPositionsMm = dedupeNumbers(rafters.map((rafter) => midpoint(rafter.centerline).x));
  const spacingLine =
    attachmentEdge ??
    ({
      start: { x: minX, y: minY },
      end: { x: maxX, y: minY },
    } satisfies Line2);

  const ridgeLine = ridge[0]?.centerline ?? null;
  const houseObjects = buildPlanHouseObjects(assembly);

  return {
    family: assembly.family,
    connectionType: assembly.semantics.connectionType,
    roofForm: {
      mono: assembly.family === 'mono',
      gable: assembly.family === 'gable' || assembly.family === 'hip',
      box: assembly.family === 'box',
      hip: assembly.family === 'hip',
      hipCorner: assembly.family === 'hip_corner',
    },
    outline,
    attachmentEdge,
    house: {
      footprint: assembly.house.footprint ? toPolygon2(assembly.house.footprint) : null,
      fasciaLine: assembly.house.fasciaLine ? toLine2(assembly.house.fasciaLine) : null,
      roofEdgeLine: assembly.house.roofEdgeLine ? toLine2(assembly.house.roofEdgeLine) : null,
      wallReferenceLine: assembly.house.wallPlane ? attachmentEdge : null,
      surfaces: houseObjects.surfaces,
      lines: houseObjects.lines,
    },
    members: {
      posts,
      beams,
      ledgers,
      rafters,
      gutters,
      ridge,
      joiners,
    },
    surfaces: {
      roofPlanes,
      roofCladding,
    },
    anchors: {
      primarySize: {
        length: {
          start: { x: minX, y: minY },
          end: { x: maxX, y: minY },
        },
        projection: {
          start: { x: minX, y: minY },
          end: { x: minX, y: maxY },
        },
      },
      fall:
        roofPlaneForFall && fallDirection
          ? {
              point: polygonCentroid(roofPlaneForFall.boundary),
              direction: fallDirection,
              dual: assembly.family === 'gable' || assembly.family === 'hip',
            }
          : null,
      rafterSpacing:
        rafterPositionsMm.length > 0
          ? {
              line: spacingLine,
              positionsMm: rafterPositionsMm,
            }
          : null,
      ridgeLine,
      attachmentSide: attachmentEdge
        ? {
            line: attachmentEdge,
          }
        : null,
    },
    extents: {
      minX: Number(minX.toFixed(3)),
      minY: Number(minY.toFixed(3)),
      maxX: Number(maxX.toFixed(3)),
      maxY: Number(maxY.toFixed(3)),
      lengthMm,
      projectionMm,
    },
  };
}
