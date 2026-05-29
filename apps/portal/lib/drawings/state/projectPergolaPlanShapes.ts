import type {
  GeometryTopProjectionShape,
  GeometryTopProjectionViewModel,
} from '@sp/geometry';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';

type ProjectPergolaPlanSource = {
  moduleInput: Pick<CalculatorModuleInputs, 'pergolaId'>;
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

export function buildProjectPergolaPlanShapesFromModules(
  modules: ReadonlyArray<ProjectPergolaPlanSource>,
): GeometryTopProjectionShape[] {
  const seenPergolaIds = new Set<string>();
  const shapes: GeometryTopProjectionShape[] = [];
  for (const module of modules) {
    const pergolaId = module.moduleInput.pergolaId;
    if (!pergolaId || seenPergolaIds.has(pergolaId)) continue;
    const projection = module.geometryTopProjection;
    if (!projection) continue;
    const pergolaShapes = projection.shapes.filter((shape) => shape.family === 'pergola');
    if (pergolaShapes.length === 0) continue;
    seenPergolaIds.add(pergolaId);
    shapes.push(...pergolaShapes.map((shape) => prefixProjectPergolaPlanShape(shape, pergolaId)));
  }
  return shapes;
}
