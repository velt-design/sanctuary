import {
  buildTopProjectionViewModelFromScene,
  type GeometryTopProjectionShape,
  type GeometryTopProjectionViewModel,
} from '@sp/geometry';

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
  projectHousePlanShapes: ReadonlyArray<GeometryTopProjectionShape>;
  projectPergolaPlanShapes: ReadonlyArray<GeometryTopProjectionShape>;
}): GeometryTopProjectionViewModel | null {
  const shapes = dedupeTopProjectionShapes([
    ...input.projectHousePlanShapes,
    ...input.projectPergolaPlanShapes,
  ]);
  if (shapes.length === 0) return null;
  return buildTopProjectionViewModelFromScene(
    { layers: [] },
    { referenceShapes: shapes },
  );
}
