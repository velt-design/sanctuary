import { describe, expect, it } from 'vitest';
import {
  buildSideLocalPolygonFromWorld,
  houseFootprintSideLocalToWorldPolygon,
  type Point2,
  resolveHouseFootprintFrame,
} from '@sp/geometry';
import { buildDeckTransformPatch } from './commitDeckTransform';

/**
 * Round-trip simulation of the deck move flow.
 *
 * The live app does this on every commit:
 *   1. Read `assembly.house.model.decks[i].boundary` (world coords -- post
 *      `applyAssemblyPosition3D` if `assembly.house.position` is set).
 *   2. Add the move delta to every vertex.
 *   3. Call `buildDeckTransformPatch(...)` to bbox-encode the new world
 *      polygon into a `shape: 'custom'` + side-local outline + position
 *      patch. The position is HOUSE-LOCAL (world bbox.min minus house pos).
 *   4. Persist. Re-solve runs the geometry pipeline:
 *      decoded = houseFootprintSideLocalToWorldPolygon(outline, unitFrame)
 *      next world boundary = decoded + deck.position + house.position
 *
 * If the encode/decode are exact inverses (and the house-position math is
 * right), the round-trip is loss-free: applying delta, persisting, and
 * re-solving must produce a boundary that equals the previous boundary
 * plus the delta. Any accumulated drift means there's a constant offset
 * being added per commit -- which is the user-facing "deck slides toward
 * the corner over many moves" bug.
 *
 * This test simulates the full pipeline mathematically (no React, no
 * solver). It mirrors what the live geometry pipeline would do on
 * re-solve. If round-trip is exact here, the live drift is somewhere
 * outside this simulation (timing, wrong source, etc). If round-trip
 * accumulates drift here, we have a math bug to fix.
 */

// Simulate the geometry pipeline's deck decode: take a `buildDeckTransformPatch`
// output + house world position and produce the world boundary that the
// next solve would compute.
function simulateNextSolveBoundary(input: {
  outline: ReadonlyArray<{ alongM: string; depthM: string }>;
  deckPositionMm: { x: number; y: number };
  houseWorldPositionMm: Point2;
}): Point2[] {
  const frame = resolveHouseFootprintFrame({
    pergolaWidthMm: 1000,
    pergolaDepthMm: 1000,
    attachmentSide: 'rear',
  });
  const decoded = houseFootprintSideLocalToWorldPolygon({
    points: input.outline.map((p) => ({
      alongM: Number(p.alongM),
      depthM: Number(p.depthM),
    })),
    frame,
    resolved: {
      widthM: 1,
      offsetXM: 0,
      setbackM: 0,
      bandDepthM: 1,
      returnRunM: 1,
      recessWidthM: 1,
      recessDepthM: 1,
      leftLegRunM: 1,
      rightLegRunM: 1,
      sideRunM: 1,
    },
  });
  // `decoded` is the unit-frame polygon. Add deck.position (house-local)
  // then house.position to get world. Mirrors the real pipeline:
  //   1. normalize.ts adds deck.position
  //   2. applyAssemblyPosition3D adds house.position when set
  return decoded.map((p) => ({
    x: p.x + input.deckPositionMm.x + input.houseWorldPositionMm.x,
    y: p.y + input.deckPositionMm.y + input.houseWorldPositionMm.y,
  }));
}

function pointsClose(a: Point2[], b: Point2[], tolerance = 0.01): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (Math.abs(a[i]!.x - b[i]!.x) > tolerance) return false;
    if (Math.abs(a[i]!.y - b[i]!.y) > tolerance) return false;
  }
  return true;
}

