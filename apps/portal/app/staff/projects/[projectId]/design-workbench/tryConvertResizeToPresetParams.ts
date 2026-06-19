import type { AttachmentSide, Point2 } from '@sp/geometry';

/**
 * PR-WB-RESIZE-KEEPS-PRESET (2026-06-19): pure helper used by the
 * edge-drag commit handler to recover preset+straight params from
 * a resized polygon, instead of writing the polygon as a freeform
 * custom_polygon and dropping the form's composition.
 *
 * When a designer drags a wall edge of a preset+straight form,
 * the EdgeDragTool produces a new polygon in world mm. The handler
 * converts that into form-local mm. For a clean axis-aligned drag,
 * the form-local polygon is still a 4-vertex rectangle — we just
 * extract its bounding box and invert the legacy
 * `houseFootprintSideLocalPointToWorld` math to recover
 * (widthM, bandDepthM, offsetXM, setbackM).
 *
 * Returns null and the caller falls back to the existing
 * `custom_polygon` commit when:
 *   - the source form isn't preset+straight (L/U/recess/wrap
 *     have richer params; out of scope for v1 of this fix)
 *   - the form has non-zero rotation (quarter-turn drags are
 *     world-space-rotated — the conversion math hasn't been
 *     verified for those yet)
 *   - attachmentSide isn't 'rear' (the only side with the
 *     verified legacy frame math)
 *   - the new polygon isn't 4 vertices
 *   - the polygon's edges aren't axis-aligned (designer dragged
 *     into a non-rectangle shape somehow)
 *   - the resulting dimensions are non-positive
 *
 * Output dimensions are emitted as metre-formatted strings to
 * match the workbench's string-vocabulary for footprint params.
 */
export type ResizePresetParams = {
  widthM: string;
  bandDepthM: string;
  offsetXM: string;
  setbackM: string;
};

export function tryConvertResizeToPresetParams(input: {
  formLocalPolygonMm: ReadonlyArray<Point2>;
  sourceMode: string;
  sourcePreset: string;
  sourceAttachmentSide: AttachmentSide | string | null;
  sourceRotationQuarterTurns: number;
}): ResizePresetParams | null {
  if (input.sourceMode !== 'preset') return null;
  if (input.sourcePreset !== 'straight') return null;
  if (input.sourceAttachmentSide !== 'rear') return null;
  if (input.sourceRotationQuarterTurns !== 0) return null;
  if (input.formLocalPolygonMm.length !== 4) return null;
  const points = input.formLocalPolygonMm;
  const TOL_MM = 1;
  for (let i = 0; i < 4; i += 1) {
    const a = points[i]!;
    const b = points[(i + 1) % 4]!;
    const horizontal = Math.abs(a.y - b.y) <= TOL_MM;
    const vertical = Math.abs(a.x - b.x) <= TOL_MM;
    if (!horizontal && !vertical) return null;
  }
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const widthMm = xMax - xMin;
  const bandDepthMm = yMax - yMin;
  if (widthMm <= 0 || bandDepthMm <= 0) return null;
  // Invert the legacy `houseFootprintSideLocalPointToWorld` math
  // for attachmentSide 'rear':
  //   form-local x ∈ [offsetXMm, offsetXMm + widthMm]
  //   form-local y ∈ [-(setbackMm + bandDepthMm), -setbackMm]
  // So:
  //   offsetXMm = xMin
  //   setbackMm = -yMax
  const offsetXMm = xMin;
  const setbackMm = -yMax;
  return {
    widthM: mmToMetreString(widthMm),
    bandDepthM: mmToMetreString(bandDepthMm),
    offsetXM: mmToMetreString(offsetXMm),
    setbackM: mmToMetreString(setbackMm),
  };
}

function mmToMetreString(mm: number): string {
  const stable = Number((mm / 1000).toFixed(6));
  return String(Object.is(stable, -0) ? 0 : stable);
}
