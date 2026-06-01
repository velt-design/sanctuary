import {
  buildHouseModelTopProjectionShapes,
  buildTopProjectionViewModelFromScene,
  type GeometryTopProjectionShape,
  type GeometryTopProjectionViewModel,
} from '@sp/geometry';
import type { ProjectHouseGeometryEntry } from './projectHouseGeometryRegistry';

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
}): GeometryTopProjectionViewModel | null {
  const houseShapes = input.projectHouseGeometries.flatMap((entry) => [
    entry.referenceShape,
    ...buildHouseModelTopProjectionShapes({
      model: entry.model,
    }),
  ]);
  const shapes = dedupeTopProjectionShapes([
    ...houseShapes,
    ...input.projectPergolaPlanShapes,
  ]);
  if (shapes.length === 0) return null;
  return buildTopProjectionViewModelFromScene(
    { layers: [] },
    { referenceShapes: shapes },
  );
}
