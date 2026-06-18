import { describe, expect, it } from 'vitest';
import type {
  AxisAlignedRectangle,
  HouseComposition,
  RectangleRoofIntent,
} from '@sp/geometry';
import { rebasePartitionIntoOwnFrame } from './houseFormCompositionDetach';
import type { HouseFormTransformModel } from './objectFirstWorkbenchModel';

function hippedIntent(): RectangleRoofIntent {
  return {
    form: 'hipped',
    pitchDeg: 25,
    ridgeAxis: 'x',
    startCap: 'hipped',
    endCap: 'hipped',
  };
}

function rect(input: {
  x: number;
  y: number;
  w: number;
  d: number;
}): AxisAlignedRectangle {
  return {
    kind: 'axisAlignedRectangle',
    originXMm: input.x,
    originYMm: input.y,
    widthMm: input.w,
    depthMm: input.d,
    roofIntent: hippedIntent(),
  };
}

const ZERO_TRANSFORM: HouseFormTransformModel = {
  offsetXM: 0,
  offsetYM: 0,
  rotationQuarterTurns: 0,
};

/**
 * For a primitive in a partition with given rebase result, compute
 * the world-space bounding box. Used to assert world position is
 * preserved across the rebase.
 */
function worldBoundsFromRebase(
  rebasedRectangle: AxisAlignedRectangle,
  rebasedTransform: HouseFormTransformModel,
): { xMin: number; xMax: number; yMin: number; yMax: number } {
  // Quarter-turn rotation of axis-aligned rectangle (still axis-
  // aligned). For rotation=0 (the only case the tests exercise),
  // world = form-local + offset.
  if (rebasedTransform.rotationQuarterTurns !== 0) {
    throw new Error('test helper only handles rotation=0');
  }
  const xMin = rebasedTransform.offsetXM * 1000 + rebasedRectangle.originXMm;
  const xMax = xMin + rebasedRectangle.widthMm;
  const yMin = rebasedTransform.offsetYM * 1000 + rebasedRectangle.originYMm;
  const yMax = yMin + rebasedRectangle.depthMm;
  return { xMin, xMax, yMin, yMax };
}

