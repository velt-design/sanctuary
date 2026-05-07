import { describe, expect, it } from 'vitest';
import type { GeometryTopProjectionShape } from '@sp/geometry';
import {
  bestSnapTarget,
  closestPointOnSegment,
  createSnapEngine,
  shapeCentroid,
  type SnapKind,
} from './snapEngine';

function rectShape(input: {
  id: string;
  origin: { x: number; y: number };
  width: number;
  height: number;
}): GeometryTopProjectionShape {
  const { x, y } = input.origin;
  return {
    id: input.id,
    sourceObjectId: input.id,
    sourceId: input.id,
    sourceType: 'house_surface_solid',
    family: 'house',
    kind: 'deck',
    polygon: [
      { x, y },
      { x: x + input.width, y },
      { x: x + input.width, y: y + input.height },
      { x, y: y + input.height },
    ],
    zOrder: 0,
    zMin: null,
    zMax: null,
  };
}

describe('closestPointOnSegment', () => {
  it('returns endpoint a when the query is on the a-side', () => {
    expect(closestPointOnSegment({ x: -10, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('returns endpoint b when the query is past b', () => {
    expect(closestPointOnSegment({ x: 200, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 })).toEqual({ x: 100, y: 0 });
  });

  it('returns the perpendicular foot for queries that fall inside the segment', () => {
    expect(closestPointOnSegment({ x: 30, y: 50 }, { x: 0, y: 0 }, { x: 100, y: 0 })).toEqual({ x: 30, y: 0 });
  });

  it('handles degenerate (zero-length) segments by returning the shared endpoint', () => {
    expect(closestPointOnSegment({ x: 999, y: 999 }, { x: 5, y: 5 }, { x: 5, y: 5 })).toEqual({ x: 5, y: 5 });
  });
});

describe('shapeCentroid', () => {
  it('returns null for shapes with empty polygons', () => {
    expect(
      shapeCentroid({
        id: 'empty',
        sourceObjectId: 'empty',
        sourceId: null,
        sourceType: 'house_surface',
        family: 'house',
        kind: 'deck',
        polygon: [],
        zOrder: 0,
        zMin: null,
        zMax: null,
      }),
    ).toBeNull();
  });

  it('returns the average of polygon vertices', () => {
    expect(shapeCentroid(rectShape({ id: 'a', origin: { x: 0, y: 0 }, width: 100, height: 200 }))).toEqual({
      x: 50,
      y: 100,
    });
  });
});

describe('createSnapEngine', () => {
  const square = rectShape({ id: 'square', origin: { x: 0, y: 0 }, width: 100, height: 100 });

  function engine(enabledKinds: ReadonlyArray<SnapKind>, toleranceMm = 10) {
    return createSnapEngine({
      shapes: [square],
      enabledKinds,
      toleranceMm,
    });
  }

  it('returns endpoint targets for a query close to a corner', () => {
    const targets = engine(['endpoint']).query({ point: { x: 3, y: 4 } });
    expect(targets).toHaveLength(1);
    expect(targets[0]?.kind).toBe('endpoint');
    expect(targets[0]?.point).toEqual({ x: 0, y: 0 });
    expect(targets[0]?.distanceMm).toBeCloseTo(5, 6);
  });

  it('returns midpoint targets at the midpoint of each edge', () => {
    const targets = engine(['midpoint']).query({ point: { x: 50, y: 4 } });
    expect(targets[0]?.kind).toBe('midpoint');
    expect(targets[0]?.point).toEqual({ x: 50, y: 0 });
    expect(targets[0]?.edgeIndex).toBe(0);
  });

  it('returns edge-projection targets for queries near an edge but not its endpoints/midpoint', () => {
    const targets = engine(['edge']).query({ point: { x: 30, y: 5 } });
    expect(targets[0]?.kind).toBe('edge');
    expect(targets[0]?.point).toEqual({ x: 30, y: 0 });
    expect(targets[0]?.distanceMm).toBeCloseTo(5, 6);
  });

  it('orders results by priority score then distance', () => {
    const targets = engine(['endpoint', 'midpoint', 'edge']).query({ point: { x: 1, y: 1 } });
    expect(targets[0]?.kind).toBe('endpoint');
    expect(targets[0]?.point).toEqual({ x: 0, y: 0 });
    expect(targets[1]?.kind).toBe('edge');
  });

  it('skips kinds that are not enabled', () => {
    const targets = engine(['midpoint']).query({ point: { x: 0, y: 0 } });
    expect(targets.every((target) => target.kind === 'midpoint')).toBe(true);
  });

  it('drops candidates beyond the tolerance', () => {
    const targets = engine(['endpoint'], 1).query({ point: { x: 50, y: 50 } });
    expect(targets).toHaveLength(0);
  });

  it('returns centroid targets when enabled', () => {
    const targets = engine(['centroid']).query({ point: { x: 52, y: 50 } });
    expect(targets[0]?.kind).toBe('centroid');
    expect(targets[0]?.point).toEqual({ x: 50, y: 50 });
  });

  it('handles multiple shapes with independent candidate sets', () => {
    const e = createSnapEngine({
      shapes: [
        rectShape({ id: 'a', origin: { x: 0, y: 0 }, width: 50, height: 50 }),
        rectShape({ id: 'b', origin: { x: 200, y: 0 }, width: 50, height: 50 }),
      ],
      enabledKinds: ['endpoint'],
      toleranceMm: 6,
    });
    const targetsA = e.query({ point: { x: 0, y: 0 } });
    const targetsB = e.query({ point: { x: 200, y: 0 } });
    expect(targetsA[0]?.shapeId).toBe('a');
    expect(targetsB[0]?.shapeId).toBe('b');
  });

  it('skips shapes with empty polygons without throwing', () => {
    const e = createSnapEngine({
      shapes: [
        {
          id: 'empty',
          sourceObjectId: 'empty',
          sourceId: null,
          sourceType: 'house_surface',
          family: 'house',
          kind: 'deck',
          polygon: [],
          zOrder: 0,
          zMin: null,
          zMax: null,
        },
      ],
      enabledKinds: ['endpoint', 'midpoint', 'edge', 'centroid'],
      toleranceMm: 50,
    });
    expect(e.query({ point: { x: 0, y: 0 } })).toEqual([]);
  });
});

describe('createSnapEngine — line targets', () => {
  // Step 7a of the first-class spatial-entities migration. Roof eaves and
  // standalone wall edges aren't polygon boundaries, so they enter the engine
  // as `SnapLineTarget`. The engine produces endpoint/midpoint/edge candidates
  // for each line target and preserves `edgeKind` on the resulting SnapTarget
  // so downstream attachment routing can distinguish `roof_eave` from `wall`.

  it('produces endpoint candidates at both ends of a line target', () => {
    const e = createSnapEngine({
      shapes: [],
      lineTargets: [
        {
          id: 'roof-eave-edge-1',
          sourceObjectId: 'house-main',
          edgeKind: 'roof_eave',
          start: { x: 0, y: 0 },
          end: { x: 1000, y: 0 },
        },
      ],
      enabledKinds: ['endpoint'],
      toleranceMm: 10,
    });
    const startMatch = e.query({ point: { x: 3, y: 4 } });
    expect(startMatch[0]?.kind).toBe('endpoint');
    expect(startMatch[0]?.point).toEqual({ x: 0, y: 0 });
    expect(startMatch[0]?.edgeKind).toBe('roof_eave');
    const endMatch = e.query({ point: { x: 1003, y: 4 } });
    expect(endMatch[0]?.point).toEqual({ x: 1000, y: 0 });
  });

  it('produces an edge candidate via perpendicular foot on the line target', () => {
    const e = createSnapEngine({
      shapes: [],
      lineTargets: [
        {
          id: 'roof-eave-edge-1',
          sourceObjectId: 'house-main',
          edgeKind: 'roof_eave',
          start: { x: 0, y: 0 },
          end: { x: 1000, y: 0 },
        },
      ],
      enabledKinds: ['edge'],
      toleranceMm: 10,
    });
    const targets = e.query({ point: { x: 500, y: 5 } });
    expect(targets[0]?.kind).toBe('edge');
    expect(targets[0]?.point).toEqual({ x: 500, y: 0 });
    expect(targets[0]?.distanceMm).toBeCloseTo(5, 6);
    expect(targets[0]?.edgeKind).toBe('roof_eave');
  });

  it('preserves edgeKind metadata so consumers can route by domain kind', () => {
    const e = createSnapEngine({
      shapes: [],
      lineTargets: [
        {
          id: 'wall-1',
          sourceObjectId: 'house-main',
          edgeKind: 'wall',
          start: { x: 0, y: 0 },
          end: { x: 1000, y: 0 },
        },
        {
          id: 'roof-eave-1',
          sourceObjectId: 'house-main',
          edgeKind: 'roof_eave',
          start: { x: 0, y: 500 },
          end: { x: 1000, y: 500 },
        },
      ],
      enabledKinds: ['edge'],
      toleranceMm: 10,
    });
    const wallMatch = e.query({ point: { x: 500, y: 5 } });
    expect(wallMatch[0]?.edgeKind).toBe('wall');
    const eaveMatch = e.query({ point: { x: 500, y: 495 } });
    expect(eaveMatch[0]?.edgeKind).toBe('roof_eave');
  });

  it('mixes line-target candidates with polygon-shape candidates by priority', () => {
    const e = createSnapEngine({
      shapes: [
        {
          id: 'pergola',
          sourceObjectId: 'pergola',
          sourceId: 'pergola',
          sourceType: 'pergola_reference',
          family: 'pergola',
          kind: 'outline',
          polygon: [
            { x: 0, y: 0 },
            { x: 6000, y: 0 },
            { x: 6000, y: 3000 },
            { x: 0, y: 3000 },
          ],
          zOrder: 0,
          zMin: null,
          zMax: null,
        },
      ],
      lineTargets: [
        {
          id: 'roof-eave-1',
          sourceObjectId: 'house-main',
          edgeKind: 'roof_eave',
          start: { x: 0, y: 0 },
          end: { x: 6000, y: 0 },
        },
      ],
      enabledKinds: ['endpoint', 'edge'],
      toleranceMm: 10,
    });
    const targets = e.query({ point: { x: 3, y: 4 } });
    const endpoints = targets.filter((t) => t.kind === 'endpoint');
    expect(endpoints.length).toBeGreaterThanOrEqual(2);
    expect(endpoints[0]?.point).toEqual({ x: 0, y: 0 });
  });

  it('drops line-target candidates beyond tolerance', () => {
    const e = createSnapEngine({
      shapes: [],
      lineTargets: [
        {
          id: 'roof-eave-1',
          sourceObjectId: 'house-main',
          edgeKind: 'roof_eave',
          start: { x: 0, y: 0 },
          end: { x: 1000, y: 0 },
        },
      ],
      enabledKinds: ['endpoint', 'edge'],
      toleranceMm: 1,
    });
    expect(e.query({ point: { x: 500, y: 50 } })).toHaveLength(0);
  });
});

describe('bestSnapTarget', () => {
  it('returns null when no targets are present', () => {
    expect(bestSnapTarget([])).toBeNull();
  });

  it('returns the first target (the highest-priority match)', () => {
    const result = createSnapEngine({
      shapes: [
        {
          id: 's',
          sourceObjectId: 's',
          sourceId: 's',
          sourceType: 'house_surface_solid',
          family: 'house',
          kind: 'deck',
          polygon: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 },
          ],
          zOrder: 0,
          zMin: null,
          zMax: null,
        },
      ],
      enabledKinds: ['endpoint', 'edge'],
      toleranceMm: 10,
    }).query({ point: { x: 4, y: 4 } });
    expect(bestSnapTarget(result)?.kind).toBe('endpoint');
  });
});
