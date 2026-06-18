import { describe, expect, it } from 'vitest';
import type {
  AxisAlignedRectangle,
  HouseComposition,
  RectangleRoofIntent,
} from '@sp/geometry';
import {
  buildSeamIconTargets,
  type PlanSeamIconForm,
} from './seamIconTargets';

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

function singleRectForm(input: {
  id: string;
  worldX: number;
  worldY: number;
  w: number;
  d: number;
  rotation?: number;
}): PlanSeamIconForm {
  return {
    id: input.id,
    worldOffsetXMm: input.worldX,
    worldOffsetYMm: input.worldY,
    rotationQuarterTurns: input.rotation ?? 0,
    composition: {
      primitives: [rect({ x: 0, y: 0, w: input.w, d: input.d })],
      joins: [],
    },
  };
}

describe('buildSeamIconTargets (PR-COMP-PHASE4b.3)', () => {
  describe('detach icons', () => {
    it('emits one detach icon per internal join of a composite', () => {
      const composite: HouseComposition = {
        primitives: [
          rect({ x: 0, y: 0, w: 4000, d: 4000 }),
          rect({ x: 4000, y: 0, w: 4000, d: 4000 }),
          rect({ x: 8000, y: 0, w: 4000, d: 4000 }),
        ],
        joins: [
          { fromPrimitiveIndex: 0, fromEdge: 'east', toPrimitiveIndex: 1, toEdge: 'west' },
          { fromPrimitiveIndex: 1, fromEdge: 'east', toPrimitiveIndex: 2, toEdge: 'west' },
        ],
      };
      const targets = buildSeamIconTargets({
        forms: [
          {
            id: 'house-1',
            worldOffsetXMm: 0,
            worldOffsetYMm: 0,
            rotationQuarterTurns: 0,
            composition: composite,
          },
        ],
      });
      const detaches = targets.filter((t) => t.kind === 'detach');
      expect(detaches).toHaveLength(2);
      expect(detaches.map((t) => t.kind === 'detach' ? t.joinIndex : -1)).toEqual([0, 1]);
    });

    it('positions a detach icon at the world-space midpoint of the seam', () => {
      // Composite at world (5000, 2000): primitive 0 at form-local
      // (0, 0) 4x4; primitive 1 at form-local (4000, 0) 4x4. Seam
      // along x=4000, y in [0, 4000], form-local midpoint (4000, 2000).
      // After translating by world (5000, 2000): (9000, 4000).
      const targets = buildSeamIconTargets({
        forms: [
          {
            id: 'house-1',
            worldOffsetXMm: 5000,
            worldOffsetYMm: 2000,
            rotationQuarterTurns: 0,
            composition: {
              primitives: [
                rect({ x: 0, y: 0, w: 4000, d: 4000 }),
                rect({ x: 4000, y: 0, w: 4000, d: 4000 }),
              ],
              joins: [
                { fromPrimitiveIndex: 0, fromEdge: 'east', toPrimitiveIndex: 1, toEdge: 'west' },
              ],
            },
          },
        ],
      });
      expect(targets).toHaveLength(1);
      const detach = targets[0]!;
      if (detach.kind !== 'detach') throw new Error('expected detach');
      expect(detach.worldXMm).toBe(9000);
      expect(detach.worldYMm).toBe(4000);
      expect(detach.houseFormId).toBe('house-1');
      expect(detach.joinIndex).toBe(0);
    });

    it('skips single-rectangle forms (no internal seams)', () => {
      const targets = buildSeamIconTargets({
        forms: [
          singleRectForm({ id: 'house-1', worldX: 0, worldY: 0, w: 6000, d: 4000 }),
        ],
      });
      expect(targets.filter((t) => t.kind === 'detach')).toHaveLength(0);
    });

    it('positions a detach icon correctly when the form is rotated 90° CCW', () => {
      // Composite at world (0, 0), rotation 1 quarter-turn (90° CCW).
      // Form-local seam midpoint (4000, 2000). After 90° CCW
      // rotation: (-2000, 4000). After zero translation: (-2000, 4000).
      const targets = buildSeamIconTargets({
        forms: [
          {
            id: 'house-1',
            worldOffsetXMm: 0,
            worldOffsetYMm: 0,
            rotationQuarterTurns: 1,
            composition: {
              primitives: [
                rect({ x: 0, y: 0, w: 4000, d: 4000 }),
                rect({ x: 4000, y: 0, w: 4000, d: 4000 }),
              ],
              joins: [
                { fromPrimitiveIndex: 0, fromEdge: 'east', toPrimitiveIndex: 1, toEdge: 'west' },
              ],
            },
          },
        ],
      });
      expect(targets).toHaveLength(1);
      const detach = targets[0]!;
      if (detach.kind !== 'detach') throw new Error('expected detach');
      expect(detach.worldXMm).toBe(-2000);
      expect(detach.worldYMm).toBe(4000);
    });
  });

  describe('join icons', () => {
    it('emits one join icon per pair of edge-adjacent forms', () => {
      const targets = buildSeamIconTargets({
        forms: [
          singleRectForm({ id: 'house-1', worldX: 0, worldY: 0, w: 6000, d: 4000 }),
          singleRectForm({ id: 'house-2', worldX: 6000, worldY: 0, w: 4000, d: 4000 }),
        ],
      });
      const joins = targets.filter((t) => t.kind === 'join');
      expect(joins).toHaveLength(1);
      const join = joins[0]!;
      if (join.kind !== 'join') throw new Error('expected join');
      expect(join.formAId).toBe('house-1');
      expect(join.formBId).toBe('house-2');
      // Midpoint of east-west seam at world x=6000, y in [0, 4000].
      expect(join.worldXMm).toBe(6000);
      expect(join.worldYMm).toBe(2000);
    });

    it('omits a join icon when forms are not edge-adjacent (large gap)', () => {
      const targets = buildSeamIconTargets({
        forms: [
          singleRectForm({ id: 'house-1', worldX: 0, worldY: 0, w: 6000, d: 4000 }),
          singleRectForm({ id: 'house-2', worldX: 10000, worldY: 0, w: 4000, d: 4000 }),
        ],
      });
      expect(targets.filter((t) => t.kind === 'join')).toHaveLength(0);
    });

    it('skips join icons between forms with differing rotations', () => {
      const targets = buildSeamIconTargets({
        forms: [
          singleRectForm({ id: 'house-1', worldX: 0, worldY: 0, w: 6000, d: 4000, rotation: 0 }),
          singleRectForm({ id: 'house-2', worldX: 6000, worldY: 0, w: 4000, d: 4000, rotation: 1 }),
        ],
      });
      expect(targets.filter((t) => t.kind === 'join')).toHaveLength(0);
    });

    it('checks every pair exactly once (no duplicates from A<->B vs B<->A)', () => {
      const targets = buildSeamIconTargets({
        forms: [
          singleRectForm({ id: 'house-1', worldX: 0, worldY: 0, w: 4000, d: 4000 }),
          singleRectForm({ id: 'house-2', worldX: 4000, worldY: 0, w: 4000, d: 4000 }),
          singleRectForm({ id: 'house-3', worldX: 8000, worldY: 0, w: 4000, d: 4000 }),
        ],
      });
      // Three forms in a horizontal line, two seams: 1<->2 and 2<->3.
      // House-1<->house-3 are not adjacent.
      const joins = targets.filter((t) => t.kind === 'join');
      expect(joins).toHaveLength(2);
      const keys = joins.map((t) => t.key).sort();
      expect(keys).toEqual(['join:house-1:house-2', 'join:house-2:house-3']);
    });
  });

  describe('mixed projects (composite + separate)', () => {
    it('emits a detach icon for the composite AND a join icon between a separate form and the composite', () => {
      // House-1: composite (2 primitives, 1 join) at world (0, 0).
      //   - p0 = (0, 0) 4x4; p1 = (4000, 0) 4x4. Seam midpoint
      //     world (4000, 2000).
      // House-2: single rectangle at world (8000, 0) 4x4.
      //   - Adjacent to house-1's p1.east at world x=8000. Join
      //     midpoint world (8000, 2000).
      const composite: HouseComposition = {
        primitives: [
          rect({ x: 0, y: 0, w: 4000, d: 4000 }),
          rect({ x: 4000, y: 0, w: 4000, d: 4000 }),
        ],
        joins: [
          { fromPrimitiveIndex: 0, fromEdge: 'east', toPrimitiveIndex: 1, toEdge: 'west' },
        ],
      };
      const targets = buildSeamIconTargets({
        forms: [
          {
            id: 'house-1',
            worldOffsetXMm: 0,
            worldOffsetYMm: 0,
            rotationQuarterTurns: 0,
            composition: composite,
          },
          singleRectForm({ id: 'house-2', worldX: 8000, worldY: 0, w: 4000, d: 4000 }),
        ],
      });
      expect(targets).toHaveLength(2);
      const detach = targets.find((t) => t.kind === 'detach');
      const join = targets.find((t) => t.kind === 'join');
      if (!detach || !join) throw new Error('expected one of each');
      if (detach.kind === 'detach') {
        expect(detach.worldXMm).toBe(4000);
        expect(detach.worldYMm).toBe(2000);
      }
      if (join.kind === 'join') {
        expect(join.worldXMm).toBe(8000);
        expect(join.worldYMm).toBe(2000);
      }
    });
  });
});