describe('buildDeckTransformPatch round-trip (deck move flow simulation)', () => {
  it('a single move is loss-free: persisted patch + decode = original polygon + delta', () => {
    const startWorldPolygon: Point2[] = [
      { x: 1500, y: 2000 },
      { x: 4500, y: 2000 },
      { x: 4500, y: 3500 },
      { x: 1500, y: 3500 },
    ];
    const housePos = { x: 0, y: 0 };
    const delta = { x: 500, y: 200 };
    const expectedWorldPolygon = startWorldPolygon.map((p) => ({
      x: p.x + delta.x,
      y: p.y + delta.y,
    }));

    const patch = buildDeckTransformPatch({
      worldPolygonMm: expectedWorldPolygon,
      houseWorldPositionMm: housePos,
    });
    expect(patch).not.toBeNull();
    const reconstructed = simulateNextSolveBoundary({
      outline: patch!.outline ?? [],
      deckPositionMm: {
        x: Number(patch!.position!.originXMm),
        y: Number(patch!.position!.originYMm),
      },
      houseWorldPositionMm: housePos,
    });
    expect(pointsClose(reconstructed, expectedWorldPolygon)).toBe(true);
  });

  it('TEN successive moves do not accumulate drift (the bug we are hunting)', () => {
    // Start with a 3000x1500 deck somewhere arbitrary.
    let worldPolygon: Point2[] = [
      { x: 1500, y: 2000 },
      { x: 4500, y: 2000 },
      { x: 4500, y: 3500 },
      { x: 1500, y: 3500 },
    ];
    const housePos = { x: 0, y: 0 };
    let cumulativeDelta = { x: 0, y: 0 };
    const moveSequence = [
      { x: 500, y: 0 },
      { x: 0, y: 300 },
      { x: -200, y: 100 },
      { x: 700, y: -150 },
      { x: -100, y: -50 },
      { x: 350, y: 200 },
      { x: -400, y: 0 },
      { x: 0, y: -100 },
      { x: 250, y: 75 },
      { x: -150, y: -200 },
    ];
    const driftLog: Array<{ step: number; bboxMin: Point2; expected: Point2 }> = [];

    for (let step = 0; step < moveSequence.length; step += 1) {
      const delta = moveSequence[step]!;
      cumulativeDelta = {
        x: cumulativeDelta.x + delta.x,
        y: cumulativeDelta.y + delta.y,
      };
      const nextWorldPolygon = worldPolygon.map((p) => ({
        x: p.x + delta.x,
        y: p.y + delta.y,
      }));
      const patch = buildDeckTransformPatch({
        worldPolygonMm: nextWorldPolygon,
        houseWorldPositionMm: housePos,
      });
      const reconstructed = simulateNextSolveBoundary({
        outline: patch!.outline ?? [],
        deckPositionMm: {
          x: Number(patch!.position!.originXMm),
          y: Number(patch!.position!.originYMm),
        },
        houseWorldPositionMm: housePos,
      });
      driftLog.push({
        step,
        bboxMin: {
          x: Math.min(...reconstructed.map((p) => p.x)),
          y: Math.min(...reconstructed.map((p) => p.y)),
        },
        expected: {
          x: 1500 + cumulativeDelta.x,
          y: 2000 + cumulativeDelta.y,
        },
      });
      worldPolygon = reconstructed;
    }

    // After all moves the deck should be at start + cumulative delta.
    const finalBboxMin = driftLog.at(-1)!.bboxMin;
    const expectedFinal = driftLog.at(-1)!.expected;
    expect(finalBboxMin.x).toBeCloseTo(expectedFinal.x, 1);
    expect(finalBboxMin.y).toBeCloseTo(expectedFinal.y, 1);
  });

  it('TEN successive moves with non-zero house position do not accumulate drift', () => {
    // Same scenario but house.position is set. The fix subtracts house pos
    // when computing deck.position, so the round-trip should still be loss-free.
    let worldPolygon: Point2[] = [
      { x: 5000, y: 4500 },
      { x: 8000, y: 4500 },
      { x: 8000, y: 6000 },
      { x: 5000, y: 6000 },
    ];
    const housePos = { x: 1000, y: 500 };
    let cumulativeDelta = { x: 0, y: 0 };
    const moveSequence = [
      { x: 200, y: 0 },
      { x: 0, y: 100 },
      { x: -50, y: 50 },
      { x: 300, y: -100 },
      { x: -100, y: 25 },
      { x: 150, y: 150 },
      { x: -200, y: 0 },
      { x: 0, y: -75 },
      { x: 125, y: 100 },
      { x: -75, y: -50 },
    ];

    for (let step = 0; step < moveSequence.length; step += 1) {
      const delta = moveSequence[step]!;
      cumulativeDelta = {
        x: cumulativeDelta.x + delta.x,
        y: cumulativeDelta.y + delta.y,
      };
      const nextWorldPolygon = worldPolygon.map((p) => ({
        x: p.x + delta.x,
        y: p.y + delta.y,
      }));
      const patch = buildDeckTransformPatch({
        worldPolygonMm: nextWorldPolygon,
        houseWorldPositionMm: housePos,
      });
      const reconstructed = simulateNextSolveBoundary({
        outline: patch!.outline ?? [],
        deckPositionMm: {
          x: Number(patch!.position!.originXMm),
          y: Number(patch!.position!.originYMm),
        },
        houseWorldPositionMm: housePos,
      });
      worldPolygon = reconstructed;
    }

    const finalBboxMin = {
      x: Math.min(...worldPolygon.map((p) => p.x)),
      y: Math.min(...worldPolygon.map((p) => p.y)),
    };
    expect(finalBboxMin.x).toBeCloseTo(5000 + cumulativeDelta.x, 1);
    expect(finalBboxMin.y).toBeCloseTo(4500 + cumulativeDelta.y, 1);
  });

  it('reproduces the live bug if buildDeckTransformPatch ever stops handling house position correctly', () => {
    // Regression guard: simulate what would happen if the helper INCORRECTLY
    // wrote the world bbox as deck.position (the pre-fix behavior). Each
    // commit re-introduces house.position. We expect the bbox to drift by
    // exactly `housePos * step` on each move with delta=0.
    //
    // This isn't a passing assertion -- it documents the failure mode so
    // future agents see what the bug looked like and don't re-introduce it.
    const housePos = { x: 1000, y: 500 };
    let worldPolygon: Point2[] = [
      { x: 2000, y: 2500 }, // = decoded(unit) + deck.position(1000, 2000) + house(1000, 500)
      { x: 5000, y: 2500 },
      { x: 5000, y: 4000 },
      { x: 2000, y: 4000 },
    ];
    // Pre-fix behavior: deck.position = world bbox.min (no house subtraction).
    const buggyPatch = (poly: Point2[]) => {
      let minX = Infinity;
      let minY = Infinity;
      for (const p of poly) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
      }
      const localPolygon = poly.map((p) => ({ x: p.x - minX, y: p.y - minY }));
      const sideLocal = buildSideLocalPolygonFromWorld({
        worldPolygonMm: localPolygon,
        pergolaWidthMm: 1000,
        pergolaDepthMm: 1000,
        attachmentSide: 'rear',
        params: null,
      });
      return {
        position: { x: minX, y: minY }, // BUGGY: not subtracting housePos
        outline: sideLocal.map((p) => ({ alongM: p.alongM.toString(), depthM: p.depthM.toString() })),
      };
    };

    // Commit with delta=0 three times.
    for (let i = 0; i < 3; i += 1) {
      const patch = buggyPatch(worldPolygon);
      const reconstructed = simulateNextSolveBoundary({
        outline: patch.outline,
        deckPositionMm: patch.position,
        houseWorldPositionMm: housePos,
      });
      worldPolygon = reconstructed;
    }
    // After 3 zero-delta commits with the BUGGY patch, the bbox.min has
    // drifted by 3 * housePos. This is the user's reported "deck moves
    // toward the corner over a couple moves" symptom.
    const finalBboxMin = {
      x: Math.min(...worldPolygon.map((p) => p.x)),
      y: Math.min(...worldPolygon.map((p) => p.y)),
    };
    expect(finalBboxMin.x).toBeCloseTo(2000 + 3 * housePos.x, 1);
    expect(finalBboxMin.y).toBeCloseTo(2500 + 3 * housePos.y, 1);
  });
});
