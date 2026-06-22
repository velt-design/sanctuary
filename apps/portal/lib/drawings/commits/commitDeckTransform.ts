import { buildSideLocalPolygonFromWorld } from '@sp/geometry';
import type { ObjectWorkbenchDeckPatch } from '@/lib/drawings/state/objectWorkbenchInspectorModel';

/**
 * Build the canonical "deck transform" atomic patch from a world-space
 * polygon. Used by both the move tool and the edge-drag tool: each gesture
 * computes a `worldPolygonMm` (move = current polygon + delta; edge-drag =
 * dragged-edge polygon) and hands it here; the helper bbox-encodes that
 * into the persisted shape.
 *
 * Why a shared helper: pre-extraction the migration logic was duplicated
 * across `DesignWorkbenchEstimateClient`'s deck-edge-drag handler and the
 * deck-move handler. The two paths drifted (move forgot the side-local
 * encoding; legacy decks shrank to a unit-frame box on first move). The
 * pattern is documented in `docs/maintainability-principles.md` -- "shared
 * logic for shared operations."
 *
 * The output is always `shape: 'custom'` + `outline` (side-local against a
 * standardized `attachmentSide: 'rear'` unit-frame) + `position`. Same
 * shape regardless of whether the deck was previously at a position or
 * not -- the geometry pipeline reads this consistently in both modes.
 *
 * COORD SYSTEMS — important: `worldPolygonMm` is in WORLD coords (post
 * `applyAssemblyPosition3D` transform). The persisted `deck.position` is
 * in HOUSE-LOCAL coords because the geometry decoder applies it BEFORE
 * the house transform: `decode(outline) + deck.position + house.position
 * = world`. The helper therefore subtracts `houseWorldPositionMm` from
 * the bbox.min to produce a house-local deck.position. Without this
 * subtraction every commit re-introduces an extra house.position offset
 * (the deck drifts toward house.position on each move/resize).
 */
type BuildDeckTransformPatchInput = {
  /** New world polygon in mm. Must have >= 3 points. */
  worldPolygonMm: ReadonlyArray<{ x: number; y: number }>;
  /**
   * Existing rotation as the persisted string (e.g. "0", "90"). When set,
   * preserved; when null/undefined/non-numeric, defaults to 0.
   */
  currentRotationDeg?: string | null;
  /**
   * House's world-space position in mm. Subtracted from the bbox.min to
   * produce a house-local `deck.position`. Pass `null` (or omit) when the
   * house is at world origin (the legacy single-house default).
   */
  houseWorldPositionMm?: { x: number; y: number } | null;
};

export function buildDeckTransformPatch(
  input: BuildDeckTransformPatchInput,
): ObjectWorkbenchDeckPatch | null {
  if (input.worldPolygonMm.length < 3) return null;
  let minX = Infinity;
  let minY = Infinity;
  for (const point of input.worldPolygonMm) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  // World bbox.min, then converted to house-local for the persisted
  // `deck.position`. Subtracting `houseWorldPositionMm` is the fix for
  // the "deck drifts toward house position on each move" bug -- without
  // this, deck.position is treated as world coords on write but as
  // house-local coords on the next decode, so house.position gets added
  // an extra time per commit.
  const worldBboxMinX = minX;
  const worldBboxMinY = minY;
  const houseX = input.houseWorldPositionMm?.x ?? 0;
  const houseY = input.houseWorldPositionMm?.y ?? 0;
  const positionXMm = worldBboxMinX - houseX;
  const positionYMm = worldBboxMinY - houseY;
  // Encode the polygon relative to the world bbox.min (so unit-frame
  // decode + position + house.position == worldPolygonMm). The geometry
  // pipeline standardizes on `attachmentSide: 'rear'` + 1m × 1m unit
  // frame for any deck that has a `position` set; we match that here so
  // move and edge-drag commits produce equivalent persisted shapes.
  const localWorldPolygon = input.worldPolygonMm.map((p) => ({
    x: p.x - worldBboxMinX,
    y: p.y - worldBboxMinY,
  }));
  const sideLocalPoints = buildSideLocalPolygonFromWorld({
    worldPolygonMm: localWorldPolygon,
    pergolaWidthMm: 1000,
    pergolaDepthMm: 1000,
    attachmentSide: 'rear',
    params: null,
  });
  const rotationDeg = (() => {
    const parsed = Number(input.currentRotationDeg ?? '0');
    return Number.isFinite(parsed) ? parsed : 0;
  })();
  return {
    shape: 'custom',
    outline: sideLocalPoints.map((p) => ({
      alongM: p.alongM.toString(),
      depthM: p.depthM.toString(),
    })),
    position: {
      originXMm: positionXMm.toString(),
      originYMm: positionYMm.toString(),
      rotationDeg: rotationDeg.toString(),
    },
  };
}
