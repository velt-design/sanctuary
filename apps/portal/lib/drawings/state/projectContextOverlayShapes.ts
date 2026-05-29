import type { GeometryTopProjectionShape } from '@sp/geometry';

/**
 * Filter project-level references for the faded context overlay. Valid
 * pergolas that already have full project-wide plan detail are dropped here;
 * the remaining references are fallback visuals and selectable outlines for
 * unsupported or invalid pergolas.
 */
export function buildProjectContextOverlayShapes(input: {
  projectReferenceShapes: ReadonlyArray<GeometryTopProjectionShape>;
  activePergolaSourceId: string | null;
  fullDetailPergolaSourceIds?: ReadonlySet<string> | ReadonlyArray<string>;
}): GeometryTopProjectionShape[] {
  const fullDetailPergolaSourceIds =
    input.fullDetailPergolaSourceIds instanceof Set
      ? input.fullDetailPergolaSourceIds
      : new Set(input.fullDetailPergolaSourceIds ?? []);
  return input.projectReferenceShapes.filter((shape) => {
    if (shape.sourceType === 'house_reference') return false;
    if (
      shape.sourceType === 'pergola_reference' &&
      shape.sourceObjectId &&
      fullDetailPergolaSourceIds.has(shape.sourceObjectId)
    ) {
      return false;
    }
    if (
      shape.sourceType === 'pergola_reference' &&
      input.activePergolaSourceId &&
      shape.sourceObjectId === input.activePergolaSourceId
    ) {
      return false;
    }
    return true;
  });
}