describe('rebasePartitionIntoOwnFrame (PR-WB-DETACH-NO-MOVE)', () => {
  describe('single-primitive partition', () => {
    it('rebases a partition whose primitive is already at the legacy origin (no-op)', () => {
      // Primitive A at form-local (0, -4000) to (6000, 0) — the
      // legacy origin frame. Rebase should be a no-op.
      const partition: HouseComposition = {
        primitives: [rect({ x: 0, y: -4000, w: 6000, d: 4000 })],
        joins: [],
      };
      const result = rebasePartitionIntoOwnFrame({
        partition,
        parentTransform: ZERO_TRANSFORM,
      });
      expect(result).not.toBeNull();
      const rebased = result!.composition.primitives[0]!;
      if (rebased.kind !== 'axisAlignedRectangle') throw new Error('expected rect');
      expect(rebased.originXMm).toBe(0);
      expect(rebased.originYMm).toBe(-4000);
      expect(rebased.widthMm).toBe(6000);
      expect(rebased.depthMm).toBe(4000);
      expect(result!.transformOverride.offsetXM).toBe(0);
      expect(result!.transformOverride.offsetYM).toBe(0);
      expect(result!.footprintParamsPatch.widthM).toBe('6');
      expect(result!.footprintParamsPatch.bandDepthM).toBe('4');
    });

    it('rebases an east-shifted partition: world position preserved', () => {
      // Primitive B at form-local (6000, -4000) to (10000, 0).
      // After rebase: B at (0, -4000) to (4000, 0); transform shifts
      // by (+6, 0) so the new world position matches the parent's.
      const partition: HouseComposition = {
        primitives: [rect({ x: 6000, y: -4000, w: 4000, d: 4000 })],
        joins: [],
      };
      const parent: HouseFormTransformModel = {
        offsetXM: 5,
        offsetYM: 2,
        rotationQuarterTurns: 0,
      };
      const result = rebasePartitionIntoOwnFrame({
        partition,
        parentTransform: parent,
      });
      expect(result).not.toBeNull();
      const rebased = result!.composition.primitives[0]!;
      if (rebased.kind !== 'axisAlignedRectangle') throw new Error('expected rect');
      expect(rebased.originXMm).toBe(0);
      expect(rebased.originYMm).toBe(-4000);
      expect(rebased.widthMm).toBe(4000);
      expect(rebased.depthMm).toBe(4000);
      expect(result!.transformOverride.offsetXM).toBe(11); // 5 + 6
      expect(result!.transformOverride.offsetYM).toBe(2); // 2 + 0
      // World bounding box BEFORE: parent.offset + rect-as-was
      //   x ∈ [5000 + 6000, 5000 + 10000] = [11000, 15000]
      //   y ∈ [2000 - 4000, 2000 + 0]     = [-2000, 2000]
      // World bounding box AFTER (computed from rebase):
      const after = worldBoundsFromRebase(rebased, result!.transformOverride);
      expect(after.xMin).toBe(11000);
      expect(after.xMax).toBe(15000);
      expect(after.yMin).toBe(-2000);
      expect(after.yMax).toBe(2000);
    });

    it('rebases a south-shifted partition (the symptom from the user bug report)', () => {
      // Primitive at form-local (0, -8000) to (6000, -4000) — south
      // of the parent's anchor row. Rebase translates to legacy
      // origin AND adjusts transform Y by -4 metres.
      const partition: HouseComposition = {
        primitives: [rect({ x: 0, y: -8000, w: 6000, d: 4000 })],
        joins: [],
      };
      const result = rebasePartitionIntoOwnFrame({
        partition,
        parentTransform: ZERO_TRANSFORM,
      });
      expect(result).not.toBeNull();
      const rebased = result!.composition.primitives[0]!;
      if (rebased.kind !== 'axisAlignedRectangle') throw new Error('expected rect');
      // After rebase: originYMm = -4000 (legacy origin), transform
      // shifts by -4 metres so the world position matches.
      expect(rebased.originYMm).toBe(-4000);
      expect(result!.transformOverride.offsetYM).toBe(-4);
      // World position before: y ∈ [-8000, -4000].
      // After (computed): same.
      const after = worldBoundsFromRebase(rebased, result!.transformOverride);
      expect(after.yMin).toBe(-8000);
      expect(after.yMax).toBe(-4000);
    });
  });

  describe('multi-primitive partition (composite of composites)', () => {
    it('rebases a 2-primitive partition: bounding-box-aligned to legacy origin', () => {
      // Partition contains two primitives that share an east-west
      // seam: A at form-local (6000, -4000) 4x4 + B at (10000, -4000)
      // 2x4. Bounding box: (6000, -4000) to (12000, 0). After
      // rebase: A at (0, -4000) 4x4 + B at (4000, -4000) 2x4.
      const partition: HouseComposition = {
        primitives: [
          rect({ x: 6000, y: -4000, w: 4000, d: 4000 }),
          rect({ x: 10000, y: -4000, w: 2000, d: 4000 }),
        ],
        joins: [
          { fromPrimitiveIndex: 0, fromEdge: 'east', toPrimitiveIndex: 1, toEdge: 'west' },
        ],
      };
      const result = rebasePartitionIntoOwnFrame({
        partition,
        parentTransform: ZERO_TRANSFORM,
      });
      expect(result).not.toBeNull();
      const rectA = result!.composition.primitives[0]!;
      const rectB = result!.composition.primitives[1]!;
      if (rectA.kind !== 'axisAlignedRectangle' || rectB.kind !== 'axisAlignedRectangle') {
        throw new Error('expected rectangles');
      }
      expect(rectA.originXMm).toBe(0);
      expect(rectA.originYMm).toBe(-4000);
      expect(rectB.originXMm).toBe(4000);
      expect(rectB.originYMm).toBe(-4000);
      expect(result!.composition.joins).toHaveLength(1);
      expect(result!.transformOverride.offsetXM).toBe(6); // anchor shift
      expect(result!.footprintParamsPatch.widthM).toBe('6'); // bounding box width
      expect(result!.footprintParamsPatch.bandDepthM).toBe('4');
    });
  });

  describe('parent form rotation (quarter-turns)', () => {
    it('honours 90° CCW rotation when emitting the transform delta', () => {
      // Parent at (0, 0) rotated 90° CCW. Partition primitive at
      // parent-form-local (6000, -4000) 4x4. After 90° CCW rotation
      // the form-local +x axis points to world +y, and form-local
      // +y points to world -x. So the partition's anchor (6000, 0)
      // (the (xMin, yMax) corner) rotates to world (0, 6000). The
      // new transform must absorb this rotated anchor.
      const partition: HouseComposition = {
        primitives: [rect({ x: 6000, y: -4000, w: 4000, d: 4000 })],
        joins: [],
      };
      const parent: HouseFormTransformModel = {
        offsetXM: 0,
        offsetYM: 0,
        rotationQuarterTurns: 1,
      };
      const result = rebasePartitionIntoOwnFrame({
        partition,
        parentTransform: parent,
      });
      expect(result).not.toBeNull();
      // rotate(6000, 0, 90° CCW) = (0, 6000).
      expect(result!.transformOverride.offsetXM).toBe(0);
      expect(result!.transformOverride.offsetYM).toBe(6);
      expect(result!.transformOverride.rotationQuarterTurns).toBe(1);
    });
  });

  describe('error handling', () => {
    it('returns null for an empty partition', () => {
      const result = rebasePartitionIntoOwnFrame({
        partition: { primitives: [], joins: [] },
        parentTransform: ZERO_TRANSFORM,
      });
      expect(result).toBeNull();
    });

    it('returns null when a partition contains a non-rectangle primitive', () => {
      const result = rebasePartitionIntoOwnFrame({
        partition: {
          primitives: [{ kind: 'unknown', reserved: true }],
          joins: [],
        },
        parentTransform: ZERO_TRANSFORM,
      });
      expect(result).toBeNull();
    });
  });
});
