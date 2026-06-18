import {
  detectSharedSeamBetweenForms,
  findCompositionJoinSeamMidpoint,
  isAxisAlignedRectangle,
  type AxisAlignedRectangle,
  type HouseComposition,
  type Point2,
} from '@sp/geometry';

/**
 * PR-COMP-PHASE4b.3 (2026-06-18): pure helper that takes the
 * project's house forms (with composition + world transforms) and
 * returns the seam-icon targets PlanSeamIconLayer renders.
 *
 * Two kinds of icon:
 *   - 'detach' — one per internal join of a composite form. Click
 *     dispatches detachHouseFormAtSeam({ houseFormId, joinIndex }).
 *   - 'join' — one per pair of separate forms whose edges align
 *     within snap tolerance. Click dispatches
 *     joinHouseForms({ formAId, formBId }).
 *
 * Icons are positioned in world-space mm (the layer translates to
 * SVG via PlanCoordinateAdapter).
 *
 * Form rotation: v1 axis-aligned-rectangle primitives don't
 * support rotation. Pairs of forms with differing rotations are
 * skipped (no Join icon); composites are rendered at any rotation
 * because the join geometry is form-local (Detach icons work
 * regardless). This mirrors the rotation gate in joinTwoHouseForms.
 */

export type PlanSeamIconForm = {
  id: string;
  worldOffsetXMm: number;
  worldOffsetYMm: number;
  rotationQuarterTurns: number;
  composition: HouseComposition;
};

export type PlanSeamIconTarget =
  | {
      kind: 'detach';
      key: string;
      worldXMm: number;
      worldYMm: number;
      houseFormId: string;
      joinIndex: number;
    }
  | {
      kind: 'join';
      key: string;
      worldXMm: number;
      worldYMm: number;
      formAId: string;
      formBId: string;
    };

export function buildSeamIconTargets(input: {
  forms: ReadonlyArray<PlanSeamIconForm>;
}): PlanSeamIconTarget[] {
  const targets: PlanSeamIconTarget[] = [];

  // Detach icons: one per internal join of every composite (>1
  // primitive AND >=1 join). For form-local seam midpoints,
  // translate by the form's world offset to land in world space.
  for (const form of input.forms) {
    if (form.composition.primitives.length <= 1) continue;
    for (let joinIndex = 0; joinIndex < form.composition.joins.length; joinIndex += 1) {
      const localMidpoint = findCompositionJoinSeamMidpoint(form.composition, joinIndex);
      if (!localMidpoint) continue;
      const worldPoint = applyRotationAndOffset(
        localMidpoint,
        form.rotationQuarterTurns,
        form.worldOffsetXMm,
        form.worldOffsetYMm,
      );
      targets.push({
        kind: 'detach',
        key: `detach:${form.id}:${joinIndex}`,
        worldXMm: worldPoint.x,
        worldYMm: worldPoint.y,
        houseFormId: form.id,
        joinIndex,
      });
    }
  }

  // Join icons: every ordered pair (A, B) where A.id < B.id (so
  // each pair is checked once) AND both forms have the same
  // rotation. detectSharedSeamBetweenForms returns null when no
  // edges align within tolerance, so we get one icon per genuine
  // edge-adjacent pair. v1 caps at one seam per pair (the geometry
  // primitive returns the first match).
  for (let i = 0; i < input.forms.length; i += 1) {
    const formA = input.forms[i]!;
    for (let j = i + 1; j < input.forms.length; j += 1) {
      const formB = input.forms[j]!;
      if (formA.rotationQuarterTurns !== formB.rotationQuarterTurns) continue;
      const rectanglesA = extractRectangles(formA.composition);
      const rectanglesB = extractRectangles(formB.composition);
      if (rectanglesA.length === 0 || rectanglesB.length === 0) continue;
      const seam = detectSharedSeamBetweenForms({
        formARectangles: rectanglesA,
        formAWorldOffsetXMm: formA.worldOffsetXMm,
        formAWorldOffsetYMm: formA.worldOffsetYMm,
        formBRectangles: rectanglesB,
        formBWorldOffsetXMm: formB.worldOffsetXMm,
        formBWorldOffsetYMm: formB.worldOffsetYMm,
      });
      if (!seam) continue;
      targets.push({
        kind: 'join',
        key: `join:${formA.id}:${formB.id}`,
        worldXMm: seam.midpointWorldMm.x,
        worldYMm: seam.midpointWorldMm.y,
        formAId: formA.id,
        formBId: formB.id,
      });
    }
  }

  return targets;
}

function extractRectangles(composition: HouseComposition): AxisAlignedRectangle[] {
  const out: AxisAlignedRectangle[] = [];
  for (const primitive of composition.primitives) {
    if (isAxisAlignedRectangle(primitive)) out.push(primitive);
  }
  return out;
}

/**
 * For rotation: the form-local point is rotated by N quarter-
 * turns around the form's origin (0, 0 in form-local frame), then
 * translated by the form's world offset. Quarter-turn rotations
 * preserve axis-aligned geometry, which is why the composition
 * model can stay rotation-free at the primitive level but the
 * workbench can place rotated composites in the world.
 */
function applyRotationAndOffset(
  localPoint: Point2,
  rotationQuarterTurns: number,
  worldOffsetXMm: number,
  worldOffsetYMm: number,
): Point2 {
  const turns = ((rotationQuarterTurns % 4) + 4) % 4;
  let rotated: Point2 = localPoint;
  switch (turns) {
    case 1:
      // 90° CCW: (x, y) → (-y, x)
      rotated = { x: -localPoint.y, y: localPoint.x };
      break;
    case 2:
      // 180°: (x, y) → (-x, -y)
      rotated = { x: -localPoint.x, y: -localPoint.y };
      break;
    case 3:
      // 270° CCW (= 90° CW): (x, y) → (y, -x)
      rotated = { x: localPoint.y, y: -localPoint.x };
      break;
    case 0:
    default:
      rotated = localPoint;
      break;
  }
  return {
    x: rotated.x + worldOffsetXMm,
    y: rotated.y + worldOffsetYMm,
  };
}
