import type {
  GeometryTopProjectionShape,
  GeometryTopProjectionViewModel,
} from '@sp/geometry';

type ProjectPergolaPlanSource = {
  pergolaId?: string | null;
  geometryTopProjection: Pick<GeometryTopProjectionViewModel, 'shapes'> | null;
};

function projectPergolaShapeIdPrefix(pergolaId: string): string {
  return `project_pergola:${pergolaId}:`;
}

function prefixProjectPergolaPlanShape(
  shape: GeometryTopProjectionShape,
  pergolaId: string,
): GeometryTopProjectionShape {
  const prefix = projectPergolaShapeIdPrefix(pergolaId);
  const prefixedId = shape.id.startsWith(prefix) ? shape.id : `${prefix}${shape.id}`;
  const prefixedSourceId =
    shape.sourceId && !shape.sourceId.startsWith(prefix)
      ? `${prefix}${shape.sourceId}`
      : shape.sourceId;
  return {
    ...shape,
    id: prefixedId,
    sourceId: prefixedSourceId,
    metadata: {
      ...(shape.metadata ?? {}),
      pergolaId,
    },
  };
}

export function buildProjectPergolaPlanShapesFromPergolaArtifacts(
  pergolaArtifacts: ReadonlyArray<ProjectPergolaPlanSource>,
): GeometryTopProjectionShape[] {
  const seenPergolaIds = new Set<string>();
  const shapes: GeometryTopProjectionShape[] = [];
  for (const artifact of pergolaArtifacts) {
    const pergolaId = artifact.pergolaId;
    if (!pergolaId || seenPergolaIds.has(pergolaId)) continue;
    const projection = artifact.geometryTopProjection;
    if (!projection) continue;
    const pergolaShapes = projection.shapes.filter((shape) => shape.family === 'pergola');
    if (pergolaShapes.length === 0) continue;
    seenPergolaIds.add(pergolaId);
    shapes.push(...pergolaShapes.map((shape) => prefixProjectPergolaPlanShape(shape, pergolaId)));
  }
  return shapes;
}
