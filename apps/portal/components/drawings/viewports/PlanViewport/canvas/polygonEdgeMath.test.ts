import { describe, expect, it } from 'vitest';
import {
  applyEdgePerpendicularTranslation,
  findClosestPolygonEdge,
  polygonEdgeOutwardNormal,
} from './polygonEdgeMath';

const RECT = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 2000 },
  { x: 0, y: 2000 },
];

describe('polygonEdgeOutwardNormal', () => {
  it('returns null for polygons with fewer than 3 vertices', () => {
    expect(polygonEdgeOutwardNormal([{ x: 0, y: 0 }, { x: 100, y: 0 }], 0)).toBeNull();
  });

  it('returns null for a zero-length edge', () => {
    expect(
      polygonEdgeOutwardNormal(
        [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        0,
      ),
    ).toBeNull();
  });

  it('points outward (away from centroid) for each edge of a rectangle', () => {
    const centroid = { x: 2000, y: 1000 };
    for (let i = 0; i < RECT.length; i += 1) {
      const normal = polygonEdgeOutwardNormal(RECT, i)!;
      const a = RECT[i]!;
      const b = RECT[(i + 1) % RECT.length]!;
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const outwardX = midX - centroid.x;
      const outwardY = midY - centroid.y;
      expect(normal.x * outwardX + normal.y * outwardY).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns unit-length vectors', () => {
    for (let i = 0; i < RECT.length; i += 1) {
      const normal = polygonEdgeOutwardNormal(RECT, i)!;
      expect(Math.hypot(normal.x, normal.y)).toBeCloseTo(1, 6);
    }
  });
});

describe('findClosestPolygonEdge', () => {
  it('returns null for polygons with fewer than 3 vertices', () => {
    expect(findClosestPolygonEdge([{ x: 0, y: 0 }, { x: 100, y: 0 }], { x: 50, y: 50 })).toBeNull();
  });

  it('finds the bottom edge for a point below the rectangle', () => {
    const result = findClosestPolygonEdge(RECT, { x: 2000, y: -100 })!;
    expect(result.edgeIndex).toBe(0);
    expect(result.distanceMm).toBeCloseTo(100);
  });

  it('finds the right edge for a point to the right of the rectangle', () => {
    const result = findClosestPolygonEdge(RECT, { x: 4500, y: 1000 })!;
    expect(result.edgeIndex).toBe(1);
    expect(result.distanceMm).toBeCloseTo(500);
  });

  it('returns the closest point projected onto the segment', () => {
    const result = findClosestPolygonEdge(RECT, { x: 1500, y: -300 })!;
    expect(result.closestPoint.x).toBeCloseTo(1500);
    expect(result.closestPoint.y).toBeCloseTo(0);
  });

  it('reports outward normal pointing away from the polygon centroid', () => {
    const result = findClosestPolygonEdge(RECT, { x: 2000, y: -100 })!;
    expect(result.outwardNormal.y).toBeLessThan(0);
  });

  it('finds an inner-notch edge for a U-shape when the pointer is in the notch', () => {
    const u = [
      { x: 0, y: 0 },
      { x: 6000, y: 0 },
      { x: 6000, y: 4000 },
      { x: 4000, y: 4000 },
      { x: 4000, y: 1500 },
      { x: 2000, y: 1500 },
      { x: 2000, y: 4000 },
      { x: 0, y: 4000 },
    ];
    // Point inside the notch region
    const result = findClosestPolygonEdge(u, { x: 3000, y: 1600 })!;
    expect(result.distanceMm).toBeCloseTo(100);
    expect([4]).toContain(result.edgeIndex);
  });
});

describe('applyEdgePerpendicularTranslation', () => {
  it('moves the two endpoints of the targeted edge along its outward normal', () => {
    const moved = applyEdgePerpendicularTranslation(RECT, 1, 500);
    // Edge 1 is the right edge (x=4000): both vertices should have moved +500 in x
    expect(moved[1]).toEqual({ x: 4500, y: 0 });
    expect(moved[2]).toEqual({ x: 4500, y: 2000 });
    // Other vertices unchanged
    expect(moved[0]).toEqual({ x: 0, y: 0 });
    expect(moved[3]).toEqual({ x: 0, y: 2000 });
  });

  it('shrinks the polygon when delta is negative', () => {
    const moved = applyEdgePerpendicularTranslation(RECT, 1, -500);
    expect(moved[1]).toEqual({ x: 3500, y: 0 });
    expect(moved[2]).toEqual({ x: 3500, y: 2000 });
  });

  it('translates the bottom edge correctly', () => {
    const moved = applyEdgePerpendicularTranslation(RECT, 0, 300);
    // Edge 0 is bottom (y=0); outward normal points -y. +300 along -y → y becomes -300
    expect(moved[0]).toEqual({ x: 0, y: -300 });
    expect(moved[1]).toEqual({ x: 4000, y: -300 });
  });

  it('returns a copy when polygon has fewer than 3 vertices', () => {
    const result = applyEdgePerpendicularTranslation([{ x: 0, y: 0 }, { x: 100, y: 0 }], 0, 50);
    expect(result).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
  });

  it('does not mutate the source polygon', () => {
    const source = [...RECT];
    applyEdgePerpendicularTranslation(source, 1, 500);
    expect(source).toEqual(RECT);
  });
});
