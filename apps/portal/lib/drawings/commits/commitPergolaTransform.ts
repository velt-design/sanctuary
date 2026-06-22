import type { Point2 } from '@sp/geometry';
import type { ObjectFirstPergolaPosition } from '@/lib/drawings/state/objectFirstWorkbenchModel';

/**
 * Build the canonical "pergola translate" position from the current
 * persisted position plus a world-space delta. Used by the move tool
 * (and, when it lands, by any other gesture that translates a pergola
 * such as keyboard nudge).
 *
 * Why a shared helper: the move handler used to read `pergola.position`,
 * add `delta`, and inline the rotation-preservation + finite-number
 * fallback. That logic is small but error-prone (a missing
 * `Number.isFinite` check is how negative-zero and NaN sneak in) and a
 * second caller (rotate, keyboard nudge) would duplicate it. See
 * `docs/maintainability-principles.md` -- "shared logic for shared
 * operations": extract once, both callers go through the same boundary.
 *
 * Pergolas don't need the house-position subtraction that decks do --
 * pergola.position is already stored in WORLD coords and applied by
 * `applyAssemblyPosition3D` directly (no per-pergola decoder layered
 * over a unit frame). Pergolas live outside the house model, so the
 * deck-style double-translate bug doesn't apply.
 */
type BuildPergolaTransformPositionInput = {
  /** Existing pergola.position (mm strings + rotation deg string), or null. */
  currentPosition: ObjectFirstPergolaPosition | null | undefined;
  /** Translation delta in WORLD mm. */
  deltaMm: Point2;
};

type PergolaTransformPosition = {
  originXMm: number;
  originYMm: number;
  rotationDeg: number;
};

export function buildPergolaTransformPosition(
  input: BuildPergolaTransformPositionInput,
): PergolaTransformPosition {
  const currentX = Number(input.currentPosition?.originXMm ?? '0');
  const currentY = Number(input.currentPosition?.originYMm ?? '0');
  const currentRotation = Number(input.currentPosition?.rotationDeg ?? '0');
  return {
    originXMm: (Number.isFinite(currentX) ? currentX : 0) + input.deltaMm.x,
    originYMm: (Number.isFinite(currentY) ? currentY : 0) + input.deltaMm.y,
    rotationDeg: Number.isFinite(currentRotation) ? currentRotation : 0,
  };
}
