import {
  buildHouseModelTopProjectionShapes,
  buildTopProjectionViewModelFromScene,
  type GeometryTopProjectionShape,
  type GeometryTopProjectionViewModel,
} from '@sp/geometry';
import type { ProjectHouseGeometryEntry } from './projectHouseGeometryRegistry';

function projectPergolaShapeIdentity(shape: GeometryTopProjectionShape): string | null {
  const taggedPergolaId =
    typeof shape.metadata?.pergolaId === 'string' ? shape.metadata.pergolaId : null;
  return taggedPergolaId ?? shape.sourceObjectId ?? shape.sourceId ?? null;
}

function dedupeTopProjectionShapes(
  shapes: ReadonlyArray<GeometryTopProjectionShape>,
): GeometryTopProjectionShape[] {
  const seen = new Set<string>();
  const deduped: GeometryTopProjectionShape[] = [];
  for (const shape of shapes) {
    if (seen.has(shape.id)) continue;
    seen.add(shape.id);
    deduped.push(shape);
  }
  return deduped;
}

export function buildProjectPlanProjection(input: {
  projectHouseGeometries: ReadonlyArray<ProjectHouseGeometryEntry>;
  projectPergolaPlanShapes: ReadonlyArray<GeometryTopProjectionShape>;
  projectReferenceShapes: ReadonlyArray<GeometryTopProjectionShape>;
}): GeometryTopProjectionViewModel | null {
  const fullDetailPergolaSourceIds = new Set(
    input.projectPergolaPlanShapes
      .map(projectPergolaShapeIdentity)
      .filter((value): value is string => Boolean(value)),
  );
  const houseShapes = input.projectHouseGeometries.flatMap((entry) => [
    entry.referenceShape,
    ...buildHouseModelTopProjectionShapes({
      model: entry.model,
    }),
  ]);
  const unresolvedPergolaReferences = input.projectReferenceShapes.filter((shape) => {
    if (shape.sourceType !== 'pergola_reference') return false;
    const pergolaId = projectPergolaShapeIdentity(shape);
    return !pergolaId || !fullDetailPergolaSourceIds.has(pergolaId);
  });
  const shapes = dedupeTopProjectionShapes([
    ...houseShapes,
    ...input.projectPergolaPlanShapes,
    ...unresolvedPergolaReferences,
  ]);
  if (shapes.length === 0) return null;
  return buildTopProjectionViewModelFromScene(
    { layers: [] },
    { referenceShapes: shapes },
  );
}
