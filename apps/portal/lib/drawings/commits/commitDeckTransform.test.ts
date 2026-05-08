import { describe, expect, it } from 'vitest';
import { buildDeckTransformPatch } from './commitDeckTransform';

describe('buildDeckTransformPatch', () => {
  // The helper is the shared core used by both deck edge-drag and deck
  // move. Test the boundary contract: world polygon in -> atomic patch out
  // (`shape: 'custom'` + side-local outline + position). The geometry
  // pipeline reads this patch and decodes the outline against a unit
  // (1m x 1m) frame standardised on `attachmentSide: 'rear'`, applying
  // `position` post-decode. Round-tripping `position + outline`-via-
  // unit-frame must equal the input polygon.

  it('returns null when the polygon has fewer than 3 points', () => {
    expect(
      buildDeckTransformPatch({ worldPolygonMm: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }),
    ).toBeNull();
  });

  it('returns null on an empty polygon', () => {
    expect(buildDeckTransformPatch({ worldPolygonMm: [] })).toBeNull();
  });

  it('writes shape=custom and position derived from polygon bbox.min', () => {
    const patch = buildDeckTransformPatch({
      worldPolygonMm: [
        { x: 1500, y: 2000 },
        { x: 4500, y: 2000 },
        { x: 4500, y: 3500 },
        { x: 1500, y: 3500 },
      ],
    });
    expect(patch).not.toBeNull();
    expect(patch!.shape).toBe('custom');
    expect(patch!.position).toEqual({
      originXMm: '1500',
      originYMm: '2000',
      rotationDeg: '0',
    });
  });

  it('preserves the existing rotation when currentRotationDeg is set', () => {
    const patch = buildDeckTransformPatch({
      worldPolygonMm: [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 1000, y: 1000 },
        { x: 0, y: 1000 },
      ],
      currentRotationDeg: '45',
    });
    expect(patch!.position?.rotationDeg).toBe('45');
  });

  it('falls back to rotationDeg=0 when currentRotationDeg is null/undefined/non-numeric', () => {
    const variants = [null, undefined, ''];
    for (const variant of variants) {
      const patch = buildDeckTransformPatch({
        worldPolygonMm: [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
          { x: 1000, y: 1000 },
        ],
        currentRotationDeg: variant,
      });
      expect(patch!.position?.rotationDeg).toBe('0');
    }
  });

  it('encodes a rectangle so that bbox.min == position and outline coords are relative', () => {
    // For a 3000×1500 rectangle starting at world (1500, 2000), the encoded
    // outline points are pre-translated to be relative to position. The
    // standardized 'rear' frame + 1m unit decode means the outline values
    // are in meters offset from position. We don't depend on the exact
    // outline numbers (they're owned by `buildSideLocalPolygonFromWorld`),
    // just that the position absorbs the bbox offset and the outline has
    // 4 points.
    const patch = buildDeckTransformPatch({
      worldPolygonMm: [
        { x: 1500, y: 2000 },
        { x: 4500, y: 2000 },
        { x: 4500, y: 3500 },
        { x: 1500, y: 3500 },
      ],
    });
    expect(patch!.position).toEqual({
      originXMm: '1500',
      originYMm: '2000',
      rotationDeg: '0',
    });
    expect(patch!.outline).toHaveLength(4);
  });

  it('handles a translated polygon identically to the same shape at origin (translation invariance)', () => {
    // Translation invariance: shifting the world polygon by (dx, dy) shifts
    // the position by (dx, dy) but leaves the outline unchanged. This is
    // the property that makes the helper safe to call from both move (which
    // applies a delta) and edge-drag (which builds a fresh polygon) -- the
    // outline encoding doesn't depend on the polygon's world location.
    const baseAtOrigin = buildDeckTransformPatch({
      worldPolygonMm: [
        { x: 0, y: 0 },
        { x: 3000, y: 0 },
        { x: 3000, y: 1500 },
        { x: 0, y: 1500 },
      ],
    });
    const translated = buildDeckTransformPatch({
      worldPolygonMm: [
        { x: 1500, y: 2000 },
        { x: 4500, y: 2000 },
        { x: 4500, y: 3500 },
        { x: 1500, y: 3500 },
      ],
    });
    expect(baseAtOrigin!.outline).toEqual(translated!.outline);
    expect(baseAtOrigin!.position?.originXMm).toBe('0');
    expect(translated!.position?.originXMm).toBe('1500');
  });

  it('subtracts houseWorldPositionMm from position so deck.position is house-local (no double-translate on re-solve)', () => {
    // The "deck drifts toward house position on each move" bug. The
    // geometry decoder applies `deck.position + house.position = world`,
    // so deck.position must be in HOUSE-LOCAL coords. World bbox.min
    // (e.g. (5000, 4800)) minus house position (e.g. (1000, 500)) =
    // house-local position (4000, 4300). Without this subtraction,
    // every commit re-introduces an extra `house.position` offset and
    // the deck drifts away.
    const patch = buildDeckTransformPatch({
      worldPolygonMm: [
        { x: 5000, y: 4800 },
        { x: 8000, y: 4800 },
        { x: 8000, y: 6300 },
        { x: 5000, y: 6300 },
      ],
      houseWorldPositionMm: { x: 1000, y: 500 },
    });
    expect(patch!.position).toEqual({
      originXMm: '4000',
      originYMm: '4300',
      rotationDeg: '0',
    });
  });

  it('treats houseWorldPositionMm=null as the legacy world-origin house (no offset)', () => {
    const patch = buildDeckTransformPatch({
      worldPolygonMm: [
        { x: 1500, y: 2000 },
        { x: 4500, y: 2000 },
        { x: 4500, y: 3500 },
        { x: 1500, y: 3500 },
      ],
      houseWorldPositionMm: null,
    });
    expect(patch!.position).toEqual({
      originXMm: '1500',
      originYMm: '2000',
      rotationDeg: '0',
    });
  });
});
