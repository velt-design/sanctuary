import {
  isAxisAlignedRectangle,
  type AxisAlignedRectangle,
  type HouseComposition,
} from '@sp/geometry';
import type { HouseFormTransformModel } from './objectFirstWorkbenchModel';

/**
 * PR-WB-DETACH-NO-MOVE (2026-06-19): rebase a Detach partition into
 * its own form-local frame so the new house form created from this
 * partition renders at the same world position the rectangles
 * occupied inside the parent composite. Without this step, the new
 * form inherits the parent's transform AND footprint params, so its
 * legacy walls render at the parent's form-local origin (overlapping
 * the parent form visually).
 *
 * Mechanics:
 *   1. Compute the partition's bounding box in parent-form-local
 *      coordinates: (xMin, yMin) -> (xMax, yMax).
 *   2. Shift every primitive's origin so the bounding box's SW
 *      corner sits at form-local (0, -totalDepth) — matches the
 *      legacy preset frame for `attachmentSide: 'rear'`.
 *   3. Emit a transform delta that places the new form's local
 *      origin where the parent form's local origin used to be PLUS
 *      the partition's anchor — so the partition's primitives end
 *      up at the same world positions after the rebase. The delta
 *      is expressed in WORLD coordinates and accounts for the
 *      parent form's rotation (quarter-turns only — composites only
 *      ever form between forms with matching rotation, per the v1
 *      Join action's rotation gate).
 *   4. Emit a footprint params patch so the legacy wall builder
 *      on the new form constructs a rectangle that matches the
 *      partition's bounding box. The legacy walls then align with
 *      the composition-driven roof (Phase 3.2 swap).
 *
 * Returns null if the partition is empty or contains non-rectangle
 * primitives (v1 limit — shouldn't happen because the partition
 * came from `detachHouseFormAtSeam` operating on a structurally
 * valid composition, but this function is defensive).
 */
export type RebasedPartitionResult = {
  composition: HouseComposition;
  transformOverride: HouseFormTransformModel;
  /** widthM / bandDepthM as metre-formatted strings (matches the workbench string-vocabulary). */
  footprintParamsPatch: {
    widthM: string;
    bandDepthM: string;
    offsetXM: string;
    setbackM: string;
  };
};

export function rebasePartitionIntoOwnFrame(input: {
  partition: HouseComposition;
  parentTransform: HouseFormTransformModel;
}): RebasedPartitionResult | null {
  const { partition, parentTransform } = input;
  if (partition.primitives.length === 0) return null;
  const rectangles: AxisAlignedRectangle[] = [];
  for (const primitive of partition.primitives) {
    if (!isAxisAlignedRectangle(primitive)) return null;
    rectangles.push(primitive);
  }

  // Partition bounding box in parent-form-local mm.
  let xMin = rectangles[0]!.originXMm;
  let xMax = rectangles[0]!.originXMm + rectangles[0]!.widthMm;
  let yMin = rectangles[0]!.originYMm;
  let yMax = rectangles[0]!.originYMm + rectangles[0]!.depthMm;
  for (const rect of rectangles) {
    xMin = Math.min(xMin, rect.originXMm);
    xMax = Math.max(xMax, rect.originXMm + rect.widthMm);
    yMin = Math.min(yMin, rect.originYMm);
    yMax = Math.max(yMax, rect.originYMm + rect.depthMm);
  }
  const totalWidthMm = xMax - xMin;
  const totalDepthMm = yMax - yMin;

  // Shifts to bring the bounding box SW corner to form-local
  // (0, -totalDepthMm) — the legacy preset frame for rear
  // attachment. New rectangle's origin should be xMin -> 0 and
  // yMax -> 0 (so yMin = -totalDepth).
  const shiftXmm = xMin;
  const shiftYmm = yMax;
  const rebasedPrimitives: AxisAlignedRectangle[] = rectangles.map((rect) => ({
    kind: 'axisAlignedRectangle',
    originXMm: rect.originXMm - shiftXmm,
    originYMm: rect.originYMm - shiftYmm,
    widthMm: rect.widthMm,
    depthMm: rect.depthMm,
    roofIntent: rect.roofIntent,
  }));

  // Compute the world-space translation the new form's transform
  // needs to absorb. In parent-form-local, the partition's anchor
  // is (shiftXmm, shiftYmm). The parent form's rotation applies to
  // form-local axes before the world translation, so:
  //   parent origin + rotate(shiftXmm, shiftYmm, parent rotation)
  // is where the new form's origin needs to sit so that its
  // rebased (0, 0) corresponds to the parent's (shiftXmm, shiftYmm).
  const rotated = rotateQuarterTurns(
    { x: shiftXmm, y: shiftYmm },
    parentTransform.rotationQuarterTurns,
  );
  const newOffsetXM = parentTransform.offsetXM + rotated.x / 1000;
  const newOffsetYM = parentTransform.offsetYM + rotated.y / 1000;

  return {
    composition: { primitives: rebasedPrimitives, joins: partition.joins },
    transformOverride: {
      offsetXM: newOffsetXM,
      offsetYM: newOffsetYM,
      rotationQuarterTurns: parentTransform.rotationQuarterTurns,
    },
    footprintParamsPatch: {
      widthM: mmToMetreString(totalWidthMm),
      bandDepthM: mmToMetreString(totalDepthMm),
      offsetXM: '0',
      setbackM: '0',
    },
  };
}

function rotateQuarterTurns(
  point: { x: number; y: number },
  turns: number,
): { x: number; y: number } {
  const normalized = ((turns % 4) + 4) % 4;
  switch (normalized) {
    case 1:
      return { x: -point.y, y: point.x };
    case 2:
      return { x: -point.x, y: -point.y };
    case 3:
      return { x: point.y, y: -point.x };
    case 0:
    default:
      return point;
  }
}

function mmToMetreString(mm: number): string {
  const stable = Number((mm / 1000).toFixed(6));
  return String(Object.is(stable, -0) ? 0 : stable);
}
